/**
 * scripts/run-seed.ts
 *
 * Runs prisma/seed.sql directly via the `pg` driver instead of
 * requiring the `psql` CLI locally (useful on machines that only use
 * Neon remotely and never installed Postgres client tools).
 *
 * Uses `pg` (not Prisma) because seed.sql contains a DO $$ ... $$
 * block, and Prisma's query engine only reliably runs one statement
 * per call — `pg`'s simple query protocol runs the whole file as-is,
 * same as psql would.
 *
 * Usage: npx tsx scripts/run-seed.ts
 */
import { Client } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import { setDefaultResultOrder } from "dns";
import "dotenv/config";

// Node 18+ tries IPv6 addresses first by default, which times out on
// networks with broken/slow IPv6 routing (common on Windows/campus
// networks) before ever falling back to a working IPv4 address. This
// is the documented fix — prefer IPv4 results outright.
setDefaultResultOrder("ipv4first");

async function main() {
  const sql = readFileSync(join(process.cwd(), "prisma", "seed.sql"), "utf-8");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 20000, // Neon free tier can take a few seconds to wake from cold start
  });

  await client.connect();
  try {
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    const last = results[results.length - 1];
    console.log(last?.rows ?? "Seed applied — no rows returned.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
