import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { LIBRARY_LOCATION, distanceMeters } from "@/lib/libraryLocation";

/**
 * POST /api/checkin-gate   { lat: number, lng: number }
 *
 * Reached only by scanning the static QR sticker posted at the library
 * entrance (the sticker is the same for every student — it just deep
 * links to /checkin-gate on the frontend, which then calls this route).
 * That gives us "this browser opened a URL that's only discoverable by
 * standing in front of the entrance." This route adds the second signal:
 * the phone's own reported GPS must actually be near the building.
 * Neither check alone is proof of presence; together they're the
 * practical ceiling without deploying kiosk/NFC hardware.
 *
 * On success, auto-resolves the student's own single active ACTIVE
 * booking (no typing a code — their session cookie already identifies
 * them) and flips it to CHECKED_IN, same as the existing checkin route.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "NOT_LOGGED_IN" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "LOCATION_REQUIRED" }, { status: 400 });
  }

  const distance = distanceMeters(
    lat,
    lng,
    LIBRARY_LOCATION.latitude,
    LIBRARY_LOCATION.longitude
  );
  if (distance > LIBRARY_LOCATION.radiusMeters) {
    return NextResponse.json(
      { ok: false, error: "OUTSIDE_LIBRARY", distanceMeters: Math.round(distance) },
      { status: 403 }
    );
  }

  // Only auto-detect a booking that's genuinely "theirs to claim":
  // either an individually-made booking (groupId null), or the one
  // seat within a group they marked as their own at booking time.
  // Teammates' seats in the same group are claimed via their own
  // /claim/[bookingId] link instead — never surfaced here, even
  // though the DB row still technically belongs to the organizer's
  // userId in this simulated no-multi-account model.
  const booking = await prisma.booking.findFirst({
    where: {
      userId: user.id,
      status: "ACTIVE",
      OR: [{ groupId: null }, { isGroupOwnerSeat: true }],
    },
    orderBy: { createdAt: "desc" },
    include: { seat: { include: { zone: { include: { floor: true } } } } },
  });

  if (!booking) {
    return NextResponse.json({ ok: false, error: "NO_ACTIVE_BOOKING" }, { status: 404 });
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

  // Short human-readable confirmation, distinct from the QR-scan flow's
  // bookingCode — this is just a "yep it worked" receipt, not a credential.
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