"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SeatMap from "@/components/SeatMap";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import BookingModal from "@/components/BookingModal";
import BookingSuccessPanel from "@/components/BookingSuccessPanel";
import GroupBookingModal from "@/components/GroupBookingModal";
import Skeleton from "@/components/Skeleton";
import { useSeatStream } from "@/lib/useSeatStream";
import { useToast } from "@/lib/toast";
import type { ZoneDTO, FloorDetail, SeatDTO, BookingDTO, SeatState } from "@/lib/types";

const STATE_COLOR: Record<string, string> = {
  FREE: "#7fa66b",
  LOCKED: "#c89b4a",
  BOOKED: "#cc8b4a",
  OCCUPIED: "#b5523f",
  MAINTENANCE: "#57534e",
};

export default function FloorPage() {
  const params = useParams<{ id: string }>();
  const floorId = params.id;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<{ seat: SeatDTO; zoneName: string } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingDTO | null>(null);
  const [filters, setFilters] = useState<{ power: boolean; window: boolean }>({ power: false, window: false });
  const [highlightZone, setHighlightZone] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const { show } = useToast();

  const loadFloor = useCallback(async () => {
    const res = await fetch(`/api/floors/${floorId}/seats`);
    const data = await res.json();
    if (data.ok) {
      setFloor(data.floor);
      setZones(data.zones);
    }
    setLoading(false);
  }, [floorId]);

  useEffect(() => {
    loadFloor();
  }, [loadFloor]);

  // Live updates: patch just the one seat that changed rather than
  // refetching the whole floor — this is the payoff of the SSE layer.
  useSeatStream((event) => {
    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        seats: zone.seats.map((seat) =>
          seat.id === event.seatId ? { ...seat, currentState: event.state as SeatState } : seat
        ),
      }))
    );
  });

  async function handleSeatClick(seat: SeatDTO, zoneName: string) {
    if (seat.currentState !== "FREE") return;

    // Optimistic update: lock the seat in local state AND open the
    // modal immediately, before the network call even resolves. This
    // is what makes it feel tactile — the UI reacts to the tap itself,
    // not to a round trip. If the server rejects the lock (someone
    // else grabbed it first), we roll both back.
    setZones((prev) =>
      prev.map((zone) => ({
        ...zone,
        seats: zone.seats.map((s) => (s.id === seat.id ? { ...s, currentState: "LOCKED" } : s)),
      }))
    );
    setSelectedSeat({ seat, zoneName });

    const res = await fetch(`/api/seats/${seat.id}/lock`, { method: "POST" });
    const data = await res.json();

    if (!data.ok) {
      // Roll back — the optimistic lock didn't hold.
      setZones((prev) =>
        prev.map((zone) => ({
          ...zone,
          seats: zone.seats.map((s) => (s.id === seat.id ? { ...s, currentState: "FREE" } : s)),
        }))
      );
      setSelectedSeat(null);
      show(
        data.error === "SEAT_LOCKED_BY_OTHER"
          ? "Someone else just grabbed this seat — try another."
          : "That seat isn't available anymore.",
        "error"
      );
    }
  }

  // Filters narrow the visible seat set without touching server state —
  // a seat that fails the filter still exists, just isn't clickable/shown
  // as a candidate. Passing filtered zones through keeps FloorPlanCanvas/
  // SeatMap unaware that filtering exists at all.
  const filteredZones = zones.map((zone) => ({
    ...zone,
    seats: zone.seats.filter((seat) => {
      if (filters.power && !seat.hasPowerSocket) return false;
      if (filters.window && !seat.hasWindow) return false;
      return true;
    }),
  }));

  const allSeats = zones.flatMap((z) => z.seats);
  const totalSeats = allSeats.length;
  const freeSeats = allSeats.filter((s) => s.currentState === "FREE").length;
  const occupancyPct = totalSeats > 0 ? Math.round(((totalSeats - freeSeats) / totalSeats) * 100) : 0;

  const zoneStats = zones.map((zone) => {
    const total = zone.seats.length;
    const free = zone.seats.filter((s) => s.currentState === "FREE").length;
    return { id: zone.id, name: zone.name, total, free };
  });

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← All floors
          </Link>
          <div className="flex items-center justify-between mt-1 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-display font-semibold">
                {floor ? `Floor ${floor.floorNumber}` : "Loading…"}
              </h1>
              <p className="text-sm text-neutral-500">Tap an available seat to book it</p>
            </div>
            {totalSeats > 0 && (
              <div className="text-right">
                <p className="text-sm font-medium text-neutral-200">
                  {freeSeats} of {totalSeats} seats free
                </p>
                <p className="text-xs text-neutral-500">{occupancyPct}% occupied right now</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setFilters((f) => ({ ...f, power: !f.power }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filters.power
                  ? "bg-accent border-accent text-white"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              ⚡ Power socket
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, window: !f.window }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filters.window
                  ? "bg-accent border-accent text-white"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              🪟 Window seat
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              className="text-xs px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-400 hover:border-neutral-500 transition-colors ml-auto"
            >
              👥 Book for a group
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div>
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-96 w-full" />
            </div>
          )}

          {floor && floor.imageWidth && floor.imageHeight ? (
            <FloorPlanCanvas zones={filteredZones} onSeatClick={handleSeatClick} />
          ) : (
            floor && <SeatMap floor={floor} zones={filteredZones} onSeatClick={handleSeatClick} />
          )}
        </div>

        {!loading && totalSeats > 0 && (
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="bg-surface border border-surface-border rounded-xl p-4">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                Legend
              </h2>
              <div className="space-y-2">
                {Object.entries(STATE_COLOR).map(([state, color]) => (
                  <div key={state} className="flex items-center gap-2 text-xs text-neutral-400">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
                    {state.charAt(0) + state.slice(1).toLowerCase()}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-surface-border rounded-xl p-4">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">
                Zones on this floor
              </h2>
              <div className="space-y-3">
                {zoneStats.map((z) => (
                  <div
                    key={z.id}
                    onMouseEnter={() => setHighlightZone(z.id)}
                    onMouseLeave={() => setHighlightZone(null)}
                    className={`text-xs rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                      highlightZone === z.id ? "bg-neutral-800" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-neutral-300 font-medium">{z.name}</span>
                      <span className="text-neutral-500">
                        {z.free}/{z.total} free
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all"
                        style={{ width: `${z.total > 0 ? (z.free / z.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface border border-surface-border rounded-xl p-4">
              <h2 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                Booking rules
              </h2>
              <ul className="text-xs text-neutral-500 space-y-1.5 leading-relaxed">
                <li>• Seats are held for 30 minutes after booking</li>
                <li>• Claim your seat by visiting the library and confirming your location</li>
                <li>• No-shows lower your reliability score</li>
                <li>• On-time check-ins raise your priority in waitlists</li>
              </ul>
            </div>
          </aside>
        )}
      </div>

      {showGroupModal && (
        <GroupBookingModal
          zones={zones}
          onClose={() => setShowGroupModal(false)}
          onBooked={loadFloor}
        />
      )}

      {selectedSeat && !confirmedBooking && (
        <BookingModal
          seat={selectedSeat.seat}
          zoneName={selectedSeat.zoneName}
          onClose={() => {
            const seatId = selectedSeat.seat.id;
            setSelectedSeat(null);
            setZones((prev) =>
              prev.map((zone) => ({
                ...zone,
                seats: zone.seats.map((s) => (s.id === seatId ? { ...s, currentState: "FREE" } : s)),
              }))
            );
          }}
          onBooked={(booking) => {
            setConfirmedBooking(booking);
          }}
        />
      )}

      {confirmedBooking && (
        <BookingSuccessPanel
          booking={confirmedBooking}
          onClose={() => {
            setConfirmedBooking(null);
            setSelectedSeat(null);
            loadFloor();
          }}
        />
      )}
    </main>
  );
}