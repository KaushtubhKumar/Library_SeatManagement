"use client";

import { useState } from "react";
import type { SeatDTO, BookingDTO } from "@/lib/types";
import { IconClose } from "@/lib/icons";
import { SESSION_DURATION_OPTIONS, formatDuration } from "@/lib/sessionDuration";

interface Props {
  seat: SeatDTO;
  zoneName: string;
  onClose: () => void;
  onBooked: (booking: BookingDTO) => void;
}

export default function BookingModal({ seat, zoneName, onClose, onBooked }: Props) {
  const [step, setStep] = useState<"confirm" | "booking" | "error">("confirm");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);

  async function handleConfirm() {
    setStep("booking");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatId: seat.id, durationMinutes: duration }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(
          data.error === "SEAT_ALREADY_BOOKED"
            ? "This seat was just booked by someone else. Pick another."
            : data.error === "TOO_MANY_ACTIVE_BOOKINGS"
            ? "You already have 2 active bookings. Check in or cancel one first."
            : "Couldn't complete the booking. Try again."
        );
        setStep("error");
        return;
      }
      onBooked(data.booking as BookingDTO);
    } catch {
      setError("Network error — check your connection and try again.");
      setStep("error");
    }
  }

  async function handleCancel() {
    // Release the soft lock immediately rather than waiting 60s
    fetch(`/api/seats/${seat.id}/lock`, { method: "DELETE" }).catch(() => {});
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl w-full sm:w-96 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-semibold">Seat {seat.seatCode}</h3>
          <button onClick={handleCancel} className="text-neutral-500 hover:text-neutral-300">
            <IconClose width={18} height={18} />
          </button>
        </div>

        <div className="space-y-2 mb-4 text-sm text-neutral-300">
          <Row label="Zone" value={zoneName} />
          <Row label="Type" value={seat.seatType.replace("_", " ")} />
          <Row label="Power socket" value={seat.hasPowerSocket ? "Yes" : "No"} />
          <Row label="Window seat" value={seat.hasWindow ? "Yes" : "No"} />
          <Row label="Claim window" value="30 minutes to arrive and claim it" />
        </div>

        {step === "confirm" && (
          <>
            <label className="text-xs text-neutral-500 uppercase tracking-wide">
              How long will you study?
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full mt-1 mb-5 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {SESSION_DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </select>

            <button
              onClick={handleConfirm}
              className="w-full bg-accent hover:bg-accent-hover rounded-lg py-3 font-medium transition-colors"
            >
              Confirm booking
            </button>
          </>
        )}

        {step === "booking" && (
          <button disabled className="w-full bg-accent/30 rounded-lg py-3 font-medium">
            Booking…
          </button>
        )}

        {step === "error" && (
          <div>
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={handleCancel}
              className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-lg py-3 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-neutral-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}