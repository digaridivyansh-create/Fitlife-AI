const pool = require("../config/database");

const FITNESS_GOALS = [
  "weight_loss",
  "muscle_gain",
  "endurance",
  "general_fitness",
];

const ACTIVITY_LEVELS = [
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extra_active",
];

async function getUserProfile(userId) {
  const result = await pool.query(
    `SELECT
       u.id,
       u.email,
       p.full_name,
       p.date_of_birth,
       p.height_cm,
       p.weight_kg,
       p.fitness_goal,
       p.activity_level
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1 AND u.is_active = TRUE`,
    [userId]
  );

  return result.rows[0] || null;
}

async function saveUserProfile(userId, profile) {
  const {
    full_name,
    date_of_birth,
    height_cm,
    weight_kg,
    fitness_goal,
    activity_level,
  } = profile;

  await pool.query(
    `INSERT INTO user_profiles (
       user_id,
       full_name,
       date_of_birth,
       height_cm,
       weight_kg,
       fitness_goal,
       activity_level
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id)
     DO UPDATE SET
       full_name = EXCLUDED.full_name,
       date_of_birth = EXCLUDED.date_of_birth,
       height_cm = EXCLUDED.height_cm,
       weight_kg = EXCLUDED.weight_kg,
       fitness_goal = EXCLUDED.fitness_goal,
       activity_level = EXCLUDED.activity_level,
       updated_at = NOW()`,
    [
      userId,
      full_name,
      date_of_birth,
      height_cm,
      weight_kg,
      fitness_goal,
      activity_level,
    ]
  );

  return getUserProfile(userId);
}

module.exports = {
  getUserProfile,
  saveUserProfile,
  FITNESS_GOALS,
  ACTIVITY_LEVELS,
};
