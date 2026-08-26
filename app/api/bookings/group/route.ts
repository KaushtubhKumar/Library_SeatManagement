import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";
import { signQrToken, renderQrDataUrl, generateBookingCode } from "@/lib/qr";
import { randomUUID } from "crypto";

const BOOKING_DURATION_MINUTES = 30;
const PROXIMITY_THRESHOLD = 0.08; // normalized-coordinate distance to count as "adjacent"

/**
 * POST /api/bookings/group   { zoneId, count }
 *
 * Finds `count` mutually adjacent FREE seats in a zone (using the same
 * posX/posY coordinates the seat map renders from) and books all of
 * them for the current user in a single transaction — either every
 * seat books or none do, so a group of 4 never ends up with 3 seats
 * together and 1 stranded on the other side of the room.
 */
export async function POST(req: NextRequest) {
  const user = await getOrCreateSession();
  const body = await req.json().catch(() => null);
  const zoneId = body?.zoneId as string | undefined;
  const count = Number(body?.count);

  if (!zoneId || !count || count < 2 || count > 8) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", detail: "zoneId and count (2-8) required" },
      { status: 400 }
    );
  }

  const freeSeats = await prisma.seat.findMany({
    where: { zoneId, status: { currentState: "FREE" } },
    include: { zone: { include: { floor: true } } },
  });

  if (freeSeats.length < count) {
    return NextResponse.json({ ok: false, error: "NOT_ENOUGH_FREE_SEATS" }, { status: 409 });
  }

  // Greedy cluster search: for each candidate seat, count how many
  // OTHER free seats fall within the proximity threshold. Take the
  // seat with the most nearby neighbors, then pull its closest
  // `count - 1` neighbors to form the group. Good enough for a room
  // of a few dozen seats — not meant to be a general clustering
  // algorithm, just "sit together" for group study.
  function distance(a: typeof freeSeats[0], b: typeof freeSeats[0]) {
    return Math.hypot(a.posX - b.posX, a.posY - b.posY);
  }

  let bestCluster: typeof freeSeats = [];
  for (const anchor of freeSeats) {
    const neighbors = freeSeats
      .filter((s) => s.id !== anchor.id && distance(anchor, s) <= PROXIMITY_THRESHOLD)
      .sort((a, b) => distance(anchor, a) - distance(anchor, b));

    const cluster = [anchor, ...neighbors].slice(0, count);
    if (cluster.length > bestCluster.length) bestCluster = cluster;
    if (bestCluster.length === count) break;
  }

  if (bestCluster.length < count) {
    return NextResponse.json(
      { ok: false, error: "NO_ADJACENT_CLUSTER_FOUND", detail: `Found only ${bestCluster.length} seats close enough together` },
      { status: 409 }
    );
  }

  const startTime = new Date();
  const expiryTime = new Date(startTime.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000);
  const floorNumber = bestCluster[0].zone.floor.floorNumber;

  try {
    // Single transaction: the EXCLUDE constraint still protects each
    // individual seat, and if ANY insert fails (seat got taken between
    // our SELECT above and this INSERT — real race, however small the
    // window), the whole transaction rolls back rather than leaving a
    // half-formed group.
    const bookings = await prisma.$transaction(
      bestCluster.map((seat) => {
        const bookingId = randomUUID();
        const qrToken = signQrToken({ bookingId, seatId: seat.id });
        return prisma.booking.create({
          data: {
            id: bookingId,
            seatId: seat.id,
            userId: user.id,
            startTime,
            expiryTime,
            qrToken,
            bookingCode: generateBookingCode(floorNumber),
          },
        });
      })
    );

    // QR images rendered after the transaction commits (image encoding
    // doesn't need to be atomic with the booking rows)
    const withQr = await Promise.all(
      bookings.map(async (b) => ({
        ...b,
        qrCodeDataUrl: await renderQrDataUrl(b.qrToken),
      }))
    );

    return NextResponse.json({ ok: true, bookings: withQr, seatCodes: bestCluster.map((s) => s.seatCode) });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23P01") {
      return NextResponse.json(
        { ok: false, error: "SEAT_TAKEN_MID_REQUEST", detail: "Someone booked one of these seats first — try again" },
        { status: 409 }
      );
    }
    console.error("Group booking failed:", err);
    return NextResponse.json({ ok: false, error: "GROUP_BOOKING_FAILED" }, { status: 500 });
  }
}
