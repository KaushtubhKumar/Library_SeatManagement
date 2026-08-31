import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/cron/shuffle-waitlist
 *
 * Runs fn_shuffle_waitlist_tiers() — jitters tie-break order among
 * waitlist entries that share a priority band, so two equally-reliable
 * users don't get frozen into whoever-clicked-first forever. Never lets
 * a lower band overtake a higher one; only reorders within a band. Run
 * this on a slower cadence than the 60s expiry sweep (e.g. every 30 min).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET || "dev-cron-secret"}`;
  if (authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await prisma.$executeRaw`SELECT fn_shuffle_waitlist_tiers()`;

  return NextResponse.json({ ok: true, shuffledAt: new Date().toISOString() });
}