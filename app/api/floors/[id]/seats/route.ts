import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/floors/:id/seats
 * Everything the frontend needs to render one floor's virtual seat map:
 * seat coordinates (for overlay positioning on the floor image), zone
 * metadata (noise type, for the color-coding/legend), amenities, and
 * live status. The SSE stream (/api/stream) pushes deltas on top of
 * this initial snapshot — this endpoint is the "first paint" fetch.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: floorId } = await params;

  const floor = await prisma.floor.findUnique({
    where: { id: floorId },
    include: {
      zones: {
        include: {
          seats: {
            include: {
              status: true,
              // Only the one still-relevant booking per seat: whichever
              // ACTIVE or CHECKED_IN row is currently holding it. A seat
              // has at most one of these at a time (that's what the
              // EXCLUDE constraint guarantees), so "most recent" here
              // is just a safety tie-breaker, not real ambiguity.
              bookings: {
                where: { status: { in: ["ACTIVE", "CHECKED_IN"] } },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            orderBy: { seatCode: "asc" },
          },
        },
      },
    },
  });

  if (!floor) {
    return NextResponse.json({ ok: false, error: "FLOOR_NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();

  const zones = floor.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    zoneType: zone.zoneType,
    declaredNoiseLevel: zone.declaredNoiseLevel,
    seats: zone.seats.map((seat) => {
      // A LOCKED seat whose lock has silently expired (no sweep needed
      // for this — it's just a read-time correction) should render as
      // FREE rather than confuse the user with a stuck "locked" seat.
      let currentState = seat.status?.currentState ?? "FREE";
      if (
        currentState === "LOCKED" &&
        seat.status?.lockedUntil &&
        seat.status.lockedUntil < now
      ) {
        currentState = "FREE";
      }

      return {
        id: seat.id,
        seatCode: seat.seatCode,
        seatType: seat.seatType,
        hasPowerSocket: seat.hasPowerSocket,
        hasWindow: seat.hasWindow,
        posX: seat.posX,
        posY: seat.posY,
        currentState,
        // When this seat frees back up, for the hover tooltip: BOOKED
        // seats free up if the claim window lapses without a checkin
        // (expiryTime); CHECKED_IN seats free up when the study
        // session ends (sessionExpiresAt). FREE/MAINTENANCE seats have
        // no relevant timestamp — null, and the frontend skips the
        // tooltip's countdown line entirely.
        occupiedUntil:
          currentState === "BOOKED"
            ? seat.bookings[0]?.expiryTime?.toISOString() ?? null
            : currentState === "OCCUPIED"
            ? seat.bookings[0]?.sessionExpiresAt?.toISOString() ?? null
            : null,
      };
    }),
  }));

  return NextResponse.json({
    ok: true,
    floor: {
      id: floor.id,
      floorNumber: floor.floorNumber,
      imageUrl: floor.imageUrl,
      imageWidth: floor.imageWidth,
      imageHeight: floor.imageHeight,
    },
    zones,
  });
}