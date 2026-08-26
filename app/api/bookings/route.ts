import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";
import { signQrToken, renderQrDataUrl, generateBookingCode } from "@/lib/qr";
import { randomUUID } from "crypto";

const BOOKING_DURATION_MINUTES = 30;
const MAX_ACTIVE_BOOKINGS_PER_USER = 2;

/**
 * POST /api/bookings   { seatId }
 *
 * Confirms a booking for a seat the user (should have) soft-locked.
 * The seat lock is a UX nicety, not the safety mechanism — the actual
 * conflict-freedom guarantee is the EXCLUDE constraint on Booking, so
 * this still works correctly even if the lock already expired between
 * the user clicking "confirm" and this request landing.
 */
export async function POST(req: NextRequest) {
  const user = await getOrCreateSession();
  const body = await req.json().catch(() => null);
  const seatId = body?.seatId as string | undefined;

  if (!seatId) {
    return NextResponse.json({ ok: false, error: "SEAT_ID_REQUIRED" }, { status: 400 });
  }

  // Rate-limit: cap concurrent ACTIVE/CHECKED_IN bookings per user so
  // one person can't hoard seats across floors.
  const activeCount = await prisma.booking.count({
    where: { userId: user.id, status: { in: ["ACTIVE", "CHECKED_IN"] } },
  });
  if (activeCount >= MAX_ACTIVE_BOOKINGS_PER_USER) {
    return NextResponse.json(
      { ok: false, error: "TOO_MANY_ACTIVE_BOOKINGS" },
      { status: 429 }
    );
  }

  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    return NextResponse.json(
      { ok: false, error: "ACCOUNT_SUSPENDED", suspendedUntil: user.suspendedUntil },
      { status: 403 }
    );
  }

  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
    include: { zone: { include: { floor: true } } },
  });
  if (!seat) {
    return NextResponse.json({ ok: false, error: "SEAT_NOT_FOUND" }, { status: 404 });
  }

  const startTime = new Date();
  const expiryTime = new Date(startTime.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000);
  const bookingId = randomUUID();
  const qrToken = signQrToken({ bookingId, seatId });
  const qrCodeDataUrl = await renderQrDataUrl(qrToken);
  const bookingCode = generateBookingCode(seat.zone.floor.floorNumber);

  try {
    // The EXCLUDE constraint does the real conflict check atomically at
    // insert time — no need for a manual "is it free" SELECT first,
    // which would just be a race condition waiting to happen.
    const booking = await prisma.booking.create({
      data: {
        id: bookingId,
        seatId,
        userId: user.id,
        startTime,
        expiryTime,
        qrToken,
        qrCodeDataUrl,
        bookingCode,
      },
    });

    return NextResponse.json({ ok: true, booking });
  } catch (err: unknown) {
    // Postgres exclusion-constraint violation surfaces as error code 23P01
    const code = (err as { code?: string })?.code;
    if (code === "23P01") {
      return NextResponse.json(
        { ok: false, error: "SEAT_ALREADY_BOOKED" },
        { status: 409 }
      );
    }
    console.error("Booking creation failed:", err);
    return NextResponse.json({ ok: false, error: "BOOKING_FAILED" }, { status: 500 });
  }
}

/**
 * GET /api/bookings — the current user's bookings (active + recent history)
 */
export async function GET() {
  const user = await getOrCreateSession();
  const bookings = await prisma.booking.findMany({
    where: { userId: user.id },
    include: { seat: { include: { zone: { include: { floor: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ ok: true, bookings });
}
