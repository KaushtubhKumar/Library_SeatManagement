"use client";

import { useState } from "react";
import type { SeatDTO, ZoneDTO } from "@/lib/types";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  STANDARD_SEAT_RADIUS,
  FLOOR_1_SEAT_BLOCKS,
  FLOOR_1_DISCUSSION_ROOMS,
  FLOOR_1_FEATURES,
  FLOOR_1_OUTLINE,
  seatCountFor,
  type IconType,
} from "@/lib/floorPlanConfig";

const STATE_FILL: Record<string, string> = {
  FREE: "#10b981",
  LOCKED: "#f59e0b",
  BOOKED: "#f97316",
  OCCUPIED: "#ef4444",
  MAINTENANCE: "#525252",
};

const LEGEND_ICONS: { type: IconType; label: string }[] = [
  { type: "lift", label: "Lift" },
  { type: "washroom-male", label: "Washroom (M)" },
  { type: "washroom-female", label: "Washroom (F)" },
  { type: "bookshelf", label: "Book Shelves" },
  { type: "stairs", label: "Stairs" },
];

interface Props {
  zones: ZoneDTO[];
  onSeatClick: (seat: SeatDTO, zoneName: string) => void;
}

export default function FloorPlanCanvas({ zones, onSeatClick }: Props) {
  const [hovered, setHovered] = useState<SeatDTO | null>(null);
  const allSeats = zones.flatMap((z) => z.seats.map((s) => ({ ...s, zoneName: z.name })));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-neutral-400">
        {Object.entries(STATE_FILL).map(([state, color]) => (
          <div key={state} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
            {state.charAt(0) + state.slice(1).toLowerCase()}
          </div>
        ))}
      </div>

      {/* Furniture/wayfinding legend — separate from seat-state legend
          so the map reads clearly without hovering over every icon */}
      <div className="flex flex-wrap items-center gap-4 bg-neutral-900/40 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-400">
        {LEGEND_ICONS.map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5">
            <svg width={20} height={20} viewBox="0 0 20 20">
              <FeatureIcon type={type} cx={10} cy={10} />
            </svg>
            {label}
          </div>
        ))}
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-3">
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full h-auto"
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        >
          <rect x={FLOOR_1_OUTLINE.x} y={FLOOR_1_OUTLINE.y} width={FLOOR_1_OUTLINE.w} height={FLOOR_1_OUTLINE.h} rx={16} fill="#0a0a0a" stroke="#404040" strokeWidth={2} />

          {FLOOR_1_SEAT_BLOCKS.map((block) => (
            <g key={block.id}>
              <TableBars block={block} />
              <text x={block.x + block.w / 2} y={block.y + 12} textAnchor="middle" fontSize={9} fill="#737373">
                {seatCountFor(block)} seats
              </text>
            </g>
          ))}

          {FLOOR_1_DISCUSSION_ROOMS.map((room) => (
            <g key={room.id}>
              <circle cx={room.cx} cy={room.cy} r={room.outerRadius} fill="#171717" stroke="#404040" strokeDasharray="4 3" />
              <text x={room.cx} y={room.cy - room.outerRadius + 12} textAnchor="middle" fontSize={9} fill="#a3a3a3">
                {room.capacity} seats
              </text>
            </g>
          ))}

          {FLOOR_1_FEATURES.map((f, i) => (
            <Feature key={i} feature={f} />
          ))}

          {allSeats.map((seat) => {
            const r = STANDARD_SEAT_RADIUS;
            const clickR = r + 3;
            return (
              <g key={seat.id}>
                <rect
                  x={seat.posX * CANVAS_WIDTH - clickR}
                  y={seat.posY * CANVAS_HEIGHT - clickR}
                  width={clickR * 2}
                  height={clickR * 2}
                  fill="transparent"
                  className={seat.currentState === "FREE" ? "cursor-pointer" : "cursor-not-allowed"}
                  onClick={() => seat.currentState === "FREE" && onSeatClick(seat, seat.zoneName)}
                  onMouseEnter={() => setHovered(seat)}
                  onMouseLeave={() => setHovered(null)}
                />
                <rect
                  x={seat.posX * CANVAS_WIDTH - r}
                  y={seat.posY * CANVAS_HEIGHT - r}
                  width={r * 2}
                  height={r * 2}
                  rx={3}
                  fill={STATE_FILL[seat.currentState]}
                  stroke="#000"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                  pointerEvents="none"
                >
                  <title>{`${seat.seatCode} — ${seat.currentState}`}</title>
                </rect>
              </g>
            );
          })}

          {hovered && (
            <g pointerEvents="none">
              <rect x={hovered.posX * CANVAS_WIDTH - 34} y={hovered.posY * CANVAS_HEIGHT - 32} width={68} height={18} rx={4} fill="#171717" stroke="#404040" />
              <text x={hovered.posX * CANVAS_WIDTH} y={hovered.posY * CANVAS_HEIGHT - 19} textAnchor="middle" fontSize={10} fill="#e5e5e5">
                {hovered.seatCode}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function TableBars({ block }: { block: (typeof FLOOR_1_SEAT_BLOCKS)[number] }) {
  const bars = [];
  if (block.orientation === "h") {
    const rowH = block.h / block.rows;
    for (let i = 0; i < block.rows; i++) {
      const cy = block.y + rowH * (i + 0.5);
      bars.push(<rect key={i} x={block.x + 6} y={cy - 4} width={block.w - 12} height={8} rx={3} fill="#262626" stroke="#404040" />);
    }
  } else {
    const colW = block.w / block.rows;
    for (let i = 0; i < block.rows; i++) {
      const cx = block.x + colW * (i + 0.5);
      bars.push(<rect key={i} x={cx - 4} y={block.y + 6} width={8} height={block.h - 12} rx={3} fill="#262626" stroke="#404040" />);
    }
  }
  return <>{bars}</>;
}

function Feature({ feature }: { feature: (typeof FLOOR_1_FEATURES)[number] }) {
  if (feature.kind === "rect") {
    const cx = feature.x + feature.w / 2;
    const cy = feature.y + feature.h / 2 - 6;
    return (
      <g>
        <rect x={feature.x} y={feature.y} width={feature.w} height={feature.h} rx={10} fill="#171717" stroke="#404040" strokeDasharray="4 3" />
        <FeatureIcon type={feature.icon} cx={cx} cy={cy} />
        <text x={feature.x + feature.w / 2} y={feature.y + feature.h / 2 + 18} textAnchor="middle" fontSize={9} fill="#a3a3a3">
          {feature.label}
        </text>
      </g>
    );
  }
  if (feature.kind === "arrow") {
    return (
      <g>
        <line x1={feature.x1} y1={feature.y1} x2={feature.x2} y2={feature.y2} stroke="#737373" strokeWidth={1.5} markerEnd="url(#arrowhead)" />
        <text x={(feature.x1 + feature.x2) / 2 + 8} y={(feature.y1 + feature.y2) / 2} fontSize={9} fill="#737373">
          {feature.label}
        </text>
        <defs>
          <marker id="arrowhead" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#737373" />
          </marker>
        </defs>
      </g>
    );
  }
  return <line x1={feature.x1} y1={feature.y1} x2={feature.x2} y2={feature.y2} stroke="#404040" strokeWidth={1.5} />;
}

function FeatureIcon({ type, cx, cy }: { type: IconType; cx: number; cy: number }) {
  const stroke = "#a3a3a3";
  const sw = 1.4;

  if (type === "lift") {
    return (
      <g stroke={stroke} strokeWidth={sw} fill="none">
        <rect x={cx - 9} y={cy - 11} width={18} height={22} rx={2} />
        <path d={`M ${cx - 4} ${cy - 4} L ${cx} ${cy - 8} L ${cx + 4} ${cy - 4}`} strokeLinecap="round" strokeLinejoin="round" />
        <path d={`M ${cx - 4} ${cy + 4} L ${cx} ${cy + 8} L ${cx + 4} ${cy + 4}`} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (type === "washroom-male") {
    // Simple standing figure — circle head, straight-shouldered body
    return (
      <g stroke={stroke} strokeWidth={sw} fill="none">
        <circle cx={cx} cy={cy - 7} r={3.2} />
        <path d={`M ${cx - 5} ${cy + 9} L ${cx - 5} ${cy - 1} L ${cx + 5} ${cy - 1} L ${cx + 5} ${cy + 9}`} strokeLinejoin="round" />
        <line x1={cx} y1={cy - 1} x2={cx} y2={cy + 9} />
      </g>
    );
  }
  if (type === "washroom-female") {
    // Same head, triangular "skirt" body to distinguish at a glance
    return (
      <g stroke={stroke} strokeWidth={sw} fill="none">
        <circle cx={cx} cy={cy - 7} r={3.2} />
        <path d={`M ${cx} ${cy - 2} L ${cx - 6} ${cy + 9} L ${cx + 6} ${cy + 9} Z`} strokeLinejoin="round" />
        <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 9} />
      </g>
    );
  }
  if (type === "bookshelf") {
    return (
      <g stroke={stroke} strokeWidth={sw} fill="none">
        <rect x={cx - 12} y={cy - 11} width={24} height={22} rx={1} />
        <line x1={cx - 12} y1={cy - 3} x2={cx + 12} y2={cy - 3} />
        <line x1={cx - 12} y1={cy + 5} x2={cx + 12} y2={cy + 5} />
        <line x1={cx - 4} y1={cy - 11} x2={cx - 4} y2={cy - 3} />
        <line x1={cx + 3} y1={cy - 3} x2={cx + 3} y2={cy + 5} />
      </g>
    );
  }
  // stairs
  return (
    <g stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M ${cx - 12} ${cy + 10} L ${cx - 12} ${cy + 2} L ${cx - 4} ${cy + 2} L ${cx - 4} ${cy - 6} L ${cx + 4} ${cy - 6} L ${cx + 4} ${cy - 14} L ${cx + 12} ${cy - 14}`} />
    </g>
  );
}