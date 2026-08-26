/**
 * lib/floorPlanConfig.ts
 *
 * Full redesign from the first two passes. Two real problems forced
 * this: (1) dense blocks (B, C) needed seat markers so small (1.5-3px)
 * to avoid overlap that they were effectively invisible, and (2) the
 * discussion rooms were decoration only — different sizes, no seats.
 *
 * Fix: standardize every seat at radius 7 (visible, clickable) and
 * give every block enough room to fit that size without crowding.
 * That meant growing the canvas (800x740, up from 1000x700) and
 * re-deriving positions from scratch rather than patching offsets —
 * every block/room below was verified with an overlap calculator
 * (both same-block seat spacing AND cross-block bounding boxes), not
 * eyeballed. See the conversation history for the verification script
 * if you want to re-run it after any future edit here.
 */

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 740;

export const STANDARD_SEAT_RADIUS = 7;

export interface SeatBlock {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rows: number; // number of tables
  cols: number; // total seats per table (both sides combined, unless sides:1)
  orientation: "h" | "v";
  zoneType: "SILENT" | "GROUP";
  sides?: 1 | 2; // default 2
  seatRadius: number;
  rowOffset: number; // distance from table centerline to each seat row
}

export const FLOOR_1_SEAT_BLOCKS: SeatBlock[] = [
  { id: "A", name: "Window Row A", x: 150, y: 100, w: 245, h: 90, rows: 1, cols: 12, orientation: "h", zoneType: "SILENT", sides: 1, seatRadius: 7, rowOffset: 25 },
  { id: "B", name: "Window Block B", x: 420, y: 100, w: 300, h: 308, rows: 7, cols: 12, orientation: "h", zoneType: "SILENT", seatRadius: 7, rowOffset: 13 },
  { id: "C", name: "Reading Block C", x: 150, y: 280, w: 165, h: 264, rows: 6, cols: 12, orientation: "h", zoneType: "SILENT", seatRadius: 7, rowOffset: 13 },
  { id: "D", name: "Group Table D", x: 460, y: 425, w: 70, h: 88, rows: 2, cols: 2, orientation: "h", zoneType: "GROUP", seatRadius: 7, rowOffset: 13 },
  { id: "E", name: "Window Row E", x: 560, y: 425, w: 50, h: 200, rows: 1, cols: 12, orientation: "v", zoneType: "SILENT", seatRadius: 7, rowOffset: 13 },
];

/** Circular seating — both discussion rooms are now identical size
 * with 6 real bookable seats each, arranged evenly around the center
 * (hexagon spacing), instead of being decoration-only. */
export interface DiscussionRoom {
  id: string;
  name: string;
  cx: number;
  cy: number;
  outerRadius: number; // visual room boundary
  seatRingRadius: number; // distance of each seat from center
  seatRadius: number;
  capacity: number;
}

export const FLOOR_1_DISCUSSION_ROOMS: DiscussionRoom[] = [
  { id: "DISC1", name: "Discussion Room 1", cx: 90, cy: 460, outerRadius: 48, seatRingRadius: 22, seatRadius: 7, capacity: 6 },
  { id: "DISC2", name: "Discussion Room 2", cx: 90, cy: 575, outerRadius: 48, seatRingRadius: 22, seatRadius: 7, capacity: 6 },
];

interface RectFeature { kind: "rect"; x: number; y: number; w: number; h: number; label: string; icon: string; }
interface ArrowFeature { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; label: string; }
interface LineFeature { kind: "line"; x1: number; y1: number; x2: number; y2: number; }

export type FloorFeature = RectFeature | ArrowFeature | LineFeature;

export const FLOOR_1_FEATURES: FloorFeature[] = [
  { kind: "rect", x: 50, y: 20, w: 65, h: 50, label: "Lift", icon: "🛗" },
  { kind: "rect", x: 180, y: 15, w: 110, h: 55, label: "Washroom", icon: "🚻" },
  { kind: "rect", x: 330, y: 15, w: 110, h: 55, label: "Washroom", icon: "🚻" },
  { kind: "rect", x: 670, y: 420, w: 60, h: 45, label: "Lift", icon: "🛗" },
  { kind: "rect", x: 40, y: 280, w: 95, h: 120, label: "Book Shelves", icon: "📚" },
  { kind: "rect", x: 40, y: 660, w: 340, h: 30, label: "Book Shelves", icon: "📚" },
  { kind: "rect", x: 330, y: 425, w: 105, h: 222, label: "Stairs ↓", icon: "🪜" },
  { kind: "arrow", x1: 90, y1: 175, x2: 90, y2: 97, label: "Entrance" },
  { kind: "arrow", x1: 750, y1: 260, x2: 770, y2: 225, label: "Windows — natural light" },
  { kind: "line", x1: 30, y1: 90, x2: 780, y2: 90 },
];

export const FLOOR_1_OUTLINE = { x: 30, y: 10, w: 750, h: 710 };