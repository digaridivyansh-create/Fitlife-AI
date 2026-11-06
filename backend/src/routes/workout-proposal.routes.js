const { getUserProfile } = require("../services/profile.service");
const { isDeepStrictEqual } = require("node:util");

async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
    return true;
  } catch {
    reply.code(401).send({ error: "Authentication required." });
    return false;
  }
}

function validId(value) {
  return typeof value === "string" && /^[1-9]\d*$/.test(value);
}

async function workoutProposalRoutes(app) {
  // Create a pending AI workout proposal.
  app.post("/:id/proposals", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const planId = request.params.id;

    if (!validId(planId)) {
      return reply.code(400).send({
        error: "A valid workout plan ID is required.",
      });
    }

    const changeRequest = request.body?.change_request;

    if (
      typeof changeRequest !== "string" ||
      changeRequest.trim().length < 5 ||
      changeRequest.trim().length > 2000
    ) {
      return reply.code(400).send({
        error: "Change request must contain 5-2000 characters.",
      });
    }

    try {
      const sourceResult = await app.pgPool.query(
        `SELECT
           id,
           user_id,
           fitness_goal,
           experience_level,
           training_days_per_week,
           session_duration_minutes,
           workout_location,
           equipment,
           plan_data
         FROM workout_plans
         WHERE id = $1 AND user_id = $2`,
        [planId, request.user.sub]
      );

      if (sourceResult.rows.length === 0) {
        return reply.code(404).send({
          error: "Workout plan not found.",
        });
      }

      const source = sourceResult.rows[0];
      const profile = await getUserProfile(request.user.sub);

      if (!profile || !profile.activity_level) {
        return reply.code(400).send({
          error: "Please complete your activity level in your profile.",
        });
      }

      const constraints = {
        fitness_goal: source.fitness_goal,
        experience_level: source.experience_level,
        training_days_per_week: source.training_days_per_week,
        session_duration_minutes: source.session_duration_minutes,
        workout_location: source.workout_location,
        equipment: source.equipment || [],
        activity_level: profile.activity_level,
      };

      const originalSnapshot = {
        fitness_goal: source.fitness_goal,
        experience_level: source.experience_level,
        training_days_per_week: source.training_days_per_week,
        session_duration_minutes: source.session_duration_minutes,
        workout_location: source.workout_location,
        equipment: source.equipment || [],
        plan_data: source.plan_data,
      };

      const aiServiceUrl = (
        process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
      ).replace(/\/+$/, "");

      const aiResponse = await fetch(
        `${aiServiceUrl}/workout-coach/propose`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
          },
          body: JSON.stringify({
            change_request: changeRequest.trim(),
            current_plan: source.plan_data,
            constraints,
          }),
          signal: AbortSignal.timeout(45000),
        }
      );

      const aiResult = await aiResponse.json();

      if (!aiResponse.ok) {
        if (aiResponse.status === 422) {
          return reply.code(422).send({
            error: "The requested workout changes could not be validated.",
          });
        }

        if (aiResponse.status === 503) {
          return reply.code(503).send({
            error: "Workout coach is temporarily unavailable.",
          });
        }

        return reply.code(502).send({
          error: "Unable to generate a workout proposal.",
        });
      }

      const saved = await app.pgPool.query(
        `INSERT INTO workout_plan_proposals (
           user_id,
           source_workout_plan_id,
           original_plan_snapshot,
           proposed_plan_data
         )
         VALUES ($1, $2, $3::jsonb, $4::jsonb)
         RETURNING id, status, expires_at, created_at`,
        [
          request.user.sub,
          source.id,
          JSON.stringify(originalSnapshot),
          JSON.stringify(aiResult.proposed_plan),
        ]
      );

      return reply.code(201).send({
        message: "Workout proposal created. Your original plan is unchanged.",
        proposal: {
          ...saved.rows[0],
          summary: aiResult.summary,
          changes: aiResult.changes,
          proposed_plan: aiResult.proposed_plan,
        },
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Workout proposal creation failed."
      );

      if (
        error.name === "TimeoutError" ||
        error.name === "AbortError"
      ) {
        return reply.code(504).send({
          error: "Workout coach timed out. Please try again.",
        });
      }

      if (error.name === "TypeError") {
        return reply.code(503).send({
          error: "Workout coach service is unavailable.",
        });
      }

      return reply.code(500).send({
        error: "Unable to create workout proposal.",
      });
    }
  });

  // Approve a pending proposal and atomically create a new workout plan.
  app.post("/proposals/:proposalId/approve", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const proposalId = request.params.proposalId;

    if (!validId(proposalId)) {
      return reply.code(400).send({
        error: "A valid proposal ID is required.",
      });
    }

    let client;

    try {
      client = await app.pgPool.connect();
      await client.query("BEGIN");

      const proposalResult = await client.query(
        `SELECT *
         FROM workout_plan_proposals
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [proposalId, request.user.sub]
      );

      if (proposalResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({
          error: "Workout proposal not found.",
        });
      }

      const proposal = proposalResult.rows[0];

      if (proposal.status !== "pending") {
        await client.query("ROLLBACK");
        return reply.code(409).send({
          error: `This proposal has already been ${proposal.status}.`,
        });
      }

      if (new Date(proposal.expires_at) <= new Date()) {
        await client.query(
          `UPDATE workout_plan_proposals
           SET status = 'expired'
           WHERE id = $1 AND user_id = $2`,
          [proposalId, request.user.sub]
        );
        await client.query("COMMIT");

        return reply.code(410).send({
          error: "This proposal has expired. Please request a new proposal.",
        });
      }

      const sourceResult = await client.query(
        `SELECT
           id,
           user_id,
           fitness_goal,
           experience_level,
           training_days_per_week,
           session_duration_minutes,
           workout_location,
           equipment,
           plan_data
         FROM workout_plans
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [proposal.source_workout_plan_id, request.user.sub]
      );

      if (sourceResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({
          error: "The original workout plan no longer exists.",
        });
      }

      const source = sourceResult.rows[0];

      const currentSnapshot = {
        fitness_goal: source.fitness_goal,
        experience_level: source.experience_level,
        training_days_per_week: source.training_days_per_week,
        session_duration_minutes: source.session_duration_minutes,
        workout_location: source.workout_location,
        equipment: source.equipment || [],
        plan_data: source.plan_data,
      };

      if (!isDeepStrictEqual(currentSnapshot, proposal.original_plan_snapshot)) {
        await client.query(
          `UPDATE workout_plan_proposals
           SET status = 'expired'
           WHERE id = $1 AND user_id = $2`,
          [proposalId, request.user.sub]
        );
        await client.query("COMMIT");

        return reply.code(409).send({
          error: "The original workout has changed. Please create a new proposal.",
        });
      }

      const savedPlan = await client.query(
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
          source.fitness_goal,
          source.experience_level,
          source.training_days_per_week,
          source.session_duration_minutes,
          source.workout_location,
          JSON.stringify(source.equipment || []),
          JSON.stringify(proposal.proposed_plan_data),
        ]
      );

      await client.query(
        `UPDATE workout_plan_proposals
         SET status = 'approved',
             approved_workout_plan_id = $1,
             approved_at = NOW()
         WHERE id = $2 AND user_id = $3 AND status = 'pending'`,
        [savedPlan.rows[0].id, proposalId, request.user.sub]
      );

      await client.query("COMMIT");

      return reply.code(201).send({
        message: "Workout proposal approved. A new workout plan was created.",
        proposal_id: proposalId,
        status: "approved",
        workout_plan: {
          id: savedPlan.rows[0].id,
          created_at: savedPlan.rows[0].created_at,
          workout: proposal.proposed_plan_data,
        },
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      request.log.error(
        { err: error },
        "Workout proposal approval failed."
      );

      return reply.code(500).send({
        error: "Unable to approve this workout proposal.",
      });
    } finally {
      if (client) client.release();
    }
  });

  // Reject a pending proposal without changing any workout plan.
  app.post("/proposals/:proposalId/reject", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const proposalId = request.params.proposalId;

    if (!validId(proposalId)) {
      return reply.code(400).send({
        error: "A valid proposal ID is required.",
      });
    }

    let client;

    try {
      client = await app.pgPool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, status, expires_at
         FROM workout_plan_proposals
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [proposalId, request.user.sub]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({
          error: "Workout proposal not found.",
        });
      }

      const proposal = result.rows[0];

      if (proposal.status !== "pending") {
        await client.query("ROLLBACK");
        return reply.code(409).send({
          error: `This proposal has already been ${proposal.status}.`,
        });
      }

      if (new Date(proposal.expires_at) <= new Date()) {
        await client.query(
          `UPDATE workout_plan_proposals
           SET status = 'expired'
           WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
          [proposalId, request.user.sub]
        );

        await client.query("COMMIT");

        return reply.code(410).send({
          error: "This proposal has expired.",
        });
      }

      await client.query(
        `UPDATE workout_plan_proposals
         SET status = 'rejected'
         WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
        [proposalId, request.user.sub]
      );

      await client.query("COMMIT");

      return reply.code(200).send({
        message: "Workout proposal rejected. No workout plan was changed.",
        proposal_id: proposalId,
        status: "rejected",
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      request.log.error(
        { err: error },
        "Workout proposal rejection failed."
      );

      return reply.code(500).send({
        error: "Unable to reject this workout proposal.",
      });
    } finally {
      if (client) client.release();
    }
  });

  // List the authenticated user's workout proposals.
  app.get("/proposals", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const limit = Math.min(Math.max(Number.parseInt(request.query?.limit, 10) || 20, 1), 100);
    const offset = Math.max(Number.parseInt(request.query?.offset, 10) || 0, 0);

    try {
      const result = await app.pgPool.query(
        `SELECT
           id,
           source_workout_plan_id,
           status,
           expires_at,
           approved_workout_plan_id,
           created_at,
           approved_at,
           proposed_plan_data
         FROM workout_plan_proposals
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [request.user.sub, limit, offset]
      );

      return reply.code(200).send({
        proposals: result.rows,
        pagination: { limit, offset, count: result.rows.length },
      });
    } catch (error) {
      request.log.error({ err: error }, "Workout proposal listing failed.");
      return reply.code(500).send({
        error: "Unable to retrieve workout proposals.",
      });
    }
  });
}

module.exports = workoutProposalRoutes;
