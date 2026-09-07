"use client";

import Image from "next/image";

interface Props {
  x: number;
  y: number;
  zoneName: string;
  imageSrc: string;
}

// Fixed-position card anchored to the cursor's viewport coords at the
// moment of right-click. pointer-events-none so it never blocks the
// mouseleave that hides it, and never intercepts the native browser
// context menu we already preventDefault()'d on.
export default function SeatSectionPreview({ x, y, zoneName, imageSrc }: Props) {
  const left = typeof window !== "undefined" ? Math.min(x + 12, window.innerWidth - 260) : x;
  const top = typeof window !== "undefined" ? Math.min(y + 12, window.innerHeight - 210) : y;

  return (
    <div
      className="fixed z-[100] pointer-events-none animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top }}
    >
      <div className="w-56 rounded-lg border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
        <div className="relative w-full h-36 bg-neutral-800">
          <Image
            src={imageSrc}
            alt={`${zoneName} — real-life view`}
            fill
            sizes="224px"
            className="object-cover"
          />
        </div>
        <div className="px-2 py-1.5 text-[11px] text-neutral-300 border-t border-neutral-800">
          {zoneName}
        </div>
      </div>
    </div>
  );
}