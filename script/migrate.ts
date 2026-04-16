/**
 * migrate.ts
 *
 * Runs pending SQL migration files from the ./migrations directory
 * against the local SQLite database (data.db).
 *
 * Usage:
 *   npx tsx script/migrate.ts
 *
 * Safe to run multiple times — each migration is recorded in the
 * __migrations table and skipped if already applied.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.resolve("./data.db");
const MIGRATIONS_DIR = path.resolve("./migrations");

const db = new Database(DB_PATH);

// Ensure migrations tracking table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS __migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  )
`);

const applied = new Set(
  (db.prepare("SELECT filename FROM __migrations").all() as { filename: string }[])
    .map((r) => r.filename)
);

const files = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`  skip  ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

  // Split on semicolons so we can run each statement individually
  // (better-sqlite3 exec() handles multi-statement strings, but splitting
  //  is safer for ALTER TABLE sequences)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const runMigration = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt + ";");
    }
    db.prepare(
      "INSERT INTO __migrations (filename, applied_at) VALUES (?, ?)"
    ).run(file, new Date().toISOString());
  });

  try {
    runMigration();
    console.log(`  apply ${file}`);
    ran++;
  } catch (err) {
    console.error(`  ERROR in ${file}:`, err);
    process.exit(1);
  }
}

console.log(`\nDone. ${ran} migration(s) applied.`);
db.close();
