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
      "004_create_chat_tables.sql"
    );

    const sql = fs
      .readFileSync(migrationPath, "utf8")
      .replace(/^\uFEFF/, "");

    await client.query("BEGIN");
    await client.query(sql);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('chat_conversations', 'chat_messages')
      ORDER BY table_name;
    `);

    if (tables.rows.length !== 2) {
      throw new Error("Chat tables verification failed.");
    }

    const indexes = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('chat_conversations', 'chat_messages')
      ORDER BY tablename, indexname;
    `);

    const expectedIndexes = [
      "idx_chat_conversations_user_updated",
      "idx_chat_messages_conversation_created"
    ];

    const actualIndexes = indexes.rows.map(row => row.indexname);

    for (const indexName of expectedIndexes) {
      if (!actualIndexes.includes(indexName)) {
        throw new Error(`Missing expected index: ${indexName}`);
      }
    }

    await client.query("COMMIT");

    console.log("Migration 004 executed successfully.");
    console.log("CHAT TABLES:");
    console.table(tables.rows);
    console.log("CHAT INDEXES:");
    console.table(indexes.rows);

  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Migration failed:", error.message);
    process.exitCode = 1;

  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
