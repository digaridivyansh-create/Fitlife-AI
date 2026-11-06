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

async function progressRoutes(app) {
  const isValidDateOnly = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
  // Record a dated weight measurement.
  app.post("/weight", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const body = request.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply.code(400).send({
        error: "A valid weight measurement is required.",
      });
    }

    const weight = body.weight_kg;

    if (
      typeof weight !== "number" ||
      !Number.isFinite(weight) ||
      weight < 20 ||
      weight > 500
    ) {
      return reply.code(400).send({
        error: "Weight must be a number between 20 and 500 kg.",
      });
    }

    let measuredAt = new Date();

    if (body.measured_at !== undefined) {
      if (
        typeof body.measured_at !== "string" ||
        body.measured_at.trim() === "" ||
        !Number.isFinite(Date.parse(body.measured_at))
      ) {
        return reply.code(400).send({
          error: "A valid measurement date is required.",
        });
      }

      measuredAt = new Date(body.measured_at);
    }

    const notes = body.notes ?? null;

    if (
      notes !== null &&
      (typeof notes !== "string" || notes.length > 500)
    ) {
      return reply.code(400).send({
        error: "Notes must be text containing at most 500 characters.",
      });
    }

    try {
      const result = await app.pgPool.query(
        `INSERT INTO weight_logs (
           user_id,
           weight_kg,
           measured_at,
           notes
         )
         VALUES ($1, $2, $3, $4)
         RETURNING id, weight_kg, measured_at, notes, created_at`,
        [
          request.user.sub,
          weight,
          measuredAt.toISOString(),
          notes,
        ]
      );

      return reply.code(201).send({
        message: "Weight measurement saved successfully.",
        measurement: result.rows[0],
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Weight measurement creation failed."
      );

      return reply.code(500).send({
        error: "Unable to save the weight measurement.",
      });
    }
  });

  // Retrieve only the authenticated user's weight history.
  app.get("/weight", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const limit = Number(request.query?.limit ?? 30);
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
           weight_kg,
           measured_at,
           notes,
           created_at
         FROM weight_logs
         WHERE user_id = $1
         ORDER BY measured_at DESC, id DESC
         LIMIT $2 OFFSET $3`,
        [request.user.sub, limit, offset]
      );

      return reply.code(200).send({
        count: result.rows.length,
        limit,
        offset,
        measurements: result.rows,
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Weight history retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve weight history.",
      });
    }
  });
// Record an actually completed workout session.
  app.post("/workouts", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const body = request.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply.code(400).send({
        error: "A valid completed workout is required.",
      });
    }

    const allowedFields = [
      "workout_name",
      "workout_plan_id",
      "completed_at",
      "duration_minutes",
      "perceived_effort",
      "calories_burned",
      "notes",
    ];

    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return reply.code(400).send({
        error: "The workout contains unsupported fields.",
      });
    }

    const workoutName = body.workout_name;
    const duration = body.duration_minutes;

    if (
      typeof workoutName !== "string" ||
      workoutName.trim().length < 1 ||
      workoutName.trim().length > 120
    ) {
      return reply.code(400).send({
        error: "Workout name must contain between 1 and 120 characters.",
      });
    }

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 600
    ) {
      return reply.code(400).send({
        error: "Workout duration must be between 1 and 600 minutes.",
      });
    }

    let planId = null;

    if (body.workout_plan_id !== undefined && body.workout_plan_id !== null) {
      const suppliedPlanId = String(body.workout_plan_id);

      if (!/^[1-9]\d*$/.test(suppliedPlanId)) {
        return reply.code(400).send({
          error: "A valid workout plan ID is required.",
        });
      }

      planId = suppliedPlanId;
    }

    let completedAt = new Date();

    if (body.completed_at !== undefined) {
      if (
        typeof body.completed_at !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.completed_at) ||
        !Number.isFinite(Date.parse(body.completed_at))
      ) {
        return reply.code(400).send({
          error: "Provide a valid completion date with a timezone.",
        });
      }

      completedAt = new Date(body.completed_at);
    }

    const effort = body.perceived_effort ?? null;

    if (
      effort !== null &&
      (!Number.isInteger(effort) || effort < 1 || effort > 10)
    ) {
      return reply.code(400).send({
        error: "Perceived effort must be an integer between 1 and 10.",
      });
    }

    const calories = body.calories_burned ?? null;

    if (
      calories !== null &&
      (typeof calories !== "number" ||
        !Number.isFinite(calories) ||
        calories < 0 ||
        calories > 5000)
    ) {
      return reply.code(400).send({
        error: "Calories burned must be between 0 and 5000.",
      });
    }

    const notes = body.notes ?? null;

    if (
      notes !== null &&
      (typeof notes !== "string" || notes.length > 1000)
    ) {
      return reply.code(400).send({
        error: "Workout notes must contain at most 1000 characters.",
      });
    }

    try {
      if (planId !== null) {
        const plan = await app.pgPool.query(
          `SELECT id
           FROM workout_plans
           WHERE id = $1 AND user_id = $2`,
          [planId, request.user.sub]
        );

        if (plan.rowCount === 0) {
          return reply.code(404).send({
            error: "Workout plan not found.",
          });
        }
      }

      const result = await app.pgPool.query(
        `INSERT INTO workout_logs (
           user_id,
           workout_plan_id,
           workout_name,
           completed_at,
           duration_minutes,
           perceived_effort,
           calories_burned,
           notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
           id,
           workout_plan_id,
           workout_name,
           completed_at,
           duration_minutes,
           perceived_effort,
           calories_burned,
           notes,
           created_at`,
        [
          request.user.sub,
          planId,
          workoutName.trim(),
          completedAt.toISOString(),
          duration,
          effort,
          calories,
          notes,
        ]
      );

      return reply.code(201).send({
        message: "Completed workout recorded successfully.",
        workout: result.rows[0],
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Completed workout creation failed."
      );

      return reply.code(500).send({
        error: "Unable to record the completed workout.",
      });
    }
  });

  // Retrieve only the authenticated user's completed workouts.
  app.get("/workouts", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const limit = Number(request.query?.limit ?? 30);
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
           wl.id,
           wl.workout_plan_id,
           wl.workout_name,
           wl.completed_at,
           wl.duration_minutes,
           wl.perceived_effort,
           wl.calories_burned,
           wl.notes,
           wl.created_at,
           wp.fitness_goal AS plan_fitness_goal,
           wp.experience_level AS plan_experience_level
         FROM workout_logs wl
         LEFT JOIN workout_plans wp
           ON wp.id = wl.workout_plan_id
          AND wp.user_id = wl.user_id
         WHERE wl.user_id = $1
         ORDER BY wl.completed_at DESC, wl.id DESC
         LIMIT $2 OFFSET $3`,
        [request.user.sub, limit, offset]
      );

      return reply.code(200).send({
        count: result.rows.length,
        limit,
        offset,
        workouts: result.rows,
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Completed workout history retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve completed workout history.",
      });
    }
  });
  // Create or partially update one day's progress without erasing omitted fields.
  app.put("/daily", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const body = request.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply.code(400).send({
        error: "A valid daily progress object is required.",
      });
    }

    const allowedFields = [
      "progress_date",
      "calorie_target",
      "protein_target_g",
      "steps",
      "water_ml",
      "sleep_hours",
      "notes",
    ];

    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return reply.code(400).send({
        error: "Daily progress contains unsupported fields.",
      });
    }

    if (
      body.progress_date !== undefined &&
      !isValidDateOnly(body.progress_date)
    ) {
      return reply.code(400).send({
        error: "Progress date must be a valid YYYY-MM-DD date.",
      });
    }

    const fields = {
      calorie_target: { min: 500, max: 15000, integer: false },
      protein_target_g: { min: 0, max: 1000, integer: false },
      steps: { min: 0, max: 200000, integer: true },
      water_ml: { min: 0, max: 20000, integer: true },
      sleep_hours: { min: 0, max: 24, integer: false },
    };

    const trackedFields = Object.keys(fields).concat("notes");

    if (!trackedFields.some((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    )) {
      return reply.code(400).send({
        error: "Provide at least one daily progress field to save.",
      });
    }

    for (const [field, rule] of Object.entries(fields)) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) continue;

      const value = body[field];

      if (
        value !== null &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < rule.min ||
          value > rule.max ||
          (rule.integer && !Number.isInteger(value)))
      ) {
        return reply.code(400).send({
          error: rule.integer
            ? field + " must be an integer between " + rule.min + " and " + rule.max + "."
            : field + " must be a number between " + rule.min + " and " + rule.max + ".",
        });
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(body, "notes") &&
      body.notes !== null &&
      (typeof body.notes !== "string" || body.notes.length > 1000)
    ) {
      return reply.code(400).send({
        error: "Daily notes must contain at most 1000 characters.",
      });
    }

    const has = (field) =>
      Object.prototype.hasOwnProperty.call(body, field);

    try {
      const result = await app.pgPool.query(
        `INSERT INTO daily_progress (
           user_id,
           progress_date,
           calorie_target,
           protein_target_g,
           steps,
           water_ml,
           sleep_hours,
           notes
         )
         VALUES (
           $1,
           COALESCE($2::date, CURRENT_DATE),
           $3, $4, $5, $6, $7, $8
         )
         ON CONFLICT (user_id, progress_date)
         DO UPDATE SET
           calorie_target = CASE WHEN $9 THEN EXCLUDED.calorie_target ELSE daily_progress.calorie_target END,
           protein_target_g = CASE WHEN $10 THEN EXCLUDED.protein_target_g ELSE daily_progress.protein_target_g END,
           steps = CASE WHEN $11 THEN EXCLUDED.steps ELSE daily_progress.steps END,
           water_ml = CASE WHEN $12 THEN EXCLUDED.water_ml ELSE daily_progress.water_ml END,
           sleep_hours = CASE WHEN $13 THEN EXCLUDED.sleep_hours ELSE daily_progress.sleep_hours END,
           notes = CASE WHEN $14 THEN EXCLUDED.notes ELSE daily_progress.notes END,
           updated_at = NOW()
         RETURNING
           id,
           progress_date,
           calorie_target,
           protein_target_g,
           steps,
           water_ml,
           sleep_hours,
           notes,
           created_at,
           updated_at`,
        [
          request.user.sub,
          body.progress_date ?? null,
          body.calorie_target ?? null,
          body.protein_target_g ?? null,
          body.steps ?? null,
          body.water_ml ?? null,
          body.sleep_hours ?? null,
          body.notes ?? null,
          has("calorie_target"),
          has("protein_target_g"),
          has("steps"),
          has("water_ml"),
          has("sleep_hours"),
          has("notes"),
        ]
      );

      return reply.code(200).send({
        message: "Daily progress saved successfully.",
        progress: result.rows[0],
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Daily progress save failed."
      );

      return reply.code(500).send({
        error: "Unable to save daily progress.",
      });
    }
  });

  // Retrieve only the authenticated user's daily progress history.
  app.get("/daily", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const query = request.query || {};
    const from = query.from;
    const to = query.to;
    const limit = Number(query.limit ?? 30);
    const offset = Number(query.offset ?? 0);

    if (
      (from !== undefined && !isValidDateOnly(from)) ||
      (to !== undefined && !isValidDateOnly(to))
    ) {
      return reply.code(400).send({
        error: "Date filters must use valid YYYY-MM-DD dates.",
      });
    }

    if (from !== undefined && to !== undefined && from > to) {
      return reply.code(400).send({
        error: "The from date cannot be later than the to date.",
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
        error: "Limit must be 1-100 and offset must be a non-negative integer.",
      });
    }

    try {
      const result = await app.pgPool.query(
        `SELECT
           id,
           progress_date,
           calorie_target,
           protein_target_g,
           steps,
           water_ml,
           sleep_hours,
           notes,
           created_at,
           updated_at
         FROM daily_progress
         WHERE user_id = $1
           AND ($2::date IS NULL OR progress_date >= $2::date)
           AND ($3::date IS NULL OR progress_date <= $3::date)
         ORDER BY progress_date DESC, id DESC
         LIMIT $4 OFFSET $5`,
        [
          request.user.sub,
          from ?? null,
          to ?? null,
          limit,
          offset,
        ]
      );

      return reply.code(200).send({
        count: result.rows.length,
        limit,
        offset,
        progress: result.rows,
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Daily progress history retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve daily progress history.",
      });
    }
  });

  // Return real progress data for the authenticated user.
  app.get("/summary", async (request, reply) => {
    if (!(await authenticate(request, reply))) return;

    const days = Number(request.query?.days ?? 30);

    if (![7, 30, 90].includes(days)) {
      return reply.code(400).send({
        error: "Days must be 7, 30, or 90.",
      });
    }

    const userId = request.user.sub;

    try {
      const [weightResult, workoutResult, dailyResult, mealResult] =
        await Promise.all([
          app.pgPool.query(
            `SELECT
               id,
               weight_kg,
               measured_at,
               notes
             FROM weight_logs
             WHERE user_id = $1
               AND measured_at >= (
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                 - ($2::integer - 1)
               ) AT TIME ZONE 'Asia/Kolkata'
             ORDER BY measured_at ASC, id ASC`,
            [userId, days]
          ),

          app.pgPool.query(
            `SELECT
               COUNT(*)::integer AS completed_workouts,
               COALESCE(SUM(duration_minutes), 0)::integer AS total_duration_minutes,
               ROUND(AVG(perceived_effort)::numeric, 2) AS average_perceived_effort,
               COUNT(calories_burned)::integer AS workouts_with_calorie_estimates,
               CASE
                 WHEN COUNT(*) = COUNT(calories_burned)
                 THEN SUM(calories_burned)
                 ELSE NULL
               END AS total_calories_burned
             FROM workout_logs
             WHERE user_id = $1
               AND completed_at >= (
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                 - ($2::integer - 1)
               ) AT TIME ZONE 'Asia/Kolkata'`,
            [userId, days]
          ),

          app.pgPool.query(
            `SELECT
               progress_date,
               calorie_target,
               protein_target_g,
               steps,
               water_ml,
               sleep_hours,
               notes,
               updated_at
             FROM daily_progress
             WHERE user_id = $1
               AND progress_date >= (
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                 - ($2::integer - 1)
               )
               AND progress_date <= (
                 CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'
               )::date
             ORDER BY progress_date ASC`,
            [userId, days]
          ),

          app.pgPool.query(
            `SELECT
               (m.consumed_at AT TIME ZONE 'Asia/Kolkata')::date AS meal_date,
               COUNT(DISTINCT m.id)::integer AS meal_count,
               COUNT(mi.id)::integer AS food_item_count,

               COUNT(mi.calories)::integer AS items_with_calories,
               COUNT(mi.protein_g)::integer AS items_with_protein,
               COUNT(mi.carbohydrates_g)::integer AS items_with_carbs,
               COUNT(mi.fat_g)::integer AS items_with_fat,

               CASE
                 WHEN COUNT(mi.id) = COUNT(mi.calories)
                 THEN SUM(mi.calories)
                 ELSE NULL
               END AS total_calories,

               CASE
                 WHEN COUNT(mi.id) = COUNT(mi.protein_g)
                 THEN SUM(mi.protein_g)
                 ELSE NULL
               END AS total_protein_g,

               CASE
                 WHEN COUNT(mi.id) = COUNT(mi.carbohydrates_g)
                 THEN SUM(mi.carbohydrates_g)
                 ELSE NULL
               END AS total_carbohydrates_g,

               CASE
                 WHEN COUNT(mi.id) = COUNT(mi.fat_g)
                 THEN SUM(mi.fat_g)
                 ELSE NULL
               END AS total_fat_g

             FROM meals m
             LEFT JOIN meal_items mi ON mi.meal_id = m.id
             WHERE m.user_id = $1
               AND m.consumed_at >= (
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                 - ($2::integer - 1)
               ) AT TIME ZONE 'Asia/Kolkata'
               AND m.consumed_at < (
                 (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
                 + 1
               ) AT TIME ZONE 'Asia/Kolkata'
             GROUP BY (m.consumed_at AT TIME ZONE 'Asia/Kolkata')::date
             ORDER BY meal_date ASC`,
            [userId, days]
          ),
        ]);

      const workout = workoutResult.rows[0];

      return reply.code(200).send({
        period_days: days,
        timezone: "Asia/Kolkata",

        weight: {
          measurement_count: weightResult.rows.length,
          measurements: weightResult.rows,
        },

        workouts: {
          completed_workouts: workout.completed_workouts,
          total_duration_minutes: workout.total_duration_minutes,
          average_perceived_effort: workout.average_perceived_effort,
          workouts_with_calorie_estimates:
            workout.workouts_with_calorie_estimates,
          total_calories_burned: workout.total_calories_burned,
        },

        daily_tracking: {
          recorded_days: dailyResult.rows.length,
          entries: dailyResult.rows,
        },

        nutrition: {
          recorded_meal_days: mealResult.rows.length,
          daily_totals: mealResult.rows,
          nutrient_completeness_note:
            "A nutrient total is null when one or more food items that day have an unknown value for that nutrient.",
        },
      });
    } catch (error) {
      request.log.error(
        { err: error },
        "Progress summary retrieval failed."
      );

      return reply.code(500).send({
        error: "Unable to retrieve progress summary.",
      });
    }
  });


  // Generate AI insights from this user's actual database-backed summary.
  app.get(
    "/insights",
    {
      onRequest: authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const days = Number(request.query?.days ?? 30);

      if (![7, 30, 90].includes(days)) {
        return reply.code(400).send({
          error: "Days must be 7, 30, or 90.",
        });
      }

      if (!process.env.AI_SERVICE_TOKEN) {
        request.log.error("AI service authentication is not configured.");

        return reply.code(503).send({
          error: "Progress insights service is temporarily unavailable.",
        });
      }

      try {
        // Reuse the existing authenticated summary route.
        const summaryResponse = await app.inject({
          method: "GET",
          url: `/api/progress/summary?days=${days}`,
          headers: {
            authorization: request.headers.authorization || "",
          },
        });

        if (summaryResponse.statusCode !== 200) {
          request.log.error(
            { statusCode: summaryResponse.statusCode },
            "Progress summary could not be retrieved for AI analysis."
          );

          return reply.code(500).send({
            error: "Unable to retrieve progress data for analysis.",
          });
        }

        const summary = summaryResponse.json();

        const aiServiceUrl = (
          process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
        ).replace(/\/+$/, "");

        let aiResponse;

        try {
          const response = await fetch(
            `${aiServiceUrl}/progress/insights`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
              },
              body: JSON.stringify(summary),
              signal: AbortSignal.timeout(120000),
            }
          );

          if (!response.ok) {
            request.log.error(
              { statusCode: response.status },
              "Progress insights AI service returned an unsuccessful response."
            );

            return reply.code(503).send({
              error: "Progress insights are temporarily unavailable. Please try again.",
            });
          }

          aiResponse = await response.json();
        } catch (error) {
          request.log.error(
            { name: error.name },
            "Progress insights AI service request failed."
          );

          return reply.code(503).send({
            error: "Progress insights are temporarily unavailable. Please try again.",
          });
        }

        if (
          !aiResponse ||
          typeof aiResponse.headline !== "string" ||
          typeof aiResponse.summary !== "string" ||
          !Array.isArray(aiResponse.observations) ||
          !Array.isArray(aiResponse.recommendations) ||
          !Array.isArray(aiResponse.data_gaps)
        ) {
          request.log.error("Progress insights AI service returned an invalid response.");

          return reply.code(503).send({
            error: "Progress insights service returned an invalid response.",
          });
        }

        return reply.code(200).send({
          progress_summary: summary,
          insights: aiResponse,
        });
      } catch (error) {
        request.log.error(
          { err: error },
          "Progress insights generation failed."
        );

        return reply.code(500).send({
          error: "Unable to generate progress insights.",
        });
      }
    }
  );

}

module.exports = progressRoutes;

