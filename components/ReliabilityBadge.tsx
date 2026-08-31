"use client";

import { useEffect, useState } from "react";

function scoreLabel(score: number): { text: string; className: string } {
  if (score >= 10) return { text: "Excellent", className: "text-emerald-400 border-emerald-900 bg-emerald-950" };
  if (score >= 3) return { text: "Reliable", className: "text-emerald-400 border-emerald-900 bg-emerald-950" };
  if (score >= -2) return { text: "New / Average", className: "text-neutral-400 border-neutral-700 bg-neutral-900" };
  return { text: "Needs improvement", className: "text-red-400 border-red-900 bg-red-950" };
}

export default function ReliabilityBadge() {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((data) => setScore(data.user?.reliabilityScore ?? 0))
      .catch(() => setScore(0));
  }, []);

  if (score === null) return null;
  const { text, className } = scoreLabel(score);

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${className}`}>
      <span>Reliability: {text}</span>
      <span className="opacity-60">({score >= 0 ? "+" : ""}{score})</span>
    </div>
  );
}