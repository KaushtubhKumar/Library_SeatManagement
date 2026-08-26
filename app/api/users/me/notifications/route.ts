import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";

/**
 * GET /api/users/me/notifications
 *
 * Since there's no push-notification provider wired up yet (see
 * lib/notify.ts), the frontend polls this endpoint to find out about
 * two things that happen server-side without the user's tab knowing:
 *  - a waitlist entry of theirs just got promoted (notified=true)
 *  - their account just got suspended for no-shows
 *
 * This is a read-only view — it doesn't mark anything as "seen".
 * That's a deliberate simplification: the frontend can just stop
 * showing a banner once the user acts on it (e.g. books the seat).
 */
export async function GET() {
  const user = await getOrCreateSession();

  const promotedWaitlistEntries = await prisma.waitlist.findMany({
    where: { userId: user.id, notified: true },
    orderBy: { joinedAt: "desc" },
    take: 5,
  });

  const seatIds = promotedWaitlistEntries.map((w) => w.seatId);
  const seats = await prisma.seat.findMany({
    where: { id: { in: seatIds } },
    select: { id: true, seatCode: true, status: { select: { currentState: true } } },
  });
  const seatMap = new Map(seats.map((s) => [s.id, s]));

  const freshUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { suspendedUntil: true, strikeCount: true },
  });

  return NextResponse.json({
    ok: true,
    waitlistPromotions: promotedWaitlistEntries
      // Only surface promotions where the seat is STILL free — once
      // someone books it (themselves or via another path), stop
      // showing the "it's your turn" banner.
      .filter((w) => seatMap.get(w.seatId)?.status?.currentState === "FREE")
      .map((w) => ({
        seatId: w.seatId,
        seatCode: seatMap.get(w.seatId)?.seatCode ?? null,
      })),
    suspendedUntil: freshUser?.suspendedUntil ?? null,
    strikeCount: freshUser?.strikeCount ?? 0,
  });
}
