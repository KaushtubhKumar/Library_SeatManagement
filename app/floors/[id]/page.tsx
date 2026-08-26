"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import SeatMap from "@/components/SeatMap";
import FloorPlanCanvas from "@/components/FloorPlanCanvas";
import BookingModal from "@/components/BookingModal";
import BookingSuccessPanel from "@/components/BookingSuccessPanel";
import { useSeatStream } from "@/lib/useSeatStream";
import type { ZoneDTO, FloorDetail, SeatDTO, BookingDTO, SeatState } from "@/lib/types";

export default function FloorPage() {
  const params = useParams<{ id: string }>();
  const floorId = params.id;

  const [floor, setFloor] = useState<FloorDetail | null>(null);
  const [zones, setZones] = useState<ZoneDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<{ seat: SeatDTO; zoneName: string } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingDTO | null>(null);

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
      alert(
        data.error === "SEAT_LOCKED_BY_OTHER"
          ? "Someone else just grabbed this seat — try another."
          : "That seat isn't available anymore."
      );
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← All floors
          </Link>
          <h1 className="text-2xl font-semibold mt-1">
            {floor ? `Floor ${floor.floorNumber}` : "Loading…"}
          </h1>
          <p className="text-sm text-neutral-500">Tap an available seat to book it</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading && <p className="text-neutral-500">Loading seat map…</p>}

        {floor && floor.imageWidth && floor.imageHeight ? (
          <FloorPlanCanvas zones={zones} onSeatClick={handleSeatClick} />
        ) : (
          floor && <SeatMap floor={floor} zones={zones} onSeatClick={handleSeatClick} />
        )}
      </div>

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