/**
 * lib/floorPlanConfig.ts — 4th revision
 *
 * - Group Table D moved to the lower-left of the stairs block (was
 *   incorrectly parked in the far-right column).
 * - Lift 2 moved beside Window Row E (same height, to its right),
 *   not floating above it.
 * - Washrooms are now distinct male/female icons, not one shared
 *   symbol for both.
 * - Discussion Room 2 relocated to directly below Zone A, sitting
 *   within Zone B's vertical span (the gap between A and C) — Room 1
 *   stays put near the bookshelf.
 * - Canvas widened again (950) to fit the lift beside E with a real
 *   gap, and every position re-verified with the same overlap check
 *   (0 overlaps across all 14 elements).
 */

export const CANVAS_WIDTH = 950;
export const CANVAS_HEIGHT = 740;

export const STANDARD_SEAT_RADIUS = 7;

export interface SeatBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: number;
  cols: number;
  orientation: "h" | "v";
  zoneType: "SILENT" | "GROUP";
  sides?: 1 | 2;
  seatRadius: number;
  rowOffset: number;
}

export const FLOOR_1_SEAT_BLOCKS: SeatBlock[] = [
  { id: "A", name: "Window Row A", x: 150, y: 100, w: 245, h: 90, rows: 1, cols: 12, orientation: "h", zoneType: "SILENT", sides: 1, seatRadius: 7, rowOffset: 25 },
  { id: "B", name: "Window Block B", x: 420, y: 100, w: 300, h: 308, rows: 7, cols: 12, orientation: "h", zoneType: "SILENT", seatRadius: 7, rowOffset: 13 },
  { id: "C", name: "Reading Block C", x: 150, y: 300, w: 250, h: 264, rows: 6, cols: 12, orientation: "h", zoneType: "SILENT", seatRadius: 7, rowOffset: 13 },
  { id: "D", name: "Group Table D", x: 360, y: 568, w: 90, h: 88, rows: 2, cols: 2, orientation: "h", zoneType: "GROUP", seatRadius: 7, rowOffset: 13 },
  { id: "E", name: "Window Row E", x: 735, y: 425, w: 50, h: 260, rows: 1, cols: 12, orientation: "v", zoneType: "SILENT", sides: 1, seatRadius: 7, rowOffset: 13 },
];

export interface DiscussionRoom {
  id: string;
  name: string;
  cx: number;
  cy: number;
  outerRadius: number;
  seatRingRadius: number;
  seatRadius: number;
  capacity: number;
}

export const FLOOR_1_DISCUSSION_ROOMS: DiscussionRoom[] = [
  { id: "DISC1", name: "Discussion Room 1", cx: 90, cy: 460, outerRadius: 48, seatRingRadius: 22, seatRadius: 7, capacity: 6 },
  // Below Zone A, within Zone B's vertical span, as requested.
  { id: "DISC2", name: "Discussion Room 2", cx: 272, cy: 245, outerRadius: 48, seatRingRadius: 22, seatRadius: 7, capacity: 6 },
];

export type IconType = "lift" | "washroom-male" | "washroom-female" | "bookshelf" | "stairs";

interface RectFeature { kind: "rect"; x: number; y: number; w: number; h: number; label: string; icon: IconType; }
interface ArrowFeature { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; label: string; }
interface LineFeature { kind: "line"; x1: number; y1: number; x2: number; y2: number; }

export type FloorFeature = RectFeature | ArrowFeature | LineFeature;

export const FLOOR_1_FEATURES: FloorFeature[] = [
  { kind: "rect", x: 50, y: 20, w: 65, h: 50, label: "Lift", icon: "lift" },
  { kind: "rect", x: 180, y: 15, w: 110, h: 55, label: "Washroom (M)", icon: "washroom-male" },
  { kind: "rect", x: 330, y: 15, w: 110, h: 55, label: "Washroom (F)", icon: "washroom-female" },
  { kind: "rect", x: 40, y: 280, w: 95, h: 120, label: "Book Shelves", icon: "bookshelf" },
  { kind: "rect", x: 40, y: 660, w: 340, h: 30, label: "Book Shelves", icon: "bookshelf" },
  { kind: "rect", x: 460, y: 425, w: 105, h: 222, label: "Stairs", icon: "stairs" },
  { kind: "rect", x: 805, y: 532, w: 60, h: 45, label: "Lift", icon: "lift" },
  { kind: "arrow", x1: 90, y1: 175, x2: 90, y2: 97, label: "Entrance" },
  { kind: "arrow", x1: 800, y1: 260, x2: 820, y2: 225, label: "Windows — natural light" },
  { kind: "line", x1: 30, y1: 90, x2: 920, y2: 90 },
];

export const FLOOR_1_OUTLINE = { x: 30, y: 10, w: 890, h: 710 };

/** Seat counts shown under each desk block — purely a display label,
 * computed once here so it can't drift from the actual rows*cols. */
export function seatCountFor(block: SeatBlock): number {
  return block.rows * block.cols;
}