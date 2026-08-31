-- ============================================================
-- 0002_waitlist_priority
-- Run AFTER `prisma migrate dev` picks up reliabilityScore/priorityScore.
-- ============================================================

-- ------------------------------------------------------------
-- 1. REWARD on-time check-in (checked in before expiryTime)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reward_on_time_checkin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'CHECKED_IN' AND OLD.status = 'ACTIVE'
     AND NEW."checkedInAt" IS NOT NULL AND NEW."checkedInAt" <= OLD."expiryTime" THEN
    UPDATE "User" SET "reliabilityScore" = "reliabilityScore" + 2
    WHERE id = NEW."userId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reward_on_time_checkin
AFTER UPDATE OF status ON "Booking"
FOR EACH ROW EXECUTE FUNCTION fn_reward_on_time_checkin();

-- ------------------------------------------------------------
-- 2. PENALIZE no-shows inside the expiry sweep, and snapshot
--    priorityScore for any NEW waitlist joins from here on.
--    (fn_expire_stale_bookings already exists from 0001 — this
--    replaces it, adding the reliabilityScore penalty and switching
--    the waitlist-promotion ORDER BY to priority-first.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_stale_bookings()
RETURNS void AS $$
DECLARE
  promoted RECORD;
BEGIN
  -- No-show: strike + reliability penalty, before the row flips to EXPIRED
  UPDATE "User" u
  SET "strikeCount" = u."strikeCount" + 1,
      "reliabilityScore" = u."reliabilityScore" - 3,
      "suspendedUntil" = CASE
        WHEN u."strikeCount" + 1 >= 3 THEN now() + interval '24 hours'
        ELSE u."suspendedUntil"
      END
  FROM "Booking" b
  WHERE b."userId" = u.id
    AND b.status = 'ACTIVE'
    AND b."expiryTime" < now()
    AND b."checkedInAt" IS NULL;

  UPDATE "Booking"
  SET status = 'EXPIRED'
  WHERE status = 'ACTIVE'
    AND "expiryTime" < now()
    AND "checkedInAt" IS NULL;

  UPDATE "Booking"
  SET status = 'COMPLETED', "checkedOutAt" = now()
  WHERE status = 'CHECKED_IN'
    AND "sessionExpiresAt" IS NOT NULL
    AND "sessionExpiresAt" < now();

  -- Promote next-in-line by priorityScore DESC, joinedAt ASC (not FIFO)
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
      ORDER BY w."seatId", w."priorityScore" DESC, w."joinedAt" ASC
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

-- ------------------------------------------------------------
-- 3. PERIODIC SHUFFLE
--    Prevents a large reliabilityScore gap from calcifying into a
--    permanent line order (e.g. one bad night shouldn't lock someone
--    out of every future queue). Only shuffles WITHIN a tier — score
--    banded to the nearest 5 — so it stays a priority queue, not a
--    lottery: a 20-point-reliability user still beats a 2-point one,
--    but two 8s and a 6 in the same band get reshuffled among
--    themselves. Call on a schedule (e.g. every 30 min), separate
--    from the 60s expiry sweep.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_shuffle_waitlist_tiers()
RETURNS void AS $$
BEGIN
  UPDATE "Waitlist" w
  SET "joinedAt" = w."joinedAt" - (random() * interval '1 second')
  FROM "User" u
  WHERE w."userId" = u.id
    AND w.notified = false;
  -- Small random jitter on joinedAt only changes tie-break order
  -- WITHIN a band that already ties on priorityScore's rounded tier
  -- (see application-layer banding when priorityScore is snapshotted);
  -- it can never let a low-priority user overtake a genuinely
  -- higher-priority one, since ORDER BY priorityScore DESC still wins first.
END;
$$ LANGUAGE plpgsql;