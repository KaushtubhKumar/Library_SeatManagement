"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Skeleton from "@/components/Skeleton";
import ReliabilityBadge from "@/components/ReliabilityBadge";
import { useToast } from "@/lib/toast";
import { IconBan, IconUsers } from "@/lib/icons";

type Booking = {
  id: string;
  status: string;
  bookingCode: string;
  expiryTime: string;
  createdAt: string;
  groupId: string | null;
  isGroupOwnerSeat: boolean;
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [abortingGroupId, setAbortingGroupId] = useState<string | null>(null);
  const { show } = useToast();

  function load() {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data) => setBookings(data.bookings ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function cancelBooking(id: string) {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        show("Booking cancelled — the seat is free for others now.", "info");
        load();
      } else {
        show("Couldn't cancel that booking. Try again.", "error");
      }
    } catch {
      show("Something went wrong cancelling that booking.", "error");
    } finally {
      setCancellingId(null);
    }
  }

  async function abortGroup(groupId: string) {
    setAbortingGroupId(groupId);
    try {
      const res = await fetch(`/api/bookings/group/${groupId}/abort`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        show(`Cancelled ${data.cancelledCount} seat${data.cancelledCount === 1 ? "" : "s"} in the group.`, "info");
        load();
      } else {
        show("Couldn't cancel the group. Try again.", "error");
      }
    } catch {
      show("Something went wrong cancelling the group.", "error");
    } finally {
      setAbortingGroupId(null);
    }
  }

  function copyClaimLink(bookingId: string) {
    const url = `${window.location.origin}/claim/${bookingId}`;
    navigator.clipboard.writeText(url).then(
      () => show("Claim link copied — send it to your teammate.", "success"),
      () => show(url, "info")
    );
  }

  const active = bookings.filter((b) => b.status === "ACTIVE");
  const history = bookings.filter((b) => b.status !== "ACTIVE");

  // Group active bookings by groupId so a group's seats render as one
  // card with one "abort whole group" action, instead of N separate
  // cards that look unrelated. Solo bookings (groupId null) stay
  // ungrouped, one card each.
  const soloActive = active.filter((b) => !b.groupId);
  const groupedActive = new Map<string, Booking[]>();
  for (const b of active) {
    if (!b.groupId) continue;
    const list = groupedActive.get(b.groupId) ?? [];
    list.push(b);
    groupedActive.set(b.groupId, list);
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-display font-semibold mb-1">My Bookings</h1>
        <p className="text-neutral-400 mb-4 text-sm">
          Active holds and your recent booking history.
        </p>
        <div className="mb-8">
          <ReliabilityBadge />
        </div>

        {loading && (
          <div className="space-y-3 mb-8">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">
              Active — claim within your window
            </h2>
            <div className="space-y-3">
              {soloActive.map((b) => (
                <div key={b.id} className="rounded-xl border border-accent/40 bg-surface p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">
                        Floor {b.seat.zone.floor.floorNumber} · {b.seat.zone.name} · {b.seat.seatCode}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Holds until {new Date(b.expiryTime).toLocaleTimeString()}
                      </p>
                    </div>
                    <Link
                      href="/checkin-gate"
                      className="text-xs bg-accent hover:bg-accent-hover rounded-lg px-3 py-2 shrink-0"
                    >
                      Claim seat
                    </Link>
                  </div>
                  <button
                    onClick={() => cancelBooking(b.id)}
                    disabled={cancellingId === b.id}
                    className="text-xs text-neutral-500 hover:text-danger disabled:opacity-50 transition-colors"
                  >
                    {cancellingId === b.id ? "Cancelling…" : "Cancel this booking"}
                  </button>
                </div>
              ))}

              {Array.from(groupedActive.entries()).map(([groupId, seats]) => {
                const organizerSeat = seats.find((s) => s.isGroupOwnerSeat);
                const teammateSeats = seats.filter((s) => !s.isGroupOwnerSeat);
                return (
                  <div key={groupId} className="rounded-xl border border-accent/40 bg-surface p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <IconUsers width={15} height={15} className="text-accent" />
                      <p className="font-medium text-sm">
                        Group booking · {seats.length} seat{seats.length === 1 ? "" : "s"} ·{" "}
                        {seats[0].seat.zone.name}
                      </p>
                    </div>

                    {organizerSeat && (
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-neutral-800">
                        <span className="text-sm text-neutral-300">
                          Seat {organizerSeat.seat.seatCode} <span className="text-accent text-xs">(you)</span>
                        </span>
                        <Link
                          href="/checkin-gate"
                          className="text-xs bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5"
                        >
                          Claim seat
                        </Link>
                      </div>
                    )}

                    <div className="space-y-1.5 mb-3">
                      {teammateSeats.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span className="text-neutral-400">Seat {s.seat.seatCode}</span>
                          <button
                            onClick={() => copyClaimLink(s.id)}
                            className="text-xs text-accent hover:text-accent-hover underline"
                          >
                            Copy claim link
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => abortGroup(groupId)}
                      disabled={abortingGroupId === groupId}
                      className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-danger disabled:opacity-50 transition-colors"
                    >
                      <IconBan width={12} height={12} />
                      {abortingGroupId === groupId ? "Cancelling all…" : "Abort whole group"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {!loading && active.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center mb-8">
            <p className="text-neutral-400 text-sm mb-3">No active booking right now.</p>
            <Link href="/" className="text-accent text-sm font-medium">
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