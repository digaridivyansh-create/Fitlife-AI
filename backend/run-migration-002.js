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
    "002_create_workout_plans.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    await pool.query("BEGIN");
    await pool.query(sql);
    await pool.query("COMMIT");

    console.log("Migration 002 executed successfully.");

    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'workout_plans'
      ORDER BY ordinal_position;
    `);

    console.log("WORKOUT_PLANS TABLE STRUCTURE:");
    console.table(result.rows);

    const indexResult = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'workout_plans';
    `);

    console.log("WORKOUT_PLANS INDEXES:");
    console.table(indexResult.rows);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
