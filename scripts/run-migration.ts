/**
 * scripts/run-migration.ts
 *
 * Applies prisma/migrations/0001_init/migration.sql (triggers,
 * exclusion constraint, materialized view, functions) via the `pg`
 * driver — same reasoning as run-seed.ts, avoids needing `psql`
 * installed locally.
 *
 * Usage: npx tsx scripts/run-migration.ts
 */
import { Client } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { setDefaultResultOrder } from "dns";
import "dotenv/config";

setDefaultResultOrder("ipv4first");

async function main() {
  const sql = readFileSync(
    join(process.cwd(), "prisma", "migrations", "0001_init", "migration.sql"),
    "utf-8"
  );
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("Migration 0001_init applied successfully.");
  } catch (err) {
    // "already exists" errors are expected on a re-run (constraint,
    // triggers, materialized view aren't idempotent) — the functions
    // themselves use CREATE OR REPLACE so those always succeed.
    console.error(
      "Some statements may have failed with 'already exists' — that's expected on a re-run. Full error:",
      err
    );
  } finally {
    await client.end();
  }
}

main();
