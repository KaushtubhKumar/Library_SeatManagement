import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyQrToken } from "@/lib/qr";
import { getOrCreateSession } from "@/lib/session";

/**
 * POST /api/bookings/:id/checkin   { qrToken? } | { bookingCode? }
 *
 * Called when the in-app camera scanner reads a booking's QR code, or
 * when the manual-entry fallback submits the short bookingCode instead
 * (bad lighting, cracked camera, camera permission denied, etc.).
 * Validates either credential is genuinely for THIS booking before
 * flipping state — otherwise someone could screenshot/guess a
 * random signed-looking string and check themselves into any seat.
 *
 * The actual FREE→BOOKED→OCCUPIED transition happens via the
 * fn_booking_status_changed trigger once we flip status here; this
 * route's only job is authorization + validity of the scan.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: bookingId } = await params;
  const user = await getOrCreateSession();
  const body = await req.json().catch(() => ({}));
  const qrToken = body?.qrToken as string | undefined;
  const bookingCode = body?.bookingCode as string | undefined;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  if (booking.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "NOT_YOUR_BOOKING" }, { status: 403 });
  }

  if (booking.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "BOOKING_NOT_ACTIVE", currentStatus: booking.status },
      { status: 409 }
    );
  }

  if (booking.expiryTime < new Date()) {
    // Belt-and-suspenders: the sweep job should have already flipped
    // this to EXPIRED, but if the request lands in that narrow race
    // window, reject the check-in rather than honor a stale hold.
    return NextResponse.json({ ok: false, error: "BOOKING_EXPIRED" }, { status: 409 });
  }

  // Verify the scanned QR token OR the manually-typed bookingCode
  // actually belongs to THIS booking — someone else's credential
  // shouldn't check you in to a DIFFERENT seat.
  if (qrToken) {
    const payload = verifyQrToken(qrToken);
    if (!payload || payload.bookingId !== bookingId) {
      return NextResponse.json({ ok: false, error: "INVALID_QR" }, { status: 400 });
    }
  } else if (bookingCode) {
    if (bookingCode.trim().toUpperCase() !== booking.bookingCode) {
      return NextResponse.json({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "QR_TOKEN_REQUIRED" }, { status: 400 });
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
  });

  // Log the check-in as an occupancy event too — this is what makes
  // the OccupancyLog audit trail complete (it captures presence signals
  // from ANY source: sensor sim, QR check-in, manual admin).
  await prisma.occupancyLog.create({
    data: { seatId: booking.seatId, detectedState: "OCCUPIED", source: "CHECKIN" },
  });

  return NextResponse.json({ ok: true, booking: updated });
}