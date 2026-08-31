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
} from "@/lib/floorPlanConfig";
import { getSectionImage } from "@/lib/sectionImages";
import SeatSectionPreview from "@/components/SeatSectionPreview";

const STATE_FILL: Record<string, string> = {
  FREE: "#7fa66b",
  LOCKED: "#c89b4a",
  BOOKED: "#cc8b4a",
  OCCUPIED: "#b5523f",
  MAINTENANCE: "#57534e",
};

interface Props {
  zones: ZoneDTO[];
  onSeatClick: (seat: SeatDTO, zoneName: string) => void;
}

export default function FloorPlanCanvas({ zones, onSeatClick }: Props) {
  const [hovered, setHovered] = useState<SeatDTO | null>(null);
  const [preview, setPreview] = useState<{ x: number; y: number; zoneName: string; imageSrc: string } | null>(
    null
  );
  const allSeats = zones.flatMap((z) => z.seats.map((s) => ({ ...s, zoneName: z.name })));

  function handleContextMenu(e: React.MouseEvent, zoneName: string) {
    e.preventDefault(); // suppress native right-click menu
    const imageSrc = getSectionImage(zoneName);
    if (!imageSrc) return; // no photo mapped for this zone yet
    setPreview({ x: e.clientX, y: e.clientY, zoneName, imageSrc });
  }

  function hidePreview() {
    setPreview(null);
  }

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

      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full min-w-[700px]"
          style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
        >
          <rect
            x={FLOOR_1_OUTLINE.x}
            y={FLOOR_1_OUTLINE.y}
            width={FLOOR_1_OUTLINE.w}
            height={FLOOR_1_OUTLINE.h}
            rx={16}
            fill="#0a0a0a"
            stroke="#404040"
            strokeWidth={2}
          />

          {FLOOR_1_SEAT_BLOCKS.map((block) => (
            <TableBars key={block.id} block={block} />
          ))}

          {/* Discussion room boundaries drawn separately from the
              generic feature list since they now hold real seats */}
          {FLOOR_1_DISCUSSION_ROOMS.map((room) => (
            <circle
              key={room.id}
              cx={room.cx}
              cy={room.cy}
              r={room.outerRadius}
              fill="#171717"
              stroke="#404040"
              strokeDasharray="4 3"
            />
          ))}

          {FLOOR_1_FEATURES.map((f, i) => (
            <Feature key={i} feature={f} />
          ))}

          {FLOOR_1_DISCUSSION_ROOMS.map((room) => (
            <text key={`${room.id}-label`} x={room.cx} y={room.cy + room.outerRadius + 14} textAnchor="middle" fontSize={9} fill="#a3a3a3">
              {room.name} (6)
            </text>
          ))}

          {/* Standardized seats — every seat renders at the same
              radius now, so this no longer needs a per-block lookup */}
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
                  onMouseLeave={() => {
                    setHovered(null);
                    hidePreview();
                  }}
                  onContextMenu={(e) => handleContextMenu(e, seat.zoneName)}
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
              <rect
                x={hovered.posX * CANVAS_WIDTH - 34}
                y={hovered.posY * CANVAS_HEIGHT - 32}
                width={68}
                height={18}
                rx={4}
                fill="#171717"
                stroke="#404040"
              />
              <text
                x={hovered.posX * CANVAS_WIDTH}
                y={hovered.posY * CANVAS_HEIGHT - 19}
                textAnchor="middle"
                fontSize={10}
                fill="#e5e5e5"
              >
                {hovered.seatCode}
              </text>
            </g>
          )}
        </svg>
      </div>

      {preview && (
        <SeatSectionPreview
          x={preview.x}
          y={preview.y}
          zoneName={preview.zoneName}
          imageSrc={preview.imageSrc}
        />
      )}
    </div>
  );
}

function TableBars({ block }: { block: (typeof FLOOR_1_SEAT_BLOCKS)[number] }) {
  const bars = [];
  if (block.orientation === "h") {
    const rowH = block.h / block.rows;
    for (let i = 0; i < block.rows; i++) {
      const cy = block.y + rowH * (i + 0.5);
      bars.push(
        <rect key={i} x={block.x + 6} y={cy - 4} width={block.w - 12} height={8} rx={3} fill="#262626" stroke="#404040" />
      );
    }
  } else {
    const colW = block.w / block.rows;
    for (let i = 0; i < block.rows; i++) {
      const cx = block.x + colW * (i + 0.5);
      bars.push(
        <rect key={i} x={cx - 4} y={block.y + 6} width={8} height={block.h - 12} rx={3} fill="#262626" stroke="#404040" />
      );
    }
  }
  return <>{bars}</>;
}

function Feature({ feature }: { feature: (typeof FLOOR_1_FEATURES)[number] }) {
  if (feature.kind === "rect") {
    return (
      <g>
        <rect x={feature.x} y={feature.y} width={feature.w} height={feature.h} rx={10} fill="#171717" stroke="#404040" strokeDasharray="4 3" />
        <text x={feature.x + feature.w / 2} y={feature.y + feature.h / 2 - 4} textAnchor="middle" fontSize={14}>
          {feature.icon}
        </text>
        <text x={feature.x + feature.w / 2} y={feature.y + feature.h / 2 + 14} textAnchor="middle" fontSize={9} fill="#a3a3a3">
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