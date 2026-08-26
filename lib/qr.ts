import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { randomBytes } from "crypto";

const QR_SECRET = process.env.QR_JWT_SECRET || "dev-secret-change-in-production";

interface QrPayload {
  bookingId: string;
  seatId: string;
}

/** Signs a JWT scoped to one booking. Can't be forged or reused for a
 * different booking since bookingId is baked into the signature. */
export function signQrToken(payload: QrPayload): string {
  return jwt.sign(payload, QR_SECRET, { expiresIn: "45m" }); // a little
  // longer than the 30-min booking hold, so "expired but not yet swept"
  // bookings still show a clear app-level error rather than a raw JWT error.
}

export function verifyQrToken(token: string): QrPayload | null {
  try {
    return jwt.verify(token, QR_SECRET) as unknown as QrPayload;
  } catch {
    return null; // invalid signature or expired — caller treats both as invalid
  }
}

/** Renders the QR as a base64 PNG data URL, cached on the Booking row
 * so we don't regenerate the image on every fetch. */
export async function renderQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 1, width: 300 });
}

/** Short human-readable fallback code, e.g. "LB2-4F9K", in case a
 * student's camera won't scan (bad lighting, cracked screen, etc.) —
 * they can type this in manually at a librarian's desk instead. */
export function generateBookingCode(floorNumber: number): string {
  const random = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `LB${floorNumber}-${random}`;
}
