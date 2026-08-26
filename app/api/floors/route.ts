import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/floors
 * Floor selector data — each floor with a live free/total seat count,
 * so the picker screen can show "Floor 2: 14/60 free" without the user
 * drilling into the seat map first.
 */
export async function GET() {
  const floors = await prisma.floor.findMany({
    orderBy: { floorNumber: "asc" },
    include: {
      zones: {
        include: {
          seats: {
            include: { status: true },
          },
        },
      },
    },
  });

  const result = floors.map((floor) => {
    const allSeats = floor.zones.flatMap((z) => z.seats);
    const freeCount = allSeats.filter((s) => s.status?.currentState === "FREE").length;
    return {
      id: floor.id,
      floorNumber: floor.floorNumber,
      imageUrl: floor.imageUrl,
      totalSeats: allSeats.length,
      freeSeats: freeCount,
    };
  });

  return NextResponse.json({ ok: true, floors: result });
}
