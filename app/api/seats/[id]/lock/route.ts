import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";

const LOCK_DURATION_SECONDS = 60;

/**
 * POST /api/seats/:id/lock
 * Soft-locks a seat for 60s so two users can't both be mid-checkout on
 * the same seat (mirrors BookMyShow holding a seat while you pay).
 * The lock auto-expires — no cleanup job needed, see the guard below:
 * any read of SeatStatus that finds lockedUntil in the past treats the
 * seat as available again, and this endpoint re-checks it atomically.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seatId } = await params;
  const user = await getOrCreateSession();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Row lock so two concurrent requests for the same seat can't both
      // read "unlocked" before either writes — classic lost-update race.
      const status = await tx.$queryRaw<
        { seatId: string; currentState: string; lockedBy: string | null; lockedUntil: Date | null }[]
      >`SELECT * FROM "SeatStatus" WHERE "seatId" = ${seatId} FOR UPDATE`;

      if (status.length === 0) {
        throw new Error("SEAT_NOT_FOUND");
      }

      const seat = status[0];
      const now = new Date();
      const isLockedByOther =
        seat.currentState === "LOCKED" &&
        seat.lockedBy !== user.id &&
        seat.lockedUntil &&
        seat.lockedUntil > now;

      if (isLockedByOther) {
        throw new Error("SEAT_LOCKED_BY_OTHER");
      }

      if (seat.currentState !== "FREE" && seat.currentState !== "LOCKED") {
        throw new Error("SEAT_NOT_AVAILABLE");
      }

      const lockedUntil = new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000);

      await tx.seatStatus.update({
        where: { seatId },
        data: { currentState: "LOCKED", lockedBy: user.id, lockedUntil },
      });

      // LOCKED isn't driven by a Booking/OccupancyLog row, so it needs
      // its own notify call (the triggers only fire on those tables).
      await tx.$executeRaw`SELECT pg_notify('seat_updates', json_build_object(
        'seatId', ${seatId}::text, 'state', 'LOCKED'
      )::text)`;

      return { lockedUntil };
    });

    return NextResponse.json({ ok: true, lockedUntil: result.lockedUntil });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN_ERROR";
    const status = message === "SEAT_NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

/**
 * DELETE /api/seats/:id/lock
 * Explicit release — called when the user backs out of the booking
 * modal. Not required for correctness (the lock expires anyway) but
 * makes the seat visibly free again immediately instead of after 60s.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seatId } = await params;
  const user = await getOrCreateSession();

  const status = await prisma.seatStatus.findUnique({ where: { seatId } });
  if (!status || status.lockedBy !== user.id) {
    // Not your lock (or already gone) — nothing to do, not an error.
    return NextResponse.json({ ok: true });
  }

  await prisma.seatStatus.update({
    where: { seatId },
    data: { currentState: "FREE", lockedBy: null, lockedUntil: null },
  });

  await prisma.$executeRaw`SELECT pg_notify('seat_updates', json_build_object(
    'seatId', ${seatId}::text, 'state', 'FREE'
  )::text)`;

  return NextResponse.json({ ok: true });
}
