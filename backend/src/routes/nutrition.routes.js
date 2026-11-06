const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

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

async function nutritionRoutes(app) {
  app.post(
    "/analyze",
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
      let file;

      try {
        if (!request.isMultipart()) {
          return reply.code(400).send({
            error: "A food image is required.",
          });
        }

        file = await request.file();

        if (!file) {
          return reply.code(400).send({
            error: "A food image is required.",
          });
        }

        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          return reply.code(415).send({
            error: "Upload a JPEG, PNG, WEBP, or AVIF image.",
          });
        }

        const imageBuffer = await file.toBuffer();

        if (!imageBuffer.length) {
          return reply.code(400).send({
            error: "Uploaded image is empty.",
          });
        }

        const aiServiceUrl = (
          process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
        ).replace(/\/+$/, "");

        if (!process.env.AI_SERVICE_TOKEN) {
          request.log.error("AI service token is not configured.");

          return reply.code(503).send({
            error: "Nutrition service is not configured.",
          });
        }

        const form = new FormData();

        form.append(
          "image",
          new Blob([imageBuffer], { type: file.mimetype }),
          file.filename || "meal-image"
        );

        const response = await fetch(
          `${aiServiceUrl}/food/analyze`,
          {
            method: "POST",
            headers: {
              "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
            },
            body: form,
            signal: AbortSignal.timeout(180000),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          request.log.error(
            { statusCode: response.status },
            "AI nutrition service rejected the request."
          );

          if (response.status === 401) {
            return reply.code(503).send({
              error: "Nutrition service authentication failed.",
            });
          }

          if ([400, 413, 415, 422].includes(response.status)) {
            return reply.code(response.status).send(result);
          }

          return reply.code(503).send({
            error: "Nutrition analysis is temporarily unavailable.",
          });
        }

        return reply.code(200).send({
          message: "Food image analyzed successfully. Review the food matches and portions.",
          analysis: result,
        });
      } catch (error) {
        if (error.code === "FST_REQ_FILE_TOO_LARGE") {
          return reply.code(413).send({
            error: "Image exceeds the 10 MB upload limit.",
          });
        }

        request.log.error(
          { err: error },
          "Nutrition image analysis failed."
        );

        if (
          error.name === "TimeoutError" ||
          error.name === "AbortError"
        ) {
          return reply.code(504).send({
            error: "Nutrition analysis timed out. Please try again.",
          });
        }

        if (error.name === "TypeError") {
          return reply.code(503).send({
            error: "Nutrition service is currently unavailable.",
          });
        }

        return reply.code(500).send({
          error: "Unable to analyze the food image.",
        });
      }
    }
  );
  // List only the authenticated user's saved meals.
  app.get(
    "/history",
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
      const page = Math.max(1, Number.parseInt(request.query?.page, 10) || 1);
      const limit = Math.min(
        50,
        Math.max(1, Number.parseInt(request.query?.limit, 10) || 10)
      );
      const offset = (page - 1) * limit;

      try {
        const result = await app.pgPool.query(
          `SELECT
             m.id,
             m.meal_name,
             m.consumed_at,
             m.created_at,
             COUNT(mi.id)::INTEGER AS item_count,
             COALESCE(SUM(mi.calories), 0)::NUMERIC(12, 2) AS calories,
             COALESCE(SUM(mi.protein_g), 0)::NUMERIC(12, 2) AS protein_g,
             COALESCE(SUM(mi.carbohydrates_g), 0)::NUMERIC(12, 2) AS carbohydrates_g,
             COALESCE(SUM(mi.fat_g), 0)::NUMERIC(12, 2) AS fat_g,
             COUNT(mi.calories)::INTEGER AS calories_count,
             COUNT(mi.protein_g)::INTEGER AS protein_count,
             COUNT(mi.carbohydrates_g)::INTEGER AS carbohydrates_count,
             COUNT(mi.fat_g)::INTEGER AS fat_count
           FROM meals m
           LEFT JOIN meal_items mi ON mi.meal_id = m.id
           WHERE m.user_id = $1
           GROUP BY m.id
           ORDER BY m.consumed_at DESC, m.id DESC
           LIMIT $2 OFFSET $3`,
          [request.user.sub, limit, offset]
        );

        const countResult = await app.pgPool.query(
          "SELECT COUNT(*)::INTEGER AS total FROM meals WHERE user_id = $1",
          [request.user.sub]
        );

        const meals = result.rows.map((meal) => ({
          id: meal.id,
          meal_name: meal.meal_name,
          consumed_at: meal.consumed_at,
          created_at: meal.created_at,
          item_count: meal.item_count,
          meal_totals: {
            calories: meal.calories_count === meal.item_count
              ? Number(meal.calories)
              : null,
            protein: meal.protein_count === meal.item_count
              ? Number(meal.protein_g)
              : null,
            carbohydrates: meal.carbohydrates_count === meal.item_count
              ? Number(meal.carbohydrates_g)
              : null,
            fat: meal.fat_count === meal.item_count
              ? Number(meal.fat_g)
              : null,
          },
        }));

        const total = countResult.rows[0].total;

        return reply.send({
          meals,
          pagination: {
            page,
            limit,
            total,
            total_pages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        request.log.error({ err: error }, "Meal history retrieval failed.");

        return reply.code(500).send({
          error: "Unable to retrieve meal history.",
        });
      }
    }
  );

  // Retrieve one meal only when it belongs to the authenticated user.
  app.get(
    "/history/:id",
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
      const mealId = Number(request.params.id);

      if (!Number.isSafeInteger(mealId) || mealId <= 0) {
        return reply.code(400).send({
          error: "A valid meal ID is required.",
        });
      }

      try {
        const mealResult = await app.pgPool.query(
          `SELECT id, meal_name, consumed_at, created_at
           FROM meals
           WHERE id = $1 AND user_id = $2`,
          [mealId, request.user.sub]
        );

        if (mealResult.rowCount === 0) {
          return reply.code(404).send({
            error: "Meal not found.",
          });
        }

        const itemsResult = await app.pgPool.query(
          `SELECT
             id,
             meal_id,
             food_name,
             fdc_id,
             usda_description,
             serving_weight_g,
             calories,
             protein_g,
             carbohydrates_g,
             fat_g,
             nutrition_source,
             created_at
           FROM meal_items
           WHERE meal_id = $1
           ORDER BY id ASC`,
          [mealId]
        );

        const items = itemsResult.rows;
        const totalFor = (field) => {
          const values = items.map((item) => item[field]);

          if (values.some((value) => value === null)) {
            return null;
          }

          return Number(
            values.reduce((sum, value) => sum + Number(value), 0).toFixed(2)
          );
        };

        return reply.send({
          meal: mealResult.rows[0],
          items,
          meal_totals: {
            calories: totalFor("calories"),
            protein: totalFor("protein_g"),
            carbohydrates: totalFor("carbohydrates_g"),
            fat: totalFor("fat_g"),
          },
        });
      } catch (error) {
        request.log.error({ err: error }, "Meal detail retrieval failed.");

        return reply.code(500).send({
          error: "Unable to retrieve meal details.",
        });
      }
    }
  );
  // Confirm food portions, retrieve USDA nutrition, and save the meal.
  app.post(
    "/confirm",
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
      const body = request.body;

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !Array.isArray(body.items) ||
        body.items.length < 1 ||
        body.items.length > 20
      ) {
        return reply.code(400).send({
          error: "Provide between 1 and 20 confirmed food items.",
        });
      }

      const mealName =
        typeof body.meal_name === "string"
          ? body.meal_name.trim()
          : null;

      if (
        mealName !== null &&
        (mealName.length < 1 || mealName.length > 120)
      ) {
        return reply.code(400).send({
          error: "Meal name must contain between 1 and 120 characters.",
        });
      }

      const items = [];

      for (const item of body.items) {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.food_name !== "string" ||
          item.food_name.trim().length < 1 ||
          item.food_name.trim().length > 200 ||
          !Number.isSafeInteger(item.fdc_id) ||
          item.fdc_id <= 0 ||
          typeof item.serving_weight_g !== "number" ||
          !Number.isFinite(item.serving_weight_g) ||
          item.serving_weight_g <= 0 ||
          item.serving_weight_g > 5000
        ) {
          return reply.code(400).send({
            error: "Each item needs a valid food name, USDA FDC ID, and serving weight.",
          });
        }

        items.push({
          food_name: item.food_name.trim(),
          fdc_id: item.fdc_id,
          serving_weight_g: item.serving_weight_g,
        });
      }

      if (!process.env.AI_SERVICE_TOKEN) {
        request.log.error("AI service token is not configured.");

        return reply.code(503).send({
          error: "Nutrition service is not configured.",
        });
      }

      const aiServiceUrl = (
        process.env.AI_SERVICE_URL || "http://127.0.0.1:8001"
      ).replace(/\/+$/, "");

      let client;

      try {
        const response = await fetch(
          `${aiServiceUrl}/food/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-AI-Service-Token": process.env.AI_SERVICE_TOKEN,
            },
            body: JSON.stringify({ items }),
            signal: AbortSignal.timeout(180000),
          }
        );

        let result;

        try {
          result = await response.json();
        } catch {
          request.log.error(
            "AI nutrition service returned an invalid response."
          );

          return reply.code(503).send({
            error: "Nutrition service returned an invalid response.",
          });
        }

        if (!response.ok) {
          request.log.error(
            { statusCode: response.status },
            "AI food confirmation service rejected the request."
          );

          if (response.status === 401) {
            return reply.code(503).send({
              error: "Nutrition service authentication failed.",
            });
          }

          if ([400, 422].includes(response.status)) {
            return reply.code(400).send({
              error: "The selected food information could not be validated.",
            });
          }

          return reply.code(503).send({
            error: "USDA nutrition data is temporarily unavailable.",
          });
        }

        if (
          result.status !== "confirmation_calculated" ||
          !Array.isArray(result.items) ||
          result.items.length !== items.length ||
          !result.meal_totals
        ) {
          request.log.error(
            "AI nutrition service returned an incomplete confirmation result."
          );

          return reply.code(503).send({
            error: "Nutrition service returned incomplete data.",
          });
        }

        const nutrientNames = [
          "calories",
          "protein",
          "carbohydrates",
          "fat",
        ];

        for (let index = 0; index < result.items.length; index += 1) {
          const confirmed = result.items[index];
          const submitted = items[index];

          if (
            confirmed.fdc_id !== submitted.fdc_id ||
            typeof confirmed.usda_description !== "string" ||
            confirmed.usda_description.trim().length === 0 ||
            confirmed.serving_weight_g !== submitted.serving_weight_g ||
            !confirmed.nutrients ||
            typeof confirmed.nutrients !== "object"
          ) {
            request.log.error(
              "AI nutrition service returned mismatched food data."
            );

            return reply.code(503).send({
              error: "Nutrition service returned mismatched food data.",
            });
          }

          for (const nutrient of nutrientNames) {
            const value = confirmed.nutrients[nutrient];

            if (
              value !== null &&
              (
                typeof value !== "number" ||
                !Number.isFinite(value) ||
                value < 0
              )
            ) {
              return reply.code(503).send({
                error: "Nutrition service returned invalid nutrient values.",
              });
            }
          }
        }

        // Persist the meal and all items in one atomic transaction.
        client = await app.pgPool.connect();

        try {
          await client.query("BEGIN");

          const mealResult = await client.query(
            `INSERT INTO meals (
               user_id,
               meal_name
             )
             VALUES ($1, $2)
             RETURNING id, meal_name, consumed_at, created_at`,
            [
              request.user.sub,
              mealName,
            ]
          );

          const meal = mealResult.rows[0];
          const savedItems = [];

          for (let index = 0; index < result.items.length; index += 1) {
            const confirmed = result.items[index];
            const submitted = items[index];
            const nutrients = confirmed.nutrients;

            const itemResult = await client.query(
              `INSERT INTO meal_items (
                 meal_id,
                 food_name,
                 fdc_id,
                 usda_description,
                 serving_weight_g,
                 calories,
                 protein_g,
                 carbohydrates_g,
                 fat_g,
                 nutrition_source
               )
               VALUES (
                 $1, $2, $3, $4, $5,
                 $6, $7, $8, $9, $10
               )
               RETURNING *`,
              [
                meal.id,
                submitted.food_name,
                confirmed.fdc_id,
                confirmed.usda_description,
                confirmed.serving_weight_g,
                nutrients.calories,
                nutrients.protein,
                nutrients.carbohydrates,
                nutrients.fat,
                confirmed.nutrition_source || "USDA FoodData Central",
              ]
            );

            savedItems.push(itemResult.rows[0]);
          }

          await client.query("COMMIT");

          return reply.code(201).send({
            message: "Confirmed meal calculated and saved successfully.",
            meal,
            items: savedItems,
            meal_totals: result.meal_totals,
            disclaimer: result.disclaimer,
          });
        } catch (databaseError) {
          await client.query("ROLLBACK");

          throw databaseError;
        } finally {
          client.release();
          client = null;
        }
      } catch (error) {
        if (client) {
          client.release();
        }

        request.log.error(
          { err: error },
          "Meal confirmation or persistence failed."
        );

        if (
          error.name === "TimeoutError" ||
          error.name === "AbortError"
        ) {
          return reply.code(504).send({
            error: "Nutrition confirmation timed out. Please try again.",
          });
        }

        if (error.name === "TypeError") {
          return reply.code(503).send({
            error: "Nutrition service is currently unavailable.",
          });
        }

        return reply.code(500).send({
          error: "Unable to confirm and save this meal.",
        });
      }
    }
  );
}


module.exports = nutritionRoutes;


