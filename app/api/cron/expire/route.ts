import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/expire
 *
 * Runs fn_expire_stale_bookings() — flips ACTIVE bookings past their
 * 30-min hold to EXPIRED, and CHECKED_IN sessions past their bounded
 * 4-hour window to COMPLETED. Call this on a schedule (Vercel Cron,
 * node-cron in a long-running server, or pg_cron inside Postgres
 * itself if your host supports it — see migration.sql).
 *
 * Protected by a shared secret so this can't be hit publicly and used
 * to spam-trigger sweeps (harmless, but no reason to expose it).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || "dev-cron-secret"}`;
  if (authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await prisma.$executeRaw`SELECT fn_expire_stale_bookings()`;

  return NextResponse.json({ ok: true, sweptAt: new Date().toISOString() });
}
