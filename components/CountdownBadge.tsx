"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/toast";
import { IconClock } from "@/lib/icons";

type ActiveBooking = { id: string; expiryTime: string };

/** Fired by the checkin-gate/claim pages the instant a seat is
 * successfully claimed, so this badge disappears immediately instead
 * of waiting for its next 20s poll. */
export const SEAT_CLAIMED_EVENT = "app:seat-claimed";

/** Renders nothing when there's no active booking. Rendered inside
 * BottomNav's fixed wrapper, directly above the tab row — not
 * independently fixed itself, so there's no gap between them. */
export default function CountdownBadge() {
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warnedRef = useRef(false);
  const { show } = useToast();

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      const data = await res.json();
      const active = (data.bookings ?? []).find((b: { status: string }) => b.status === "ACTIVE");
      setBooking(active ? { id: active.id, expiryTime: active.expiryTime } : null);
    } catch {
      // silent — countdown just won't update this tick
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 20000);
    // Instant refresh the moment a claim succeeds anywhere in the app,
    // instead of waiting up to 20s for the next scheduled poll.
    window.addEventListener(SEAT_CLAIMED_EVENT, poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener(SEAT_CLAIMED_EVENT, poll);
    };
  }, [poll]);

  useEffect(() => {
    if (!booking) {
      setSecondsLeft(null);
      warnedRef.current = false;
      return;
    }
    const tick = () => {
      const diff = Math.round((new Date(booking.expiryTime).getTime() - Date.now()) / 1000);
      setSecondsLeft(diff);
      if (diff <= 300 && diff > 0 && !warnedRef.current) {
        warnedRef.current = true;
        show("Your seat hold expires in under 5 minutes — claim it now.", "error");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [booking, show]);

  if (!booking || secondsLeft === null || secondsLeft <= 0) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft <= 300;

  return (
    <Link
      href="/checkin-gate"
      className={`flex items-center justify-center gap-2 py-2 text-xs font-medium border-t transition-colors ${
        urgent
          ? "bg-red-950 text-red-300 border-red-900"
          : "bg-neutral-900 text-neutral-400 border-neutral-800"
      }`}
    >
      <IconClock width={13} height={13} className={urgent ? "animate-pulse" : ""} />
      Seat held — {mins}:{secs.toString().padStart(2, "0")} left
      <span className="underline">Claim now</span>
    </Link>
  );
}