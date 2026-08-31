import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";
import { promoteNextWaitlistEntry } from "@/lib/promoteWaitlist";

/**
 * POST /api/bookings/:id/cancel
 * Lets a user free up a seat they no longer need, instead of letting
 * it silently expire in 30 min. Good citizenship feature — surfaces
 * the seat to others (and the waitlist) immediately via the trigger.
 *
 * Reliability impact: a self-initiated cancel costs -1 (small — telling
 * us early is the RIGHT behavior, better than ghosting). A silent
 * no-show (fn_expire_stale_bookings, in the SQL migration) costs -3.
 * Someone who cancels honestly should never rank below someone who
 * just never showed up and said nothing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const user = await getOrCreateSession();

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }
  if (booking.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "NOT_YOUR_BOOKING" }, { status: 403 });
  }
  if (booking.status !== "ACTIVE" && booking.status !== "CHECKED_IN") {
    return NextResponse.json(
      { ok: false, error: "BOOKING_NOT_CANCELLABLE", currentStatus: booking.status },
      { status: 409 }
    );
  }

  const wasCheckedIn = booking.status === "CHECKED_IN";
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "CANCELLED",
      checkedOutAt: wasCheckedIn ? new Date() : undefined,
    },
  });

  // Only penalize cancelling an unclaimed hold — once checked in, the
  // seat was genuinely used, so leaving early isn't a queue-priority
  // matter the way ghosting a reservation is.
  if (!wasCheckedIn) {
    await prisma.user.update({
      where: { id: user.id },
      data: { reliabilityScore: { decrement: 1 } },
    });
  }

  await promoteNextWaitlistEntry(booking.seatId);

  return NextResponse.json({ ok: true, booking: updated });
}