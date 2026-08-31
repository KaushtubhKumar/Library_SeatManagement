"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FloorSummary } from "@/lib/types";
import Skeleton from "@/components/Skeleton";

export default function HomePage() {
  const [floors, setFloors] = useState<FloorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/floors")
      .then((r) => r.json())
      .then((data) => setFloors(data.floors ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold mb-1">Thapar Central Library</h1>
        <p className="text-neutral-400 mb-8">
          Pick a floor to see live seat availability and book a spot.
        </p>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {floors.map((floor) => {
            const pct = floor.totalSeats
              ? Math.round((floor.freeSeats / floor.totalSeats) * 100)
              : 0;
            return (
              <Link
                key={floor.id}
                href={`/floors/${floor.id}`}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-purple-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-medium">Floor {floor.floorNumber}</h2>
                  <span
                    className={`text-sm px-2 py-1 rounded-full ${
                      pct > 40
                        ? "bg-green-950 text-green-400"
                        : pct > 10
                        ? "bg-yellow-950 text-yellow-400"
                        : "bg-red-950 text-red-400"
                    }`}
                  >
                    {floor.freeSeats}/{floor.totalSeats} free
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}