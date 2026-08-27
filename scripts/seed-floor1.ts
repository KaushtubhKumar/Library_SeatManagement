import { Client } from "@neondatabase/serverless";
import { setDefaultResultOrder } from "dns";
import ws from "ws";
import "dotenv/config";
import { randomUUID } from "crypto";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FLOOR_1_SEAT_BLOCKS,
  FLOOR_1_DISCUSSION_ROOMS,
  type SeatBlock,
  type DiscussionRoom,
} from "../lib/floorPlanConfig";

setDefaultResultOrder("ipv4first");
(globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;

interface SeatCoord { seatCode: string; posX: number; posY: number; xPx: number; yPx: number; }
const MIN_SAFE_GAP_PX = 1.5;

function computeRectSeats(block: SeatBlock): SeatCoord[] {
  const seats: SeatCoord[] = [];
  const singleSided = block.sides === 1;
  const perSide = singleSided ? block.cols : block.cols / 2;

  if (block.orientation === "h") {
    const rowH = block.h / block.rows;
    for (let r = 0; r < block.rows; r++) {
      const tableY = block.y + rowH * (r + 0.5);
      for (let k = 0; k < perSide; k++) {
        const x = block.x + (block.w * (k + 0.5)) / perSide;
        const push = (y: number, suffix: string) =>
          seats.push({ seatCode: `F1-${block.id}-T${r + 1}-S${String(k + 1).padStart(2, "0")}${suffix}`, posX: x / CANVAS_WIDTH, posY: y / CANVAS_HEIGHT, xPx: x, yPx: y });
        if (singleSided) push(tableY - block.rowOffset, "");
        else { push(tableY - block.rowOffset, "A"); push(tableY + block.rowOffset, "B"); }
      }
    }
  } else {
    // FIXED: this branch previously ignored `sides` entirely and
    // always emitted both A/B seats — that's why Window Row E kept
    // showing a "both sides" set even when config said sides:1.
    const colW = block.w / block.rows;
    for (let r = 0; r < block.rows; r++) {
      const tableX = block.x + colW * (r + 0.5);
      for (let k = 0; k < perSide; k++) {
        const y = block.y + (block.h * (k + 0.5)) / perSide;
        const push = (x: number, suffix: string) =>
          seats.push({ seatCode: `F1-${block.id}-T${r + 1}-S${String(k + 1).padStart(2, "0")}${suffix}`, posX: x / CANVAS_WIDTH, posY: y / CANVAS_HEIGHT, xPx: x, yPx: y });
        if (singleSided) push(tableX - block.rowOffset, "");
        else { push(tableX - block.rowOffset, "A"); push(tableX + block.rowOffset, "B"); }
      }
    }
  }
  return seats;
}

function computeCircularSeats(room: DiscussionRoom): SeatCoord[] {
  const seats: SeatCoord[] = [];
  for (let i = 0; i < room.capacity; i++) {
    const angle = (Math.PI / 180) * (i * (360 / room.capacity) - 90);
    const x = room.cx + room.seatRingRadius * Math.cos(angle);
    const y = room.cy + room.seatRingRadius * Math.sin(angle);
    seats.push({ seatCode: `F1-${room.id}-S${String(i + 1).padStart(2, "0")}`, posX: x / CANVAS_WIDTH, posY: y / CANVAS_HEIGHT, xPx: x, yPx: y });
  }
  return seats;
}

function checkForOverlaps(id: string, radius: number, coords: SeatCoord[]) {
  for (let i = 0; i < coords.length; i++)
    for (let j = i + 1; j < coords.length; j++) {
      const dx = coords[i].xPx - coords[j].xPx, dy = coords[i].yPx - coords[j].yPx;
      const edgeGap = Math.sqrt(dx * dx + dy * dy) - radius * 2;
      if (edgeGap < MIN_SAFE_GAP_PX) console.warn(`⚠ ${id}: ${coords[i].seatCode} / ${coords[j].seatCode} only ${edgeGap.toFixed(1)}px apart`);
    }
}

async function main() {
  const client = new Client(process.env.DATABASE_URL);
  await client.connect();
  try {
    const floorRes = await client.query(`SELECT id FROM "Floor" WHERE "floorNumber" = 1 LIMIT 1`);
    if (floorRes.rows.length === 0) throw new Error("Floor 1 not found — run the base seed.sql first.");
    const floorId = floorRes.rows[0].id;

    const oldZones = await client.query(`SELECT id FROM "Zone" WHERE "floorId" = $1`, [floorId]);
    for (const z of oldZones.rows) {
      await client.query(`DELETE FROM "OccupancyLog" WHERE "seatId" IN (SELECT id FROM "Seat" WHERE "zoneId" = $1)`, [z.id]);
      await client.query(`DELETE FROM "Booking" WHERE "seatId" IN (SELECT id FROM "Seat" WHERE "zoneId" = $1)`, [z.id]);
      await client.query(`DELETE FROM "Waitlist" WHERE "seatId" IN (SELECT id FROM "Seat" WHERE "zoneId" = $1)`, [z.id]);
      await client.query(`DELETE FROM "SeatStatus" WHERE "seatId" IN (SELECT id FROM "Seat" WHERE "zoneId" = $1)`, [z.id]);
      await client.query(`DELETE FROM "Seat" WHERE "zoneId" = $1`, [z.id]);
      await client.query(`DELETE FROM "ZoneNoiseReport" WHERE "zoneId" = $1`, [z.id]);
    }
    await client.query(`DELETE FROM "Zone" WHERE "floorId" = $1`, [floorId]);
    await client.query(`UPDATE "Floor" SET "imageWidth" = $1, "imageHeight" = $2 WHERE id = $3`, [CANVAS_WIDTH, CANVAS_HEIGHT, floorId]);

    let totalSeats = 0;
    for (const block of FLOOR_1_SEAT_BLOCKS) {
      const zoneId = randomUUID();
      const noiseLevel = block.zoneType === "GROUP" ? 3 : 1;
      await client.query(`INSERT INTO "Zone" (id, "floorId", name, "zoneType", "declaredNoiseLevel") VALUES ($1,$2,$3,$4,$5)`, [zoneId, floorId, block.name, block.zoneType, noiseLevel]);
      const coords = computeRectSeats(block);
      checkForOverlaps(block.id, block.seatRadius, coords);
      for (const seat of coords) {
        const seatId = randomUUID();
        const seatType = block.zoneType === "GROUP" ? "GROUP_TABLE" : "SINGLE";
        await client.query(
          `INSERT INTO "Seat" (id, "zoneId", "seatCode", "seatType", "hasPowerSocket", "hasWindow", "posX", "posY") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [seatId, zoneId, seat.seatCode, seatType, Math.random() > 0.5, block.id === "B" || block.id === "E", seat.posX, seat.posY]
        );
        await client.query(`INSERT INTO "SeatStatus" ("seatId", "currentState") VALUES ($1, 'FREE')`, [seatId]);
        totalSeats++;
      }
    }

    for (const room of FLOOR_1_DISCUSSION_ROOMS) {
      const zoneId = randomUUID();
      await client.query(`INSERT INTO "Zone" (id, "floorId", name, "zoneType", "declaredNoiseLevel") VALUES ($1,$2,$3,'DISCUSSION',4)`, [zoneId, floorId, room.name]);
      const coords = computeCircularSeats(room);
      checkForOverlaps(room.id, room.seatRadius, coords);
      for (const seat of coords) {
        const seatId = randomUUID();
        await client.query(
          `INSERT INTO "Seat" (id, "zoneId", "seatCode", "seatType", "hasPowerSocket", "hasWindow", "posX", "posY") VALUES ($1,$2,$3,'GROUP_TABLE',false,false,$4,$5)`,
          [seatId, zoneId, seat.seatCode, seat.posX, seat.posY]
        );
        await client.query(`INSERT INTO "SeatStatus" ("seatId", "currentState") VALUES ($1, 'FREE')`, [seatId]);
        totalSeats++;
      }
    }

    console.log(`Floor 1 seeded: ${FLOOR_1_SEAT_BLOCKS.length} desk zones + ${FLOOR_1_DISCUSSION_ROOMS.length} discussion rooms, ${totalSeats} total seats.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => { console.error("Floor 1 layout seed failed:", err); process.exit(1); });