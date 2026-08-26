/**
 * scripts/sensor-simulator.ts
 *
 * Stands in for real IR/pressure sensors under library seats, which
 * this project doesn't have hardware access to. Run this alongside
 * the dev server during a demo and the seat map will show believable
 * live activity — seats randomly filling and emptying — driven through
 * the exact same OccupancyLog → trigger → pg_notify → SSE pipeline
 * that a real sensor deployment would use. Swapping this script for
 * real hardware later requires zero schema or API changes.
 *
 * Deliberately only touches seats that are FREE or already OCCUPIED-
 * by-sensor (never a seat someone has actually BOOKED/CHECKED_IN via
 * the real booking flow) so it doesn't stomp on a genuine demo booking
 * mid-presentation.
 *
 * Usage:
 *   npx tsx scripts/sensor-simulator.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TICK_INTERVAL_MS = 8_000;
const FLIP_PROBABILITY = 0.15; // 15% of eligible seats flip per tick

async function tick() {
  // Only seats currently FREE or OCCUPIED are fair game — never touch
  // LOCKED (mid-checkout) or BOOKED (someone's real reservation).
  const eligibleSeats = await prisma.seatStatus.findMany({
    where: { currentState: { in: ["FREE", "OCCUPIED"] } },
    select: { seatId: true, currentState: true },
  });

  // Of the OCCUPIED ones, only flip back to FREE the ones that got
  // there via a simulated sensor ping, not a real check-in — we can't
  // tell that from SeatStatus alone, so we cross-check against active
  // Bookings before ever flipping OCCUPIED → FREE.
  const activeCheckedInSeatIds = new Set(
    (
      await prisma.booking.findMany({
        where: { status: "CHECKED_IN" },
        select: { seatId: true },
      })
    ).map((b) => b.seatId)
  );

  for (const seat of eligibleSeats) {
    if (Math.random() > FLIP_PROBABILITY) continue;
    if (seat.currentState === "OCCUPIED" && activeCheckedInSeatIds.has(seat.seatId)) {
      continue; // real booking owns this seat — sensor sim stays out of it
    }

    const nextState = seat.currentState === "FREE" ? "OCCUPIED" : "FREE";

    await prisma.occupancyLog.create({
      data: { seatId: seat.seatId, detectedState: nextState, source: "SENSOR" },
    });
    // The AFTER INSERT trigger on OccupancyLog handles updating
    // SeatStatus and firing pg_notify — this script never touches
    // SeatStatus directly, same as a real sensor integration wouldn't.
  }

  console.log(`[sensor-sim] tick @ ${new Date().toISOString()} — ${eligibleSeats.length} seats eligible`);
}

async function main() {
  console.log("Sensor simulator started. Ctrl+C to stop.");
  await tick();
  setInterval(tick, TICK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Sensor simulator crashed:", err);
  process.exit(1);
});
