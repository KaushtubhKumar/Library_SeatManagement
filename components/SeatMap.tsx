"use client";

import { useState } from "react";
import type { SeatDTO, ZoneDTO, FloorDetail } from "@/lib/types";
import { IconUsers, IconPower } from "@/lib/icons";

const STATE_STYLES: Record<string, { seat: string; label: string; dot: string }> = {
  FREE: {
    seat: "bg-emerald-500/10 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white cursor-pointer",
    label: "Available",
    dot: "bg-emerald-500",
  },
  LOCKED: {
    seat: "bg-amber-500/10 border-amber-500 text-amber-400 cursor-not-allowed",
    label: "Being booked",
    dot: "bg-amber-500",
  },
  BOOKED: {
    seat: "bg-orange-500/10 border-orange-500 text-orange-400 cursor-not-allowed",
    label: "Booked",
    dot: "bg-orange-500",
  },
  OCCUPIED: {
    seat: "bg-red-500/10 border-red-500 text-red-400 cursor-not-allowed",
    label: "Occupied",
    dot: "bg-red-500",
  },
  MAINTENANCE: {
    seat: "bg-neutral-700/30 border-neutral-700 text-neutral-600 cursor-not-allowed",
    label: "Unavailable",
    dot: "bg-neutral-600",
  },
};

// Zone-type visual distinction is now handled inline (see render) —
// SILENT/DISCUSSION use no icon (text label is enough), GROUP uses
// IconUsers, since a full icon-per-type set added visual noise without
// adding information the zone name doesn't already carry.

interface Props {
  floor: FloorDetail;
  zones: ZoneDTO[];
  onSeatClick: (seat: SeatDTO, zoneName: string) => void;
}

const SEATS_PER_ROW = 6;

export default function SeatMap({ zones, onSeatClick }: Props) {
  const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4 bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
        {Object.entries(STATE_STYLES).map(([state, style]) => (
          <div key={state} className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`w-3 h-3 rounded-[4px] ${style.dot}`} />
            {style.label}
          </div>
        ))}
      </div>

      <div className="text-center">
        <div className="h-1.5 mx-auto max-w-md rounded-full bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-2" />
        <p className="text-[11px] tracking-[0.3em] text-neutral-600 uppercase">Entrance this side</p>
      </div>

      {zones.map((zone) => (
        <section key={zone.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{zone.zoneType === "GROUP" ? <IconUsers width={16} height={16} className="text-neutral-400" /> : null}</span>
            <h3 className="font-medium text-neutral-200">{zone.name}</h3>
            <span className="text-xs text-neutral-500">
              ({zone.seats.filter((s) => s.currentState === "FREE").length}/{zone.seats.length} free)
            </span>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-5">
            <div className="flex flex-col items-center gap-2.5">
              {chunk(zone.seats, SEATS_PER_ROW).map((row, rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-2.5">
                  <span className="w-5 text-[10px] text-neutral-600 text-right">
                    {String.fromCharCode(65 + rowIdx)}
                  </span>
                  {row.map((seat) => {
                    const style = STATE_STYLES[seat.currentState];
                    const disabled = seat.currentState !== "FREE";
                    return (
                      <button
                        key={seat.id}
                        disabled={disabled}
                        onClick={() => onSeatClick(seat, zone.name)}
                        onMouseEnter={() => setHoveredSeat(seat.id)}
                        onMouseLeave={() => setHoveredSeat(null)}
                        title={`${seat.seatCode} — ${style.label}`}
                        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-t-lg rounded-b-md border-2 flex items-center justify-center text-[10px] font-medium transition-all duration-100 active:scale-90 ${style.seat} ${
                          hoveredSeat === seat.id && !disabled ? "scale-110 shadow-lg shadow-emerald-500/20" : ""
                        }`}
                      >
                        {seat.hasPowerSocket && (
                          <IconPower
                            width={9}
                            height={9}
                            className="absolute -top-1 -right-1 text-accent"
                            strokeWidth={2.5}
                          />
                        )}
                        {seat.seatCode.split("-").pop()?.replace(/^0+/, "") || seat.seatCode}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}