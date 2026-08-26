import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/analytics
 *
 * Pulls from the `quietest_hours` materialized view plus a couple of
 * live aggregate queries. The materialized view is refreshed on a
 * schedule (see note below) rather than on every request — that's the
 * whole point of using one instead of a plain view.
 */
export async function GET() {
  const [quietestHours, peakFloors, noShowLeaders, currentOccupancy] = await Promise.all([
    prisma.$queryRaw<
      { zone_id: string; zone_name: string; hour_of_day: number; booking_count: bigint; avg_noise_score: number }[]
    >`SELECT * FROM quietest_hours ORDER BY booking_count DESC LIMIT 10`,

    prisma.$queryRaw<
      { floor_number: number; total_bookings: bigint }[]
    >`SELECT f."floorNumber" AS floor_number, COUNT(b.id) AS total_bookings
      FROM "Booking" b
      JOIN "Seat" s ON s.id = b."seatId"
      JOIN "Zone" z ON z.id = s."zoneId"
      JOIN "Floor" f ON f.id = z."floorId"
      GROUP BY f."floorNumber"
      ORDER BY total_bookings DESC`,

    prisma.user.findMany({
      where: { strikeCount: { gt: 0 } },
      select: { id: true, name: true, strikeCount: true, suspendedUntil: true },
      orderBy: { strikeCount: "desc" },
      take: 10,
    }),

    prisma.seatStatus.groupBy({
      by: ["currentState"],
      _count: true,
    }),
  ]);

  // bigint doesn't JSON-serialize by default
  const serialize = <T extends Record<string, unknown>>(rows: T[]) =>
    rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])
      )
    );

  return NextResponse.json({
    ok: true,
    quietestHours: serialize(quietestHours),
    peakFloors: serialize(peakFloors),
    noShowLeaders,
    currentOccupancy: currentOccupancy.map((c) => ({
      state: c.currentState,
      count: c._count,
    })),
    note: "quietestHours reflects the last materialized-view refresh, not live data. Refresh via REFRESH MATERIALIZED VIEW CONCURRENTLY quietest_hours;",
  });
}
