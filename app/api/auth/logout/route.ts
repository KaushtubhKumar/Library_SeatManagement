import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * POST /api/auth/logout
 * Clears the session cookie. The User row itself isn't deleted — their
 * booking history stays in the DB, they'd just get a fresh anonymous
 * session (and identity) on their next visit unless they log back in
 * with the same rollNo/email via /api/auth/login.
 */
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("library_session_id");
  return NextResponse.json({ ok: true });
}
