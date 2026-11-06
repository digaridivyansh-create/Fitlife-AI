const argon2 = require("argon2");
const pool = require("../config/database");

async function registerUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [normalizedEmail]
  );

  if (existing.rowCount > 0) {
    const error = new Error("An account with this email already exists.");
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const result = await pool.query(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id, email, created_at`,
    [normalizedEmail, passwordHash]
  );

  return result.rows[0];
}

async function verifyUserPassword(email, password) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    `SELECT id, email, password_hash, is_active
     FROM users
     WHERE email = $1`,
    [normalizedEmail]
  );

  if (result.rowCount === 0 || !result.rows[0].is_active) {
    return null;
  }

  const user = result.rows[0];
  const validPassword = await argon2.verify(
    user.password_hash,
    password
  );

  if (!validPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}

module.exports = {
  registerUser,
  verifyUserPassword,
};
