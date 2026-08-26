import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "library_session_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Returns the current anonymous User, creating one (and setting the
 * cookie) on first visit. No login — just a name typed once and
 * remembered via cookie. Swappable for real auth later since every
 * other table already references User.id, not the session mechanism.
 */
export async function getOrCreateSession(name?: string) {
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (existingSessionId) {
    const user = await prisma.user.findUnique({
      where: { sessionId: existingSessionId },
    });
    if (user) return user;
    // Cookie present but user row missing (e.g. DB reset) — fall through
    // and create a fresh one.
  }

  const user = await prisma.user.create({
    data: { name: name?.trim() || "Guest Student" },
  });

  cookieStore.set(SESSION_COOKIE, user.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return user;
}

/** Read-only lookup — returns null instead of creating a user. Use this
 * for endpoints that should 401 rather than silently create a guest. */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  return prisma.user.findUnique({ where: { sessionId } });
}
