/**
 * lib/notify.ts
 *
 * A single choke point for outbound notifications. Right now it just
 * logs — actually sending email/SMS/push needs a provider (Resend,
 * Twilio, web push keys) and credentials this project doesn't have.
 * Every call site below is already wired correctly; swapping the
 * console.log body for a real provider call is the only change needed
 * later, nothing calling notify() needs to change.
 */

interface NotifyPayload {
  userId: string;
  type: "WAITLIST_PROMOTED" | "BOOKING_EXPIRING_SOON" | "ACCOUNT_SUSPENDED";
  message: string;
  meta?: Record<string, unknown>;
}

export async function notify(payload: NotifyPayload) {
  // TODO(production): replace with a real provider, e.g.:
  //   await resend.emails.send({ to: user.email, ... })
  // or a web-push subscription lookup + push.sendNotification(...)
  console.log(`[notify] ${payload.type} → user ${payload.userId}: ${payload.message}`, payload.meta ?? "");
}

export async function notifyWaitlistPromoted(userId: string, seatCode: string) {
  return notify({
    userId,
    type: "WAITLIST_PROMOTED",
    message: `Seat ${seatCode} is free — you're next in line. Book it before someone else does.`,
    meta: { seatCode },
  });
}

export async function notifyAccountSuspended(userId: string, suspendedUntil: Date) {
  return notify({
    userId,
    type: "ACCOUNT_SUSPENDED",
    message: `Your booking privileges are paused until ${suspendedUntil.toISOString()} after repeated no-shows.`,
    meta: { suspendedUntil },
  });
}
