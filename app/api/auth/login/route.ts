import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession } from "@/lib/session";

/**
 * POST /api/auth/login   { name, rollNo?, email? }
 *
 * This project intentionally shipped with anonymous cookie-based
 * sessions (see lib/session.ts) so booking works with zero login
 * friction. This endpoint is the upgrade path: it attaches a real
 * name/rollNo/email to the SAME user row the cookie already points
 * to, so existing bookings/strikes/waitlist entries carry over rather
 * than starting a fresh identity.
 *
 * Not a password/OAuth flow — Thapar SSO or Google OAuth would replace
 * this entirely later, but the schema (rollNo/email already unique,
 * nullable columns on User) doesn't need to change to support that.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name as string | undefined;
  const rollNo = body?.rollNo as string | undefined;
  const email = body?.email as string | undefined;

  if (!name?.trim()) {
    return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  const user = await getOrCreateSession(name);

  if (!rollNo && !email) {
    // Name-only path — already satisfied by getOrCreateSession, nothing more to do.
    return NextResponse.json({ ok: true, user });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        rollNo: rollNo?.trim() || undefined,
        email: email?.trim().toLowerCase() || undefined,
      },
    });
    return NextResponse.json({ ok: true, user: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      // Unique constraint hit — that rollNo/email is already tied to a
      // DIFFERENT user row (e.g. they logged in from a new browser).
      return NextResponse.json(
        { ok: false, error: "ROLL_NO_OR_EMAIL_ALREADY_LINKED" },
        { status: 409 }
      );
    }
    console.error("Login/identify failed:", err);
    return NextResponse.json({ ok: false, error: "LOGIN_FAILED" }, { status: 500 });
  }
}
