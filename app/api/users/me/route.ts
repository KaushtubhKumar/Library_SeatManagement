import { NextResponse } from "next/server";
import { getOrCreateSession } from "@/lib/session";

/** GET /api/users/me — current session's user, creating one if needed. */
export async function GET() {
  const user = await getOrCreateSession();
  return NextResponse.json({ ok: true, user });
}
