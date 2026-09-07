import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIBRARY_LOCATION, distanceMeters } from "@/lib/libraryLocation";

/**
 * POST /api/claim/:bookingId   { lat, lng }
 *
 * The teammate-facing counterpart to /api/checkin-gate. That route
 * auto-detects "the current session's own booking" — which only works
 * for the organizer, since every seat in a group is stored under the
 * organizer's userId in this simulated single-account model (there's
 * no real per-teammate login). This route instead targets one EXACT
 * booking id, so each teammate gets their own link (shared by the
 * organizer) pointing at their own specific seat — they can claim
 * that seat and no other, regardless of whose browser session opens
 * the link. Same GPS-proximity proof as the main gate.
 */
/**
 * GET /api/claim/:bookingId — lets the claim page show which seat this
 * link is for before the teammate taps "claim", without exposing
 * anything beyond what's already implied by holding the link itself.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seat: { include: { zone: { include: { floor: true } } } } },
  });

  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: booking.status,
    expiryTime: booking.expiryTime,
    seat: {
      floor: booking.seat.zone.floor.floorNumber,
      zone: booking.seat.zone.name,
      seatCode: booking.seat.seatCode,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "LOCATION_REQUIRED" }, { status: 400 });
  }

  const distance = distanceMeters(lat, lng, LIBRARY_LOCATION.latitude, LIBRARY_LOCATION.longitude);
  if (distance > LIBRARY_LOCATION.radiusMeters) {
    return NextResponse.json(
      { ok: false, error: "OUTSIDE_LIBRARY", distanceMeters: Math.round(distance) },
      { status: 403 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { seat: { include: { zone: { include: { floor: true } } } } },
  });

  if (!booking) {
    return NextResponse.json({ ok: false, error: "BOOKING_NOT_FOUND" }, { status: 404 });
  }
  if (booking.status !== "ACTIVE") {
    return NextResponse.json(
      { ok: false, error: "NOT_CLAIMABLE", currentStatus: booking.status },
      { status: 409 }
    );
  }
  if (booking.expiryTime < new Date()) {
    return NextResponse.json({ ok: false, error: "BOOKING_EXPIRED" }, { status: 410 });
  }

  const checkedIn = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CHECKED_IN",
      checkedInAt: new Date(),
      sessionExpiresAt: new Date(Date.now() + booking.durationMinutes * 60 * 1000),
    },
  });

  const passcode = checkedIn.id.slice(-6).toUpperCase();

  return NextResponse.json({
    ok: true,
    passcode,
    seat: {
      floor: booking.seat.zone.floor.floorNumber,
      zone: booking.seat.zone.name,
      seatCode: booking.seat.seatCode,
    },
  });
}