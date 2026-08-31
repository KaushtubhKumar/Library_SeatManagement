/**
 * scripts/scheduler.ts
 *
 * Real cron wiring for local/small deployments that don't have access
 * to Vercel Cron or pg_cron. Runs two jobs:
 *  - expiry sweep every 60s (30-min booking holds, 4hr session caps, strikes, waitlist promotion)
 *  - materialized view refresh nightly at 3am
 *
 * In production on Vercel, delete this file and use Vercel Cron
 * hitting the same two endpoints instead — the endpoints themselves
 * don't care who calls them, just that the Authorization header matches.
 *
 * Usage: npx tsx scripts/scheduler.ts
 */
import cron from "node-cron";

const BASE_URL = process.env.APP_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "dev-cron-secret";

async function callEndpoint(path: string) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const data = await res.json();
    if (!data.ok) console.error(`[scheduler] ${path} failed:`, data);
    else console.log(`[scheduler] ${path} ok @ ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[scheduler] ${path} request failed:`, err);
  }
}

// Every minute: expire stale bookings, cap overrun sessions, strike
// no-shows, promote waitlists — all bundled in fn_expire_stale_bookings()
cron.schedule("* * * * *", () => callEndpoint("/api/cron/expire"));

// Nightly at 3am: rebuild the quietest_hours materialized view from
// the day's accumulated booking data
cron.schedule("0 3 * * *", () => callEndpoint("/api/admin/refresh-analytics"));

// Every 30 min: jitter tie-break order within same-priority waitlist bands
cron.schedule("*/30 * * * *", () => callEndpoint("/api/cron/shuffle-waitlist"));

console.log(
  "Scheduler started — expiry sweep every 60s, waitlist shuffle every 30min, analytics refresh nightly at 3am."
);