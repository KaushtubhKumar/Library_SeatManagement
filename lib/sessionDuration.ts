/** Study-session length options, in minutes. Chosen at booking time,
 * applied to sessionExpiresAt once the student actually checks in —
 * separate from the fixed 30-min claim window before check-in. */
export const SESSION_DURATION_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240] as const;
export type SessionDurationMinutes = (typeof SESSION_DURATION_OPTIONS)[number];

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h 30m`;
}

export function isValidSessionDuration(value: unknown): value is SessionDurationMinutes {
  return typeof value === "number" && (SESSION_DURATION_OPTIONS as readonly number[]).includes(value);
}