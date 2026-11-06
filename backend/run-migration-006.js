require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const fs = require("fs");
const path = require("path");
const pool = require("./src/config/database");

async function runMigration() {
  let client;

  try {
    client = await pool.connect();

    const migrationPath = path.join(
      __dirname,
      "src",
      "database",
      "migrations",
      "006_create_workout_plan_proposals.sql"
    );

    const sql = fs
      .readFileSync(migrationPath, "utf8")
      .replace(/^\uFEFF/, "");

    await client.query(sql);

    const table = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'workout_plan_proposals';
    `);

    if (table.rows.length !== 1) {
      throw new Error("Workout proposal table verification failed.");
    }

    const constraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.workout_plan_proposals'::regclass
        AND conname IN (
          'fk_proposal_owned_source_plan',
          'fk_proposal_owned_approved_plan',
          'workout_proposal_approval_consistency'
        )
      ORDER BY conname;
    `);

    const expectedConstraints = [
      "fk_proposal_owned_source_plan",
      "fk_proposal_owned_approved_plan",
      "workout_proposal_approval_consistency"
    ];

    const actualConstraints = constraints.rows.map(row => row.conname);

    for (const name of expectedConstraints) {
      if (!actualConstraints.includes(name)) {
        throw new Error(`Missing expected constraint: ${name}`);
      }
    }

    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'workout_plan_proposals'
        AND indexname IN (
          'idx_workout_proposals_user_status',
          'idx_workout_proposals_expiry'
        )
      ORDER BY indexname;
    `);

    if (indexes.rows.length !== 2) {
      throw new Error("Workout proposal index verification failed.");
    }

    console.log("Migration 006 executed successfully.");
    console.log("VERIFIED TABLE:");
    console.table(table.rows);
    console.log("VERIFIED CONSTRAINTS:");
    console.table(constraints.rows);
    console.log("VERIFIED INDEXES:");
    console.table(indexes.rows);

  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;

  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
