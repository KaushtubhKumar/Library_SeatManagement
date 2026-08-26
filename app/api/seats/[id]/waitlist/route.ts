import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";

/**
 * POST /api/seats/:id/waitlist
 * Joins the waitlist for a seat that's currently taken. When the seat
 * next becomes FREE (via the expiry sweep or a checkout), the oldest
 * waiting user is flagged `notified = true` — see
 * lib/promoteWaitlist.ts, called from the same places that free a seat.
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
    data: { seatId, userId: user.id },
  });

  return NextResponse.json({ ok: true, waitlist: entry });
}

/**
 * GET /api/seats/:id/waitlist — current user's position in line (1-indexed),
 * or null if they haven't joined.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seatId } = await params;
  const user = await getOrCreateSession();

  const queue = await prisma.waitlist.findMany({
    where: { seatId, notified: false },
    orderBy: { joinedAt: "asc" },
  });

  const position = queue.findIndex((w) => w.userId === user.id);
  return NextResponse.json({
    ok: true,
    position: position === -1 ? null : position + 1,
    queueLength: queue.length,
  });
}
