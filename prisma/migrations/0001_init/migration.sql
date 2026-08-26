-- ============================================================
-- 0001_init — hand-written additions on top of Prisma's schema
-- Run this AFTER `prisma migrate dev` generates the base tables.
-- ============================================================

-- Needed for the EXCLUDE constraint below (range + equality ops together)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ------------------------------------------------------------
-- 1. CONFLICT-FREE INTERVAL SCHEDULING
--    A seat cannot have two overlapping ACTIVE bookings.
--    This is enforced by Postgres itself, not application code —
--    so even a buggy API or a race condition cannot violate it.
-- ------------------------------------------------------------

ALTER TABLE "Booking"
  ADD CONSTRAINT no_overlapping_active_bookings
  EXCLUDE USING gist (
    "seatId" WITH =,
    tstzrange("startTime", "expiryTime") WITH &&
  )
  WHERE (status = 'ACTIVE');

-- ------------------------------------------------------------
-- 2. STATE MACHINE TRIGGERS
--    SeatStatus.currentState is a derived/cached column.
--    Nothing writes to it directly — it only changes as a
--    side-effect of Booking or OccupancyLog inserts/updates.
-- ------------------------------------------------------------

-- 2a. New ACTIVE booking → seat becomes BOOKED
--     Guard: if the seat is currently OCCUPIED (someone checked in under
--     a different, currently-live booking), a newly inserted booking for
--     a FUTURE slot must not downgrade the seat's visible state.
CREATE OR REPLACE FUNCTION fn_booking_created()
RETURNS TRIGGER AS $$
DECLARE
  seat_currently_occupied BOOLEAN;
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    SELECT EXISTS (
      SELECT 1 FROM "Booking"
      WHERE "seatId" = NEW."seatId"
        AND id != NEW.id
        AND status = 'CHECKED_IN'
    ) INTO seat_currently_occupied;

    IF NOT seat_currently_occupied THEN
      UPDATE "SeatStatus"
      SET "currentState" = 'BOOKED', "updatedAt" = now()
      WHERE "seatId" = NEW."seatId";

      PERFORM pg_notify(
        'seat_updates',
        json_build_object(
          'seatId', NEW."seatId",
          'state', 'BOOKED',
          'bookingId', NEW.id
        )::text
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_created
AFTER INSERT ON "Booking"
FOR EACH ROW EXECUTE FUNCTION fn_booking_created();

-- 2b. Booking status transitions (check-in / expiry / cancel)
--     IMPORTANT: a seat can have many Booking rows over time (past,
--     current, future). A status change on an OLD or FUTURE booking
--     must NOT clobber SeatStatus if some OTHER booking is currently
--     governing that seat (e.g. an active check-in). We only push the
--     derived state if this booking is the most recent one to touch
--     the seat, or if no other booking currently claims OCCUPIED/BOOKED.
--
--     Check-in sessions are BOUNDED: sessionExpiresAt = checkedInAt +
--     MAX_SESSION_HOURS, so a checked-in seat can't stay OCCUPIED
--     forever and block future bookings indefinitely (see fn_expire_stale_bookings
--     for the corresponding auto-checkout sweep).
CREATE OR REPLACE FUNCTION fn_booking_status_changed()
RETURNS TRIGGER AS $$
DECLARE
  new_state "SeatState";
  seat_still_governed BOOLEAN;
  max_session_hours CONSTANT INT := 4;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW; -- no-op, avoid redundant notifies
  END IF;

  -- Set the bounded session window the moment check-in happens
  IF NEW.status = 'CHECKED_IN' AND NEW."sessionExpiresAt" IS NULL THEN
    NEW."sessionExpiresAt" := now() + (max_session_hours || ' hours')::interval;
  END IF;

  new_state := CASE NEW.status
    WHEN 'CHECKED_IN' THEN 'OCCUPIED'
    WHEN 'EXPIRED'    THEN 'FREE'
    WHEN 'CANCELLED'  THEN 'FREE'
    WHEN 'COMPLETED'  THEN 'FREE'
    ELSE NULL
  END;

  IF new_state IS NULL THEN
    RETURN NEW;
  END IF;

  -- Before releasing a seat to FREE, check no OTHER booking on this
  -- seat currently has a stronger claim (ACTIVE or CHECKED_IN).
  IF new_state = 'FREE' THEN
    SELECT EXISTS (
      SELECT 1 FROM "Booking"
      WHERE "seatId" = NEW."seatId"
        AND id != NEW.id
        AND status IN ('ACTIVE', 'CHECKED_IN')
    ) INTO seat_still_governed;

    IF seat_still_governed THEN
      RETURN NEW; -- another booking still owns this seat; don't touch SeatStatus
    END IF;
  END IF;

  UPDATE "SeatStatus"
  SET "currentState" = new_state, "lockedBy" = NULL, "lockedUntil" = NULL, "updatedAt" = now()
  WHERE "seatId" = NEW."seatId";

  PERFORM pg_notify(
    'seat_updates',
    json_build_object(
      'seatId', NEW."seatId",
      'state', new_state,
      'bookingId', NEW.id
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_booking_status_changed
BEFORE UPDATE OF status ON "Booking"
FOR EACH ROW EXECUTE FUNCTION fn_booking_status_changed();

-- 2c. Occupancy sensor/QR pings independently confirm presence
--     (works even for walk-up seats that were never booked)
CREATE OR REPLACE FUNCTION fn_occupancy_logged()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "SeatStatus"
  SET "currentState" = NEW."detectedState", "updatedAt" = now()
  WHERE "seatId" = NEW."seatId";

  PERFORM pg_notify(
    'seat_updates',
    json_build_object(
      'seatId', NEW."seatId",
      'state', NEW."detectedState",
      'source', NEW.source
    )::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_occupancy_logged
AFTER INSERT ON "OccupancyLog"
FOR EACH ROW EXECUTE FUNCTION fn_occupancy_logged();

-- ------------------------------------------------------------
-- 3. AUTO-EXPIRY SWEEP
--    Called every ~60s by a scheduled job (node-cron / pg_cron).
--    Flips ACTIVE bookings whose expiryTime has passed and were
--    never checked in.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_expire_stale_bookings()
RETURNS void AS $$
DECLARE
  promoted RECORD;
BEGIN
  -- Strike any user whose booking expired without check-in, BEFORE we
  -- flip it to EXPIRED below (so we can still see which bookings triggered it)
  UPDATE "User" u
  SET "strikeCount" = u."strikeCount" + 1,
      "suspendedUntil" = CASE
        WHEN u."strikeCount" + 1 >= 3 THEN now() + interval '24 hours'
        ELSE u."suspendedUntil"
      END
  FROM "Booking" b
  WHERE b."userId" = u.id
    AND b.status = 'ACTIVE'
    AND b."expiryTime" < now()
    AND b."checkedInAt" IS NULL;

  -- Un-checked-in bookings past their 30-min hold expire
  UPDATE "Booking"
  SET status = 'EXPIRED'
  WHERE status = 'ACTIVE'
    AND "expiryTime" < now()
    AND "checkedInAt" IS NULL;

  -- Checked-in sessions past their bounded max duration are auto
  -- checked out, freeing the seat for future bookings.
  UPDATE "Booking"
  SET status = 'COMPLETED', "checkedOutAt" = now()
  WHERE status = 'CHECKED_IN'
    AND "sessionExpiresAt" IS NOT NULL
    AND "sessionExpiresAt" < now();

  -- Promote the oldest waitlist entry for every seat that just went
  -- FREE this sweep (i.e. has no other ACTIVE/CHECKED_IN booking now).
  -- We notify on a separate channel so the frontend can show "it's
  -- your turn" without conflating it with plain seat-state pushes.
  FOR promoted IN
    WITH freed_seats AS (
      SELECT DISTINCT s."seatId" FROM "SeatStatus" s
      WHERE s."currentState" = 'FREE'
        AND EXISTS (SELECT 1 FROM "Waitlist" w WHERE w."seatId" = s."seatId" AND w.notified = false)
    ),
    next_in_line AS (
      SELECT DISTINCT ON (w."seatId") w.id, w."seatId", w."userId"
      FROM "Waitlist" w
      JOIN freed_seats fs ON fs."seatId" = w."seatId"
      WHERE w.notified = false
      ORDER BY w."seatId", w."joinedAt" ASC
    )
    UPDATE "Waitlist" w
    SET notified = true
    FROM next_in_line n
    WHERE w.id = n.id
    RETURNING n."seatId", n."userId"
  LOOP
    PERFORM pg_notify('waitlist_updates', json_build_object(
      'seatId', promoted."seatId", 'userId', promoted."userId"
    )::text);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- If your Neon plan supports pg_cron, this schedules it inside Postgres
-- itself (no external cron needed). Otherwise call fn_expire_stale_bookings()
-- from a node-cron job in the app — see /scripts/expiry-sweep.ts
-- SELECT cron.schedule('expire-bookings', '*/1 * * * *', 'SELECT fn_expire_stale_bookings();');

-- ------------------------------------------------------------
-- 4. MATERIALIZED VIEW — quietest hour per zone
-- ------------------------------------------------------------

CREATE MATERIALIZED VIEW quietest_hours AS
SELECT
  z.id AS zone_id,
  z.name AS zone_name,
  EXTRACT(HOUR FROM b."startTime") AS hour_of_day,
  COUNT(b.id) AS booking_count,
  ROUND(AVG(COALESCE(nr.rating, z."declaredNoiseLevel")), 2) AS avg_noise_score
FROM "Zone" z
JOIN "Seat" s ON s."zoneId" = z.id
LEFT JOIN "Booking" b ON b."seatId" = s.id
LEFT JOIN "ZoneNoiseReport" nr ON nr."zoneId" = z.id
GROUP BY z.id, z.name, EXTRACT(HOUR FROM b."startTime");

CREATE UNIQUE INDEX ON quietest_hours (zone_id, hour_of_day);

-- Refresh nightly via cron/node-cron:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY quietest_hours;

-- ------------------------------------------------------------
-- 5. SEED: one SeatStatus row per Seat (FREE by default)
--    Run once after seeding Seats.
-- ------------------------------------------------------------
-- INSERT INTO "SeatStatus" ("seatId", "currentState")
-- SELECT id, 'FREE' FROM "Seat"
-- ON CONFLICT ("seatId") DO NOTHING;
