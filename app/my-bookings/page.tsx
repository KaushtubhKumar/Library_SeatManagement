"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  status: string;
  bookingCode: string;
  expiryTime: string;
  createdAt: string;
  seat: {
    seatCode: string;
    zone: { name: string; floor: { floorNumber: number } };
  };
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-yellow-950 text-yellow-400",
  CHECKED_IN: "bg-green-950 text-green-400",
  COMPLETED: "bg-neutral-800 text-neutral-400",
  EXPIRED: "bg-red-950 text-red-400",
  CANCELLED: "bg-neutral-800 text-neutral-500",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings ?? []))
      .finally(() => setLoading(false));
  }, []);

  const active = bookings.filter((b) => b.status === "ACTIVE");
  const history = bookings.filter((b) => b.status !== "ACTIVE");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-1">My Bookings</h1>
        <p className="text-neutral-400 mb-8 text-sm">
          Active holds and your recent booking history.
        </p>

        {loading && <p className="text-neutral-500 text-sm">Loading…</p>}

        {!loading && active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
              Active — claim within your window
            </h2>
            <div className="space-y-3">
              {active.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-purple-900 bg-neutral-900 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      Floor {b.seat.zone.floor.floorNumber} · {b.seat.zone.name} ·{" "}
                      {b.seat.seatCode}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Holds until {new Date(b.expiryTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <Link
                    href="/checkin-gate"
                    className="text-xs bg-purple-700 hover:bg-purple-600 rounded-lg px-3 py-2 shrink-0"
                  >
                    Claim seat
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && active.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center mb-8">
            <p className="text-neutral-400 text-sm mb-3">No active booking right now.</p>
            <Link href="/" className="text-purple-400 text-sm font-medium">
              Book a seat →
            </Link>
          </div>
        )}

        {!loading && history.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
              History
            </h2>
            <div className="space-y-2">
              {history.map((b) => (
                <div
                  key={b.id}
                  className="rounded-lg border border-neutral-800 p-3 flex items-center justify-between text-sm"
                >
                  <span className="text-neutral-300">
                    Floor {b.seat.zone.floor.floorNumber} · {b.seat.seatCode}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      STATUS_STYLE[b.status] ?? "bg-neutral-800 text-neutral-400"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}