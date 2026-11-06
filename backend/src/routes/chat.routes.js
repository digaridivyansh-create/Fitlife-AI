async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    reply.code(401).send({
      error: "Authentication required.",
    });
    return false;
  }
}

async function chatRoutes(app) {
  // Create a conversation owned by the authenticated user.
  app.post(
    "/conversations",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const suppliedTitle = request.body?.title;

      if (
        suppliedTitle !== undefined &&
        (
          typeof suppliedTitle !== "string" ||
          suppliedTitle.trim().length === 0 ||
          suppliedTitle.trim().length > 120
        )
      ) {
        return reply.code(400).send({
          error: "Title must contain 1-120 characters.",
        });
      }

      const title = suppliedTitle
        ? suppliedTitle.trim()
        : "New conversation";

      try {
        const result = await app.pgPool.query(
          `INSERT INTO chat_conversations (user_id, title)
           VALUES ($1, $2)
           RETURNING id, title, created_at, updated_at`,
          [request.user.sub, title]
        );

        return reply.code(201).send({
          conversation: result.rows[0],
        });
      } catch (error) {
        request.log.error(
          { err: error },
          "Chat conversation creation failed."
        );

        return reply.code(500).send({
          error: "Unable to create conversation.",
        });
      }
    }
  );

  // List only conversations owned by the authenticated user.
  app.get(
    "/conversations",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const limit = Number(request.query?.limit ?? 20);
      const offset = Number(request.query?.offset ?? 0);

      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0
      ) {
        return reply.code(400).send({
          error: "Limit must be 1-100 and offset must be non-negative.",
        });
      }

      try {
        const result = await app.pgPool.query(
          `SELECT
             id,
             title,
             created_at,
             updated_at
           FROM chat_conversations
           WHERE user_id = $1
           ORDER BY updated_at DESC, id DESC
           LIMIT $2 OFFSET $3`,
          [request.user.sub, limit, offset]
        );

        const countResult = await app.pgPool.query(
          `SELECT COUNT(*)::INTEGER AS total
           FROM chat_conversations
           WHERE user_id = $1`,
          [request.user.sub]
        );

        const total = countResult.rows[0].total;

        return reply.code(200).send({
          conversations: result.rows,
          pagination: {
            limit,
            offset,
            total,
            has_more: offset + result.rows.length < total,
          },
        });
      } catch (error) {
        request.log.error(
          { err: error },
          "Chat conversation listing failed."
        );

        return reply.code(500).send({
          error: "Unable to retrieve conversations.",
        });
      }
    }
  );

  // Retrieve messages only from a conversation owned by this user.
  app.get(
    "/conversations/:id/messages",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const conversationId = Number(request.params.id);
      const limit = Number(request.query?.limit ?? 50);
      const offset = Number(request.query?.offset ?? 0);

      if (
        !Number.isSafeInteger(conversationId) ||
        conversationId <= 0
      ) {
        return reply.code(400).send({
          error: "A valid conversation ID is required.",
        });
      }

      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0
      ) {
        return reply.code(400).send({
          error: "Limit must be 1-100 and offset must be non-negative.",
        });
      }

      try {
        const conversationResult = await app.pgPool.query(
          `SELECT id, title, created_at, updated_at
           FROM chat_conversations
           WHERE id = $1 AND user_id = $2`,
          [conversationId, request.user.sub]
        );

        if (conversationResult.rowCount === 0) {
          return reply.code(404).send({
            error: "Conversation not found.",
          });
        }

        const messagesResult = await app.pgPool.query(
          `SELECT id, role, content, created_at
           FROM chat_messages
           WHERE conversation_id = $1
           ORDER BY created_at ASC, id ASC
           LIMIT $2 OFFSET $3`,
          [conversationId, limit, offset]
        );

        return reply.code(200).send({
          conversation: conversationResult.rows[0],
          messages: messagesResult.rows,
          pagination: {
            limit,
            offset,
            has_more: messagesResult.rows.length === limit,
          },
        });
      } catch (error) {
        request.log.error(
          { err: error },
          "Chat message history retrieval failed."
        );

        return reply.code(500).send({
          error: "Unable to retrieve conversation messages.",
        });
      }
    }
  );

  // Send a message using the authenticated user's real fitness context.
  app.post(
    "/conversations/:id/messages",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const conversationId = Number(request.params.id);
      const message =
        typeof request.body?.message === "string"
          ? request.body.message.trim()
          : "";

      if (
        !Number.isSafeInteger(conversationId) ||
        conversationId <= 0
      ) {
        return reply.code(400).send({
          error: "A valid conversation ID is required.",
        });
      }

      if (!message || message.length > 4000) {
        return reply.code(400).send({
          error: "Message must contain 1-4000 characters.",
        });
      }

      if (!process.env.AI_SERVICE_TOKEN) {
        request.log.error("AI service authentication is not configured.");

        return reply.code(503).send({
          error: "Chatbot service is temporarily unavailable.",
        });
      }

      try {
        // Confirm that this conversation belongs to the authenticated user.
        const conversationResult = await app.pgPool.query(
          `SELECT id, title
           FROM chat_conversations
           WHERE id = $1 AND user_id = $2`,
          [conversationId, request.user.sub]
        );

        if (conversationResult.rowCount === 0) {
          return reply.code(404).send({
            error: "Conversation not found.",
          });
        }

        // Retrieve only the fitness profile fields needed for personalization.
        const profileResult = await app.pgPool.query(
          `SELECT
             p.full_name,
             p.height_cm,
             p.weight_kg,
             p.fitness_goal,
             p.activity_level
           FROM user_profiles p
           WHERE p.user_id = $1`,
          [request.user.sub]
        );

        const profile = profileResult.rows[0] || null;

        // Retrieve the five most recent workout plans.
        const workoutResult = await app.pgPool.query(
          `SELECT
             fitness_goal,
             experience_level,
             training_days_per_week,
             session_duration_minutes,
             workout_location,
             created_at,
             plan_data
           FROM workout_plans
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 5`,
          [request.user.sub]
        );

        // Retrieve the ten most recent meals and their food items.
        const mealResult = await app.pgPool.query(
          `SELECT
             m.id,
             m.meal_name,
             m.consumed_at,
             mi.food_name,
             mi.serving_weight_g,
             mi.calories,
             mi.protein_g,
             mi.carbohydrates_g,
             mi.fat_g
           FROM (
             SELECT id, meal_name, consumed_at
             FROM meals
             WHERE user_id = $1
             ORDER BY consumed_at DESC, id DESC
             LIMIT 10
           ) m
           LEFT JOIN meal_items mi ON mi.meal_id = m.id
           ORDER BY m.consumed_at DESC, m.id DESC, mi.id ASC`,
          [request.user.sub]
        );

        const mealMap = new Map();

        for (const row of mealResult.rows) {
          if (!mealMap.has(row.id)) {
            mealMap.set(row.id, {
              meal_name: row.meal_name,
              consumed_at: row.consumed_at,
              items: [],
            });
          }

          if (row.food_name) {
            const numericOrNull = (value) =>
              value === null || value === undefined
                ? null
                : Number(value);

            mealMap.get(row.id).items.push({
              food_name: row.food_name,
              serving_weight_g: numericOrNull(row.serving_weight_g),
              calories: numericOrNull(row.calories),
              protein_g: numericOrNull(row.protein_g),
              carbohydrates_g: numericOrNull(row.carbohydrates_g),
              fat_g: numericOrNull(row.fat_g),
            });
          }
        }

        // Retrieve the latest 12 messages, then restore chronological order.
        const historyResult = await app.pgPool.query(
          `SELECT role, content
           FROM chat_messages
           WHERE conversation_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 12`,
          [conversationId]
        );

        const history = historyResult.rows.reverse();

        const aiServiceUrl = (
          process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
        ).replace(/\/+$/, "");

        // Request the AI response before writing either message.
        let aiResponse;

        try {
          const response = await fetch(
            `${aiServiceUrl}/chat/respond`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
              },
              body: JSON.stringify({
                message,
                history,
                context: {
                  profile: profile
                    ? {
                        full_name: profile.full_name,
                        height_cm:
                          profile.height_cm === null
                            ? null
                            : Number(profile.height_cm),
                        weight_kg:
                          profile.weight_kg === null
                            ? null
                            : Number(profile.weight_kg),
                        fitness_goal: profile.fitness_goal,
                        activity_level: profile.activity_level,
                      }
                    : null,
                  recent_workouts: workoutResult.rows.map((workout) => ({
                    fitness_goal: workout.fitness_goal,
                    experience_level: workout.experience_level,
                    training_days_per_week:
                      workout.training_days_per_week,
                    session_duration_minutes:
                      workout.session_duration_minutes,
                    workout_location: workout.workout_location,
                    created_at: workout.created_at,
                    plan_data: workout.plan_data || {},
                  })),
                  recent_meals: Array.from(mealMap.values()),
                },
              }),
              signal: AbortSignal.timeout(120000),
            }
          );

          if (!response.ok) {
            request.log.error(
              {
                statusCode: response.status,
              },
              "Chatbot AI service returned an unsuccessful response."
            );

            return reply.code(503).send({
              error: "Chatbot service is temporarily unavailable. Please try again.",
            });
          }

          aiResponse = await response.json();
        } catch (error) {
          request.log.error(
            {
              name: error.name,
            },
            "Chatbot AI service request failed."
          );

          return reply.code(503).send({
            error: "Chatbot service is temporarily unavailable. Please try again.",
          });
        }

        const answer = aiResponse?.answer;

        if (
          typeof answer !== "string" ||
          !answer.trim() ||
          answer.trim().length > 8000
        ) {
          request.log.error("Chatbot AI service returned an invalid answer.");

          return reply.code(503).send({
            error: "Chatbot service returned an invalid response.",
          });
        }

        // Persist both messages atomically after a successful AI response.
        const client = await app.pgPool.connect();

        try {
          await client.query("BEGIN");

          const userMessageResult = await client.query(
            `INSERT INTO chat_messages (
               conversation_id,
               role,
               content
             )
             VALUES ($1, 'user', $2)
             RETURNING id, role, content, created_at`,
            [conversationId, message]
          );

          const assistantMessageResult = await client.query(
            `INSERT INTO chat_messages (
               conversation_id,
               role,
               content
             )
             VALUES ($1, 'assistant', $2)
             RETURNING id, role, content, created_at`,
            [conversationId, answer.trim()]
          );

          await client.query(
            `UPDATE chat_conversations
             SET
               title = CASE
                 WHEN title = 'New conversation'
                 THEN LEFT($2, 120)
                 ELSE title
               END,
               updated_at = NOW()
             WHERE id = $1 AND user_id = $3`,
            [conversationId, message, request.user.sub]
          );

          await client.query("COMMIT");

          return reply.code(200).send({
            conversation_id: conversationId,
            user_message: userMessageResult.rows[0],
            assistant_message: assistantMessageResult.rows[0],
          });
        } catch (error) {
          await client.query("ROLLBACK");

          request.log.error(
            { err: error },
            "Chat message persistence failed."
          );

          return reply.code(500).send({
            error: "Unable to save chat messages.",
          });
        } finally {
          client.release();
        }
      } catch (error) {
        request.log.error(
          { err: error },
          "Chat message processing failed."
        );

        return reply.code(500).send({
          error: "Unable to process your message.",
        });
      }
    }
  );

  // Delete only a conversation owned by the authenticated user.
  app.delete(
    "/conversations/:id",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const conversationId = Number(request.params.id);

      if (
        !Number.isSafeInteger(conversationId) ||
        conversationId <= 0
      ) {
        return reply.code(400).send({
          error: "A valid conversation ID is required.",
        });
      }

      try {
        const result = await app.pgPool.query(
          `DELETE FROM chat_conversations
           WHERE id = $1 AND user_id = $2
           RETURNING id`,
          [conversationId, request.user.sub]
        );

        if (result.rowCount === 0) {
          return reply.code(404).send({
            error: "Conversation not found.",
          });
        }

        return reply.code(200).send({
          message: "Conversation deleted successfully.",
          conversation_id: result.rows[0].id,
        });
      } catch (error) {
        request.log.error(
          { err: error },
          "Chat conversation deletion failed."
        );

        return reply.code(500).send({
          error: "Unable to delete conversation.",
        });
      }
    }
  );
}

module.exports = chatRoutes;
