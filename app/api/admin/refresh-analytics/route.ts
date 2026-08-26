import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/refresh-analytics
 * Refreshes the quietest_hours materialized view. CONCURRENTLY avoids
 * locking readers out while it rebuilds (requires the unique index we
 * already created on (zone_id, hour_of_day) in migration.sql).
 * Run this nightly — it's not something you want on every request,
 * that defeats the point of materializing it.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || "dev-cron-secret"}`;
  if (authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY quietest_hours`;

  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
