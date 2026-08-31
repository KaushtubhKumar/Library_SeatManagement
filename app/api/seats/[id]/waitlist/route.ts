import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";

// Bands reliabilityScore into ties of 5 (0-4, 5-9, ...; negative scores
// band the same way). Priority queue still respects real gaps between
// bands, but users within a band are treated as equals and re-shuffled
// periodically (fn_shuffle_waitlist_tiers) rather than staying frozen
// in strict join order forever.
function priorityBand(reliabilityScore: number): number {
  return Math.floor(reliabilityScore / 5) * 5;
}

/**
 * POST /api/seats/:id/waitlist
 * Joins the waitlist for a seat that's currently taken. Queue order is
 * priorityScore DESC (banded reliabilityScore — rewarded for on-time
 * check-ins, penalized for no-shows), then joinedAt ASC as a tie-break
 * that itself gets periodically jittered within a band — see
 * lib/promoteWaitlist.ts and fn_shuffle_waitlist_tiers in migration.sql.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seatId } = await params;
  const user = await getOrCreateSession();

  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) {
    return NextResponse.json({ ok: false, error: "SEAT_NOT_FOUND" }, { status: 404 });
  }

  const existing = await prisma.waitlist.findFirst({
    where: { seatId, userId: user.id, notified: false },
  });
  if (existing) {
    return NextResponse.json({ ok: true, waitlist: existing, alreadyJoined: true });
  }

  const entry = await prisma.waitlist.create({
    data: { seatId, userId: user.id, priorityScore: priorityBand(user.reliabilityScore) },
  });

  return NextResponse.json({ ok: true, waitlist: entry });
}

/**
 * GET /api/seats/:id/waitlist — current user's position in line (1-indexed),
 * or null if they haven't joined. Position reflects priority order, not
 * raw join order.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seatId } = await params;
  const user = await getOrCreateSession();

  const queue = await prisma.waitlist.findMany({
    where: { seatId, notified: false },
    orderBy: [{ priorityScore: "desc" }, { joinedAt: "asc" }],
  });

  const position = queue.findIndex((w) => w.userId === user.id);
  return NextResponse.json({
    ok: true,
    position: position === -1 ? null : position + 1,
    queueLength: queue.length,
  });
}