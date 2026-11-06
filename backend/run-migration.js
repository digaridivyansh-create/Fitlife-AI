require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("./src/config/database");

async function runMigration() {
  const migrationPath = path.join(
    __dirname,
    "src",
    "database",
    "migrations",
    "001_create_users_and_profiles.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query(sql);
    console.log("Migration 001 executed successfully.");

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log("DATABASE TABLES:");
    console.table(result.rows);
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
