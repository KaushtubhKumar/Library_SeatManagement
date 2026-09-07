"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CountdownBadge from "@/components/CountdownBadge";

const TABS = [
  { href: "/", label: "Book", match: (p: string) => p === "/" || p.startsWith("/floors") },
  { href: "/my-bookings", label: "My Bookings", match: (p: string) => p.startsWith("/my-bookings") },
  { href: "/checkin-gate", label: "Claim Seat", match: (p: string) => p.startsWith("/checkin-gate") },
];

/** Single fixed bottom stack: countdown row (only when there's an active
 * hold) sits directly on top of the tab row, in the same fixed
 * container — two independently-positioned fixed elements is what
 * caused the visible gap before. */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      <CountdownBadge />
      <nav className="bg-neutral-950/95 backdrop-blur border-t border-neutral-800 flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 text-center py-3 text-sm font-medium transition-colors ${
                active ? "text-accent" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}