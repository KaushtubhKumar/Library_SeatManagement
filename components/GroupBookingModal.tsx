"use client";

import { useState } from "react";
import type { ZoneDTO } from "@/lib/types";
import { useToast } from "@/lib/toast";
import { SESSION_DURATION_OPTIONS, formatDuration } from "@/lib/sessionDuration";
import { IconClose, IconCheck, IconUsers } from "@/lib/icons";

interface Props {
  zones: ZoneDTO[];
  onClose: () => void;
  onBooked: () => void;
}

type Mode = "auto" | "manual";
type Step = "setup" | "confirmPartial" | "success" | "notEnough";

type BookedSeat = { seatCode: string; bookingCode: string; bookingId: string; isOrganizer: boolean };
type ProposedSeat = { id: string; seatCode: string; isContiguous: boolean };

export default function GroupBookingModal({ zones, onClose, onBooked }: Props) {
  const [mode, setMode] = useState<Mode>("auto");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [count, setCount] = useState(2);
  const [duration, setDuration] = useState(30);
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("setup");
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<ProposedSeat[]>([]);
  const [contiguousCount, setContiguousCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);
  const [result, setResult] = useState<{ seats: BookedSeat[]; groupId: string } | null>(null);
  const { show } = useToast();

  const currentZone = zones.find((z) => z.id === zoneId);
  const freeSeatsInZone = currentZone?.seats.filter((s) => s.currentState === "FREE") ?? [];

  function toBooked(data: { bookings: { id: string; bookingCode: string; isGroupOwnerSeat: boolean }[]; seatCodes: string[]; groupId: string }) {
    const seats: BookedSeat[] = data.bookings.map((b, i) => ({
      seatCode: data.seatCodes[i],
      bookingCode: b.bookingCode,
      bookingId: b.id,
      isOrganizer: b.isGroupOwnerSeat,
    }));
    setResult({ seats, groupId: data.groupId });
    setStep("success");
    onBooked();
  }

  async function submitAuto(confirmSeatIds?: string[]) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto", zoneId, count, durationMinutes: duration, confirmSeatIds }),
      });
      const data = await res.json();

      if (data.ok && data.needsConfirmation) {
        setProposal(data.proposedSeats);
        setContiguousCount(data.contiguousCount);
        setStep("confirmPartial");
      } else if (data.ok) {
        toBooked(data);
      } else if (data.error === "NOT_ENOUGH_SEATS") {
        setAvailableCount(data.availableCount ?? 0);
        setStep("notEnough");
      } else {
        show("Couldn't complete the group booking. Try again.", "error");
      }
    } catch {
      show("Something went wrong with the group booking.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitManual() {
    if (manualSelected.length < 2) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual", seatIds: manualSelected, durationMinutes: duration }),
      });
      const data = await res.json();
      if (data.ok) {
        toBooked(data);
      } else if (data.error === "SEAT_NO_LONGER_FREE") {
        show("One of the picked seats isn't free anymore — refresh and try again.", "error");
      } else {
        show("Couldn't complete the group booking. Try again.", "error");
      }
    } catch {
      show("Something went wrong with the group booking.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleManualSeat(seatId: string) {
    setManualSelected((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId);
      if (prev.length >= 4) return prev;
      return [...prev, seatId];
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-sm p-6 max-h-[85vh] overflow-y-auto">
        {step === "setup" && (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-display font-semibold">Book for a group</h2>
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
                <IconClose width={18} height={18} />
              </button>
            </div>
            <p className="text-sm text-neutral-500 mb-5">
              Up to 4 seats. Pick automatically or choose seats yourself.
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMode("auto")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                  mode === "auto" ? "bg-accent border-accent text-white" : "border-neutral-700 text-neutral-400"
                }`}
              >
                Auto-assign
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                  mode === "manual" ? "bg-accent border-accent text-white" : "border-neutral-700 text-neutral-400"
                }`}
              >
                Pick myself
              </button>
            </div>

            <label className="text-xs text-neutral-500 uppercase tracking-wide">Zone</label>
            <select
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value);
                setManualSelected([]);
              }}
              className="w-full mt-1 mb-4 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>

            {mode === "auto" ? (
              <>
                <label className="text-xs text-neutral-500 uppercase tracking-wide">Group size</label>
                <div className="flex gap-2 mt-1 mb-4">
                  {[2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setCount(n)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium border transition-colors ${
                        count === n ? "bg-accent border-accent text-white" : "border-neutral-700 text-neutral-400"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <label className="text-xs text-neutral-500 uppercase tracking-wide">
                  Pick 2-4 seats ({manualSelected.length} selected)
                </label>
                <div className="grid grid-cols-5 gap-1.5 mt-1 mb-4 max-h-40 overflow-y-auto p-1">
                  {freeSeatsInZone.map((seat) => (
                    <button
                      key={seat.id}
                      onClick={() => toggleManualSeat(seat.id)}
                      className={`text-[10px] rounded-md py-2 border transition-colors ${
                        manualSelected.includes(seat.id)
                          ? "bg-accent border-accent text-white"
                          : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
                      }`}
                    >
                      {seat.seatCode.split("-").pop()}
                    </button>
                  ))}
                  {freeSeatsInZone.length === 0 && (
                    <p className="col-span-5 text-xs text-neutral-600 py-4 text-center">No free seats in this zone.</p>
                  )}
                </div>
              </>
            )}

            <label className="text-xs text-neutral-500 uppercase tracking-wide">Session length</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full mt-1 mb-6 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              {SESSION_DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatDuration(m)}
                </option>
              ))}
            </select>

            <button
              onClick={() => (mode === "auto" ? submitAuto() : submitManual())}
              disabled={submitting || !zoneId || (mode === "manual" && manualSelected.length < 2)}
              className="w-full rounded-lg py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {submitting ? "Booking…" : mode === "auto" ? `Book ${count} seats` : `Book ${manualSelected.length || "—"} seats`}
            </button>
          </>
        )}

        {step === "confirmPartial" && (
          <>
            <h2 className="text-lg font-display font-semibold mb-1">Not all seats together</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Found {contiguousCount} seat{contiguousCount === 1 ? "" : "s"} together — the rest are the
              closest free seats nearby.
            </p>
            <div className="space-y-2 mb-6">
              {proposal.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-neutral-300">Seat {s.seatCode}</span>
                  <span className={`text-xs ${s.isContiguous ? "text-accent" : "text-neutral-500"}`}>
                    {s.isContiguous ? "Together" : "Nearby"}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("setup")}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium border border-neutral-700 text-neutral-400"
              >
                Back
              </button>
              <button
                onClick={() => submitAuto(proposal.map((s) => s.id))}
                disabled={submitting}
                className="flex-1 rounded-lg py-2.5 text-sm font-medium bg-accent hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? "Booking…" : "Continue anyway"}
              </button>
            </div>
          </>
        )}

        {step === "notEnough" && (
          <>
            <div className="text-center mb-5">
              <IconUsers width={36} height={36} className="mx-auto text-neutral-600 mb-3" />
              <h2 className="text-lg font-display font-semibold">Not enough seats to accommodate group</h2>
              <p className="text-sm text-neutral-500 mt-2">
                Only {availableCount} free seat{availableCount === 1 ? "" : "s"} left in this zone —
                try a smaller group or a different zone.
              </p>
            </div>
            <button
              onClick={() => setStep("setup")}
              className="w-full rounded-lg py-2.5 text-sm font-medium bg-neutral-800 hover:bg-neutral-700"
            >
              Back
            </button>
          </>
        )}

        {step === "success" && result && (
          <>
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-emerald-950 border-2 border-emerald-700 flex items-center justify-center">
                <IconCheck width={22} height={22} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-display font-semibold">Seats booked</h2>
              <p className="text-sm text-neutral-500 mt-1">
                Held for 30 minutes. You claim your own seat at the library — send each teammate
                their own link below to claim theirs. Each link only works for that one seat.
              </p>
            </div>
            <div className="space-y-2 mb-4">
              {result.seats.map((s) => (
                <div key={s.bookingId} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neutral-300">
                      Seat {s.seatCode} {s.isOrganizer && <span className="text-accent">(you)</span>}
                    </span>
                    <span className="font-mono text-xs text-neutral-500">{s.bookingCode}</span>
                  </div>
                  {!s.isOrganizer && (
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/claim/${s.bookingId}`;
                        navigator.clipboard.writeText(url).then(
                          () => show("Claim link copied — send it to your teammate.", "success"),
                          () => show(url, "info")
                        );
                      }}
                      className="text-xs text-accent hover:text-accent-hover underline"
                    >
                      Copy claim link for this seat
                    </button>
                  )}
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