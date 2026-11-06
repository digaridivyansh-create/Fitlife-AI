const { getUserProfile } = require("../services/profile.service");

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

async function workoutRoutes(app) {
  // Generate and permanently save a workout plan.
  app.post("/generate", async (request, reply) => {
    if (!(await authenticate(request, reply))) {
      return;
    }

    try {
      const profile = await getUserProfile(request.user.sub);

      if (!profile) {
        return reply.code(404).send({
          error: "User profile not found.",
        });
      }

      if (!profile.fitness_goal || !profile.activity_level) {
        return reply.code(400).send({
          error: "Please complete your fitness goal and activity level in your profile before generating a workout.",
        });
      }

      if (
        !request.body ||
        typeof request.body !== "object" ||
        Array.isArray(request.body)
      ) {
        return reply.code(400).send({
          error: "A valid workout request is required.",
        });
      }

      const workoutRequest = {
        ...request.body,
        fitness_goal: profile.fitness_goal,
        activity_level: profile.activity_level,
      };

      const aiServiceUrl = (
        process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
      ).replace(/\/+$/, "");

      const response = await fetch(
        `${aiServiceUrl}/workouts/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
          },
          body: JSON.stringify(workoutRequest),
          signal: AbortSignal.timeout(15000),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return reply.code(response.status).send(result);
      }

      // Persist only successfully generated plans.
      const saved = await app.pgPool.query(
        `INSERT INTO workout_plans (
           user_id,
           fitness_goal,
           experience_level,
           training_days_per_week,
           session_duration_minutes,
           workout_location,
           equipment,
           plan_data
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
         RETURNING id, created_at`,
        [
          request.user.sub,
          profile.fitness_goal,
          workoutRequest.experience_level,
          workoutRequest.training_days_per_week,
          workoutRequest.session_duration_minutes,
          workoutRequest.workout_location,
          JSON.stringify(workoutRequest.equipment || []),
          JSON.stringify(result),
        ]
      );

      return reply.code(201).send({
        message: "Workout plan generated and saved successfully.",
        plan_id: saved.rows[0].id,
        created_at: saved.rows[0].created_at,
        workout: result,
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Workout generation or persistence failed."
      );

      if (
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      ) {
        return reply.code(504).send({
          error: "Workout service timed out. Please try again.",
        });
      }

      if (error.name === "TypeError") {
        return reply.code(503).send({
          error: "Workout service is currently unavailable.",
        });
      }

      return reply.code(500).send({
        error: "Unable to generate and save the workout plan.",
      });
    }
  });

  // List only the authenticated user's workout plans.
  app.get("/", async (request, reply) => {
    if (!(await authenticate(request, reply))) {
      return;
    }

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
        error: "Limit must be 1-100 and offset must be a non-negative integer.",
      });
    }

    try {
      const result = await app.pgPool.query(
        `SELECT
           id,
           fitness_goal,
           experience_level,
           training_days_per_week,
           session_duration_minutes,
           workout_location,
           equipment,
           created_at
         FROM workout_plans
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [request.user.sub, limit, offset]
      );

      return reply.code(200).send({
        count: result.rows.length,
        limit,
        offset,
        plans: result.rows,
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Workout history retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve workout history.",
      });
    }
  });

  // Retrieve one plan only if it belongs to the authenticated user.
  app.get("/:id", async (request, reply) => {
    if (!(await authenticate(request, reply))) {
      return;
    }

    const planId = request.params.id;

    if (!/^[1-9]\d*$/.test(planId)) {
      return reply.code(400).send({
        error: "A valid workout plan ID is required.",
      });
    }

    try {
      const result = await app.pgPool.query(
        `SELECT
           id,
           fitness_goal,
           experience_level,
           training_days_per_week,
           session_duration_minutes,
           workout_location,
           equipment,
           plan_data,
           created_at
         FROM workout_plans
         WHERE id = $1 AND user_id = $2`,
        [planId, request.user.sub]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: "Workout plan not found.",
        });
      }

      return reply.code(200).send({
        plan: result.rows[0],
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Workout plan retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve this workout plan.",
      });
    }
  });
}

module.exports = workoutRoutes;
