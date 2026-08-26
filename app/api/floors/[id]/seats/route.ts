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
            include: { status: true },
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
