"use client";

import { useState } from "react";
import type { ZoneDTO } from "@/lib/types";
import { useToast } from "@/lib/toast";

interface Props {
  zones: ZoneDTO[];
  onClose: () => void;
  onBooked: () => void;
}

type BookedSeat = { seatCode: string; bookingCode: string };

export default function GroupBookingModal({ zones, onClose, onBooked }: Props) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [count, setCount] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookedSeat[] | null>(null);
  const { show } = useToast();

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId, count }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult(
          data.bookings.map((b: { bookingCode: string }, i: number) => ({
            seatCode: data.seatCodes[i],
            bookingCode: b.bookingCode,
          }))
        );
        onBooked();
      } else {
        show(
          data.error === "NOT_ENOUGH_FREE_SEATS"
            ? "Not enough free seats in that zone right now."
            : data.error === "NO_ADJACENT_CLUSTER_FOUND"
            ? "Couldn't find enough seats together — try a different zone or smaller group."
            : "Couldn't complete the group booking. Try again.",
          "error"
        );
      }
    } catch {
      show("Something went wrong with the group booking.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-sm p-6">
        {!result ? (
          <>
            <h2 className="text-lg font-semibold mb-1">Book for a group</h2>
            <p className="text-sm text-neutral-500 mb-5">
              We'll find up to 4 seats sitting together in one zone.
            </p>

            <label className="text-xs text-neutral-500 uppercase tracking-wide">Zone</label>
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="w-full mt-1 mb-4 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            <label className="text-xs text-neutral-500 uppercase tracking-wide">Group size</label>
            <div className="flex gap-2 mt-1 mb-6">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                    count === n
                      ? "bg-accent border-accent text-white"
                      : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium border border-neutral-700 text-neutral-400 hover:border-neutral-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !zoneId}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {submitting ? "Booking…" : `Book ${count} seats`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">✓</div>
              <h2 className="text-lg font-semibold">Seats booked!</h2>
              <p className="text-sm text-neutral-500 mt-1">
                Held for 30 minutes — everyone claims their own seat at the library.
              </p>
            </div>
            <div className="space-y-2 mb-6">
              {result.map((r) => (
                <div
                  key={r.seatCode}
                  className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-neutral-300">Seat {r.seatCode}</span>
                  <span className="font-mono text-accent">{r.bookingCode}</span>
                </div>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}