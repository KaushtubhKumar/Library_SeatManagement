-- ============================================================
-- seed.sql — placeholder data (4 floors, few zones/seats each)
-- Coordinates are dummy grid values for now; will be recalibrated
-- once real floor-plan images are provided and clicked through
-- the admin calibration tool.
-- ============================================================

INSERT INTO "Building" (id, name) VALUES ('bld-1', 'Thapar Central Library');

INSERT INTO "Floor" (id, "buildingId", "floorNumber", "imageUrl") VALUES
  ('floor-1', 'bld-1', 1, NULL),
  ('floor-2', 'bld-1', 2, NULL),
  ('floor-3', 'bld-1', 3, NULL),
  ('floor-4', 'bld-1', 4, NULL);

-- Two zones per floor: one silent, one discussion
INSERT INTO "Zone" (id, "floorId", name, "zoneType", "declaredNoiseLevel") VALUES
  ('zone-1a', 'floor-1', 'Floor 1 - Silent Reading', 'SILENT', 1),
  ('zone-1b', 'floor-1', 'Floor 1 - Discussion Pods', 'DISCUSSION', 3),
  ('zone-2a', 'floor-2', 'Floor 2 - Silent Reading', 'SILENT', 1),
  ('zone-2b', 'floor-2', 'Floor 2 - Group Tables', 'GROUP', 4),
  ('zone-3a', 'floor-3', 'Floor 3 - Silent Reading', 'SILENT', 1),
  ('zone-3b', 'floor-3', 'Floor 3 - Discussion Pods', 'DISCUSSION', 3),
  ('zone-4a', 'floor-4', 'Floor 4 - Silent Reading', 'SILENT', 1),
  ('zone-4b', 'floor-4', 'Floor 4 - Group Tables', 'GROUP', 4);

-- 6 seats per zone, dummy grid coordinates (0.0-1.0), alternating amenities
DO $$
DECLARE
  z RECORD;
  i INT;
  seat_id TEXT;
BEGIN
  FOR z IN SELECT id, floor_prefix FROM (VALUES
    ('zone-1a','F1A'), ('zone-1b','F1B'),
    ('zone-2a','F2A'), ('zone-2b','F2B'),
    ('zone-3a','F3A'), ('zone-3b','F3B'),
    ('zone-4a','F4A'), ('zone-4b','F4B')
  ) AS t(id, floor_prefix)
  LOOP
    FOR i IN 1..6 LOOP
      seat_id := gen_random_uuid()::text;
      INSERT INTO "Seat" (id, "zoneId", "seatCode", "seatType", "hasPowerSocket", "hasWindow", "posX", "posY")
      VALUES (
        seat_id,
        z.id,
        z.floor_prefix || '-' || LPAD(i::text, 3, '0'),
        CASE WHEN z.floor_prefix LIKE '%B' THEN 'GROUP_TABLE' ELSE 'SINGLE' END::"SeatType",
        (i % 2 = 0),
        (i <= 2),
        0.1 + (i * 0.12),
        CASE WHEN z.id LIKE '%a' THEN 0.2 ELSE 0.6 END
      );

      INSERT INTO "SeatStatus" ("seatId", "currentState") VALUES (seat_id, 'FREE');
    END LOOP;
  END LOOP;
END $$;

-- A couple of test users (anonymous, name-only)
INSERT INTO "User" (id, name) VALUES
  ('user-1', 'Kaushtubh Kumar'),
  ('user-2', 'Test Student Two');

SELECT 'Seed complete: ' || COUNT(*) || ' seats created' FROM "Seat";
