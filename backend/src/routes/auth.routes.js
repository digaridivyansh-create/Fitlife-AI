const {
  registerUser,
  verifyUserPassword,
} = require("../services/auth.service");

const {
  getUserProfile,
  saveUserProfile,
  FITNESS_GOALS,
  ACTIVITY_LEVELS,
} = require("../services/profile.service");

async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({
      error: "Authentication required.",
    });
  }
}

function validateProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return "A valid profile object is required.";
  }

  const allowedFields = [
    "full_name",
    "date_of_birth",
    "height_cm",
    "weight_kg",
    "fitness_goal",
    "activity_level",
  ];

  if (Object.keys(profile).some((key) => !allowedFields.includes(key))) {
    return "The profile contains unsupported fields.";
  }

  const {
    full_name,
    date_of_birth,
    height_cm,
    weight_kg,
    fitness_goal,
    activity_level,
  } = profile;

  if (
    full_name !== undefined &&
    (typeof full_name !== "string" ||
      full_name.trim().length < 2 ||
      full_name.trim().length > 120)
  ) {
    return "Full name must contain between 2 and 120 characters.";
  }

  if (
    date_of_birth !== undefined &&
    (typeof date_of_birth !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth) ||
      new Date(`${date_of_birth}T00:00:00.000Z`).toISOString().slice(0, 10) !== date_of_birth ||
      new Date(`${date_of_birth}T00:00:00.000Z`) >= new Date())
  ) {
    return "Enter a valid date of birth in YYYY-MM-DD format.";
  }

  if (
    height_cm !== undefined &&
    (typeof height_cm !== "number" ||
      !Number.isFinite(height_cm) ||
      height_cm < 50 ||
      height_cm > 300)
  ) {
    return "Height must be between 50 and 300 cm.";
  }

  if (
    weight_kg !== undefined &&
    (typeof weight_kg !== "number" ||
      !Number.isFinite(weight_kg) ||
      weight_kg < 10 ||
      weight_kg > 500)
  ) {
    return "Weight must be between 10 and 500 kg.";
  }

  if (
    fitness_goal !== undefined &&
    !FITNESS_GOALS.includes(fitness_goal)
  ) {
    return "Choose a valid fitness goal.";
  }

  if (
    activity_level !== undefined &&
    !ACTIVITY_LEVELS.includes(activity_level)
  ) {
    return "Choose a valid activity level.";
  }

  return null;
}

async function authRoutes(app) {
  app.post("/register", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 minute" },
    },
  }, async (request, reply) => {
    const { email, password } = request.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return reply.code(400).send({
        error: "Enter a valid email and a password between 8 and 128 characters.",
      });
    }

    try {
      const user = await registerUser({ email, password });

      const token = app.jwt.sign(
        { sub: String(user.id), email: user.email },
        { expiresIn: "1h" }
      );

      return reply.code(201).send({
        message: "Account created successfully.",
        user,
        token,
      });
    } catch (error) {
      if (error.code === "23505") {
        return reply.code(409).send({
          error: "An account with this email already exists.",
        });
      }

      request.log.error(error);
      return reply.code(error.statusCode || 500).send({
        error: error.statusCode ? error.message : "Registration failed.",
      });
    }
  });

  app.post("/login", {
    config: {
      rateLimit: { max: 5, timeWindow: "1 minute" },
    },
  }, async (request, reply) => {
    const { email, password } = request.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.trim().length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length === 0 ||
      password.length > 128
    ) {
      return reply.code(400).send({
        error: "Enter a valid email and password.",
      });
    }

    try {
      const user = await verifyUserPassword(email, password);

      if (!user) {
        return reply.code(401).send({
          error: "Invalid email or password.",
        });
      }

      const token = app.jwt.sign(
        { sub: String(user.id), email: user.email },
        { expiresIn: "1h" }
      );

      return {
        message: "Login successful.",
        user,
        token,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Login failed.",
      });
    }
  });

  app.get("/me", { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await app.pgPool.query(
        `SELECT u.id, u.email, u.created_at,
                p.full_name, p.date_of_birth, p.height_cm,
                p.weight_kg, p.fitness_goal, p.activity_level
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = $1 AND u.is_active = TRUE`,
        [request.user.sub]
      );

      if (result.rowCount === 0) {
        return reply.code(404).send({
          error: "User account not found.",
        });
      }

      return { user: result.rows[0] };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Could not retrieve user profile.",
      });
    }
  });

  app.get("/profile", { preHandler: authenticate }, async (request, reply) => {
    try {
      const profile = await getUserProfile(request.user.sub);

      if (!profile) {
        return reply.code(404).send({
          error: "User account not found.",
        });
      }

      return { profile };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Could not retrieve profile.",
      });
    }
  });

  app.put("/profile", { preHandler: authenticate }, async (request, reply) => {
    const validationError = validateProfile(request.body);

    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    const profile = {
      full_name: request.body.full_name?.trim() ?? null,
      date_of_birth: request.body.date_of_birth ?? null,
      height_cm: request.body.height_cm ?? null,
      weight_kg: request.body.weight_kg ?? null,
      fitness_goal: request.body.fitness_goal ?? null,
      activity_level: request.body.activity_level ?? null,
    };

    try {
      const savedProfile = await saveUserProfile(
        request.user.sub,
        profile
      );

      if (!savedProfile) {
        return reply.code(404).send({
          error: "User account not found.",
        });
      }

      return {
        message: "Profile saved successfully.",
        profile: savedProfile,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: "Could not save profile.",
      });
    }
  });
}

module.exports = authRoutes;
