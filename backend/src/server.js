require("dotenv").config();

const Fastify = require("fastify");
const helmet = require("@fastify/helmet");
const cors = require("@fastify/cors");
const jwt = require("@fastify/jwt");
const rateLimit = require("@fastify/rate-limit");
const multipart = require("@fastify/multipart");
const pool = require("./config/database");
const authRoutes = require("./routes/auth.routes");
const workoutRoutes = require("./routes/workout.routes");
const workoutProposalRoutes = require("./routes/workout-proposal.routes");
const nutritionRoutes = require("./routes/nutrition.routes");
const chatRoutes = require("./routes/chat.routes");
const progressRoutes = require("./routes/progress.routes");
const formAnalysisRoutes = require("./routes/form-analysis.routes");

const app = Fastify({
  logger: true,
  trustProxy: false,
});

// Make the existing PostgreSQL pool available to routes.
app.decorate("pgPool", pool);

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 40) {
    throw new Error("JWT_SECRET is missing or too short.");
  }

  await app.register(helmet);

  await app.register(cors, {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 0,
    },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET,
  });

  app.get("/", async () => ({
    message: "FitLife AI backend is running",
    service: "FitLife AI API",
  }));

  app.get("/api/health", async (request, reply) => {
    try {
      const result = await pool.query(
        "SELECT current_database() AS database, NOW() AS server_time"
      );

      return {
        status: "healthy",
        service: "FitLife AI API",
        database: {
          status: "connected",
          name: result.rows[0].database,
        },
        timestamp: result.rows[0].server_time,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(503).send({
        status: "unhealthy",
        database: "disconnected",
      });
    }
  });

  await app.register(authRoutes, {
    prefix: "/api/auth",
  });

  await app.register(workoutRoutes, {
    prefix: "/api/workouts",
  });

  await app.register(workoutProposalRoutes, {
    prefix: "/api/workouts",
  });

  await app.register(nutritionRoutes, {
    prefix: "/api/nutrition",
  });
  await app.register(chatRoutes, {
    prefix: "/api/chat",
  });

  await app.register(progressRoutes, {
    prefix: "/api/progress",
  });
  await app.register(formAnalysisRoutes, {
    prefix: "/api/form-analysis",
  });

  const port = Number(process.env.PORT || 5000);
  const host = process.env.HOST || "127.0.0.1";

  await app.listen({ port, host });
}

async function shutdown(signal) {
  app.log.info(`${signal} received. Shutting down...`);

  try {
    await app.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch(async (error) => {
  app.log.error(error);
  await pool.end();
  process.exit(1);
});




