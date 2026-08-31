import { prisma } from "./prisma";
import { notifyWaitlistPromoted } from "./notify";

/**
 * Call this anywhere a seat transitions to FREE (cancel endpoint,
 * check-in-expiry sweep, etc.) to pop the highest-priority waitlist
 * entry and mark it notified. Order is priorityScore DESC (banded
 * reliabilityScore — reward on-time check-ins, penalize no-shows),
 * then joinedAt ASC, mirroring fn_expire_stale_bookings's SQL version.
 * This app-level version exists for paths like manual cancellation
 * where we're already in a Prisma call and want the notify() hook to
 * fire inline rather than waiting for the next sweep tick.
 */
export async function promoteNextWaitlistEntry(seatId: string) {
  const next = await prisma.waitlist.findFirst({
    where: { seatId, notified: false },
    orderBy: [{ priorityScore: "desc" }, { joinedAt: "asc" }],
  });

  if (!next) return null;

  const [updated, seat] = await Promise.all([
    prisma.waitlist.update({ where: { id: next.id }, data: { notified: true } }),
    prisma.seat.findUnique({ where: { id: seatId }, select: { seatCode: true } }),
  ]);

  await notifyWaitlistPromoted(next.userId, seat?.seatCode ?? seatId);

  return updated;
}