"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Book", match: (p: string) => p === "/" || p.startsWith("/floors") },
  { href: "/my-bookings", label: "My Bookings", match: (p: string) => p.startsWith("/my-bookings") },
  { href: "/checkin-gate", label: "Claim Seat", match: (p: string) => p.startsWith("/checkin-gate") },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-neutral-950/95 backdrop-blur border-t border-neutral-800 flex z-50">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
              active ? "text-purple-400" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}