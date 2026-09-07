import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconPower(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function IconWindow(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconSatellite(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m13 7 4 4-6.5 6.5a3 3 0 0 1-4.24 0 3 3 0 0 1 0-4.24L13 7Z" />
      <path d="m17 3 4 4M4.5 12.5 3 21l8.5-1.5" />
    </svg>
  );
}

export function IconTicket(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </svg>
  );
}

export function IconBan(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.5 5.5 13 13" />
    </svg>
  );
}

export function IconElevator(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="m10 9 2-2 2 2M10 15l2 2 2-2" />
    </svg>
  );
}

export function IconRestroom(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="5" r="2" />
      <circle cx="15" cy="5" r="2" />
      <path d="M9 9v5l-2 8M9 14l2 8M15 9v5l-2 8m2-8 2 8" />
    </svg>
  );
}

export function IconBooks(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h4v16H4zM10 4h4v16h-4z" />
      <path d="M16 5.5 20 5v15l-4 .8Z" />
    </svg>
  );
}

export function IconStairs(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20v-4h4v-4h4V8h4V4h4" />
    </svg>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

/** Raw path strings for the same icons, for use inside an existing <svg>
 * canvas (e.g. FloorPlanCanvas) where a nested <svg> element won't render —
 * pass to <path d={ICON_PATHS.elevator} /> instead of mounting a component. */
export const ICON_PATHS = {
  elevator: "M4 3h16v18H4zM10 9l2-2 2 2M10 15l2 2 2-2",
  restroom: "M9 5a2 2 0 1 0 0-4M15 5a2 2 0 1 0 0-4M9 9v5l-2 8M9 14l2 8M15 9v5l-2 8m2-8 2 8",
  books: "M4 4h4v16H4zM10 4h4v16h-4zM16 5.5 20 5v15l-4 .8Z",
  stairs: "M4 20v-4h4v-4h4V8h4V4h4",
};