import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";
import { promoteNextWaitlistEntry } from "@/lib/promoteWaitlist";

/**
 * POST /api/bookings/group/:groupId/abort
 *
 * Cancels every seat in a group booking at once. Only the organizer
 * can do this — proven by holding the isGroupOwnerSeat=true booking
 * in this group under their own session, same ownership model as any
 * other cancel. Individual teammates cancelling just their own seat
 * should use the normal per-booking cancel endpoint instead — this is
 * specifically for "the whole plan fell through."
 *
 * Same reliability rule as a single cancel: -1 per unclaimed
 * (ACTIVE, not yet CHECKED_IN) seat aborted, applied to whichever
 * user actually owns that booking row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const user = await getOrCreateSession();

  const organizerSeat = await prisma.booking.findFirst({
    where: { groupId, isGroupOwnerSeat: true },
  });
  if (!organizerSeat) {
    return NextResponse.json({ ok: false, error: "GROUP_NOT_FOUND" }, { status: 404 });
  }
  if (organizerSeat.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "NOT_GROUP_ORGANIZER" }, { status: 403 });
  }

  const groupBookings = await prisma.booking.findMany({
    where: { groupId, status: { in: ["ACTIVE", "CHECKED_IN"] } },
  });

  if (groupBookings.length === 0) {
    return NextResponse.json({ ok: true, cancelledCount: 0 });
  }

  await prisma.$transaction(
    groupBookings.map((b) =>
      prisma.booking.update({
        where: { id: b.id },
        data: {
          status: "CANCELLED",
          checkedOutAt: b.status === "CHECKED_IN" ? new Date() : undefined,
        },
      })
    )
  );

  const unclaimedByUser = groupBookings.filter((b) => b.status === "ACTIVE");
  for (const b of unclaimedByUser) {
    await prisma.user.update({
      where: { id: b.userId },
      data: { reliabilityScore: { decrement: 1 } },
    });
    await promoteNextWaitlistEntry(b.seatId);
  }

  return NextResponse.json({ ok: true, cancelledCount: groupBookings.length });
}