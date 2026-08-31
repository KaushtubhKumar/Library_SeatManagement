import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bookings/lookup?code=LB2-4F9K
 *
 * Resolves a short bookingCode (manual fallback entry on /scan) to a
 * bookingId, since the manual-entry path doesn't have the bookingId
 * the way a scanned QR token's decoded payload does. Only returns the
 * id — the actual check-in still re-validates the code server-side in
 * POST /api/bookings/:id/checkin.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingCode: code },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, bookingId: booking.id });
}