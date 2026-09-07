import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";
import { signQrToken, renderQrDataUrl, generateBookingCode } from "@/lib/qr";
import { isValidSessionDuration } from "@/lib/sessionDuration";
import { randomUUID } from "crypto";

const CLAIM_WINDOW_MINUTES = 30;
const PROXIMITY_THRESHOLD = 0.08; // normalized-coordinate distance to count as "adjacent"

type SeatRow = Awaited<ReturnType<typeof loadFreeSeats>>[number];

async function loadFreeSeats(zoneId: string) {
  return prisma.seat.findMany({
    where: { zoneId, status: { currentState: "FREE" } },
    include: { zone: { include: { floor: true } } },
  });
}

function distance(a: SeatRow, b: SeatRow) {
  return Math.hypot(a.posX - b.posX, a.posY - b.posY);
}

/** Best contiguous run of mutually-adjacent free seats, size up to `count`. */
function findBestCluster(freeSeats: SeatRow[], count: number): SeatRow[] {
  let best: SeatRow[] = [];
  for (const anchor of freeSeats) {
    const neighbors = freeSeats
      .filter((s) => s.id !== anchor.id && distance(anchor, s) <= PROXIMITY_THRESHOLD)
      .sort((a, b) => distance(anchor, a) - distance(anchor, b));
    const cluster = [anchor, ...neighbors].slice(0, count);
    if (cluster.length > best.length) best = cluster;
    if (best.length === count) break;
  }
  return best;
}

/** Fills remaining slots with the free seats geographically closest to
 * the cluster's centroid, excluding seats already in the cluster. */
function findNearestLeftovers(freeSeats: SeatRow[], cluster: SeatRow[], need: number): SeatRow[] {
  if (need <= 0) return [];
  const clusterIds = new Set(cluster.map((s) => s.id));
  const centroidX = cluster.reduce((sum, s) => sum + s.posX, 0) / cluster.length;
  const centroidY = cluster.reduce((sum, s) => sum + s.posY, 0) / cluster.length;

  return freeSeats
    .filter((s) => !clusterIds.has(s.id))
    .sort((a, b) => Math.hypot(a.posX - centroidX, a.posY - centroidY) - Math.hypot(b.posX - centroidX, b.posY - centroidY))
    .slice(0, need);
}

async function createBookings(
  seats: SeatRow[],
  userId: string,
  organizerSeatId: string,
  durationMinutes: number
) {
  const startTime = new Date();
  const expiryTime = new Date(startTime.getTime() + CLAIM_WINDOW_MINUTES * 60 * 1000);
  const groupId = randomUUID();
  const floorNumber = seats[0].zone.floor.floorNumber;

  const bookings = await prisma.$transaction(
    seats.map((seat) => {
      const bookingId = randomUUID();
      const qrToken = signQrToken({ bookingId, seatId: seat.id });
      return prisma.booking.create({
        data: {
          id: bookingId,
          seatId: seat.id,
          userId,
          startTime,
          expiryTime,
          durationMinutes,
          qrToken,
          bookingCode: generateBookingCode(floorNumber),
          groupId,
          isGroupOwnerSeat: seat.id === organizerSeatId,
        },
      });
    })
  );

  const withQr = await Promise.all(
    bookings.map(async (b) => ({ ...b, qrCodeDataUrl: await renderQrDataUrl(b.qrToken) }))
  );

  return { bookings: withQr, seatCodes: seats.map((s) => s.seatCode), groupId };
}

/**
 * POST /api/bookings/group
 *
 * Two modes:
 *
 * 1) MANUAL — { mode: "manual", seatIds: string[2-4], durationMinutes? }
 *    Books exactly the seats the user picked themselves. No clustering.
 *
 * 2) AUTO   — { mode: "auto", zoneId, count, durationMinutes?, confirmSeatIds? }
 *    Finds the best contiguous run of `count` adjacent free seats. If a
 *    full contiguous run isn't available, returns the largest run found
 *    PLUS the nearest leftover free seats to fill the rest, as a
 *    PROPOSAL (needsConfirmation: true) — nothing is booked yet. Call
 *    again with confirmSeatIds set to that same seat id list to commit.
 *    If the zone has fewer than `count` free seats at all, returns
 *    NOT_ENOUGH_SEATS immediately — no point proposing anything.
 *
 * Every seat in the result shares one groupId. Exactly one seat (the
 * first one, or organizerSeatId if manual) is isGroupOwnerSeat — the
 * one the organizer claims for themself via the normal /checkin-gate
 * flow. The rest are meant for teammates via their own
 * /claim/[bookingId] link (see that route) — see NOTE below on the
 * simulated identity model.
 */
export async function POST(req: NextRequest) {
  const user = await getOrCreateSession();
  const body = await req.json().catch(() => null);
  const mode = body?.mode === "manual" ? "manual" : "auto";
  const durationMinutes = isValidSessionDuration(body?.durationMinutes) ? body.durationMinutes : 30;

  if (mode === "manual") {
    const seatIds = Array.isArray(body?.seatIds) ? (body.seatIds as string[]) : [];
    if (seatIds.length < 2 || seatIds.length > 4) {
      return NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", detail: "seatIds must have 2-4 entries" },
        { status: 400 }
      );
    }

    const seats = await prisma.seat.findMany({
      where: { id: { in: seatIds }, status: { currentState: "FREE" } },
      include: { zone: { include: { floor: true } } },
    });
    if (seats.length !== seatIds.length) {
      return NextResponse.json(
        { ok: false, error: "SEAT_NO_LONGER_FREE", detail: "One or more picked seats aren't free anymore" },
        { status: 409 }
      );
    }

    try {
      const result = await createBookings(seats, user.id, seatIds[0], durationMinutes);
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23P01") {
        return NextResponse.json(
          { ok: false, error: "SEAT_TAKEN_MID_REQUEST" },
          { status: 409 }
        );
      }
      console.error("Manual group booking failed:", err);
      return NextResponse.json({ ok: false, error: "GROUP_BOOKING_FAILED" }, { status: 500 });
    }
  }

  // --- AUTO mode ---
  const zoneId = body?.zoneId as string | undefined;
  const count = Number(body?.count);
  const confirmSeatIds = Array.isArray(body?.confirmSeatIds) ? (body.confirmSeatIds as string[]) : null;

  if (!zoneId || !count || count < 2 || count > 4) {
    return NextResponse.json(
      { ok: false, error: "INVALID_REQUEST", detail: "zoneId and count (2-4) required" },
      { status: 400 }
    );
  }

  const freeSeats = await loadFreeSeats(zoneId);

  if (freeSeats.length < count) {
    return NextResponse.json(
      { ok: false, error: "NOT_ENOUGH_SEATS", detail: `Only ${freeSeats.length} free seat(s) in this zone`, availableCount: freeSeats.length },
      { status: 409 }
    );
  }

  // Second call, confirming a previously-proposed (possibly non-contiguous)
  // set of seats — book them now.
  if (confirmSeatIds) {
    const seats = freeSeats.filter((s) => confirmSeatIds.includes(s.id));
    if (seats.length !== confirmSeatIds.length) {
      return NextResponse.json(
        { ok: false, error: "SEAT_NO_LONGER_FREE", detail: "One of the proposed seats was taken — try again" },
        { status: 409 }
      );
    }
    try {
      const result = await createBookings(seats, user.id, seats[0].id, durationMinutes);
      return NextResponse.json({ ok: true, ...result });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23P01") {
        return NextResponse.json({ ok: false, error: "SEAT_TAKEN_MID_REQUEST" }, { status: 409 });
      }
      console.error("Auto group booking (confirm) failed:", err);
      return NextResponse.json({ ok: false, error: "GROUP_BOOKING_FAILED" }, { status: 500 });
    }
  }

  const cluster = findBestCluster(freeSeats, count);

  if (cluster.length === count) {
    // Full contiguous run found — book immediately, no confirmation needed.
    try {
      const result = await createBookings(cluster, user.id, cluster[0].id, durationMinutes);
      return NextResponse.json({ ok: true, contiguous: true, ...result });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23P01") {
        return NextResponse.json({ ok: false, error: "SEAT_TAKEN_MID_REQUEST" }, { status: 409 });
      }
      console.error("Auto group booking failed:", err);
      return NextResponse.json({ ok: false, error: "GROUP_BOOKING_FAILED" }, { status: 500 });
    }
  }

  // Partial contiguous run — propose the run plus the nearest leftover
  // seats to fill the rest, and ask the caller to confirm before booking.
  const leftovers = findNearestLeftovers(freeSeats, cluster, count - cluster.length);
  const proposal = [...cluster, ...leftovers];

  if (proposal.length < count) {
    return NextResponse.json(
      { ok: false, error: "NOT_ENOUGH_SEATS", detail: `Only found ${proposal.length} usable seat(s)`, availableCount: proposal.length },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    needsConfirmation: true,
    contiguousCount: cluster.length,
    proposedSeats: proposal.map((s) => ({ id: s.id, seatCode: s.seatCode, isContiguous: cluster.some((c) => c.id === s.id) })),
  });
}