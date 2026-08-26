import { prisma } from "./prisma";
import { notifyWaitlistPromoted } from "./notify";

/**
 * Call this anywhere a seat transitions to FREE (cancel endpoint,
 * check-in-expiry sweep, etc.) to pop the oldest waitlist entry and
 * mark it notified. The SQL sweep function (fn_expire_stale_bookings)
 * does the same promotion directly in Postgres for the common case —
 * this app-level version exists for paths like manual cancellation
 * where we're already in a Prisma call and want the notify() hook to
 * fire inline rather than waiting for the next sweep tick.
 */
export async function promoteNextWaitlistEntry(seatId: string) {
  const next = await prisma.waitlist.findFirst({
    where: { seatId, notified: false },
    orderBy: { joinedAt: "asc" },
  });

  if (!next) return null;

  const [updated, seat] = await Promise.all([
    prisma.waitlist.update({ where: { id: next.id }, data: { notified: true } }),
    prisma.seat.findUnique({ where: { id: seatId }, select: { seatCode: true } }),
  ]);

  await notifyWaitlistPromoted(next.userId, seat?.seatCode ?? seatId);

  return updated;
}
