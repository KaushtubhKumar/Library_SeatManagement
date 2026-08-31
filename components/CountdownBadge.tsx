"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/toast";

type ActiveBooking = { id: string; expiryTime: string };

/** Renders nothing when there's no active booking — mount once near the
 * root (BottomNav) so it's visible no matter which tab the student is on. */
export default function CountdownBadge() {
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const warnedRef = useRef(false);
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/bookings");
        const data = await res.json();
        if (cancelled) return;
        const active = (data.bookings ?? []).find((b: { status: string }) => b.status === "ACTIVE");
        setBooking(active ? { id: active.id, expiryTime: active.expiryTime } : null);
      } catch {
        // silent — countdown just won't update this tick
      }
    }
    poll();
    const interval = setInterval(poll, 20000); // re-sync with server every 20s
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
        show("Your seat hold expires in under 5 minutes — claim it now!", "error");
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
      className={`fixed bottom-16 inset-x-0 z-40 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors ${
        urgent ? "bg-red-950 text-red-300" : "bg-neutral-900 text-neutral-400"
      }`}
    >
      <span className={urgent ? "animate-pulse" : ""}>●</span>
      Seat held — {mins}:{secs.toString().padStart(2, "0")} left
      <span className="underline">Claim now</span>
    </Link>
  );
}