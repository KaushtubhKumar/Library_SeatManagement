-- ============================================================
-- 0000_base_tables.sql
-- Equivalent of `prisma migrate dev` — hand-applied here because
-- this sandbox can't reach binaries.prisma.sh. Prisma schema.prisma
-- remains the source of truth; run `npx prisma migrate dev` locally
-- to regenerate this properly once, then diff against this file.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TYPE "Role" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN');
CREATE TYPE "ZoneType" AS ENUM ('SILENT', 'DISCUSSION', 'GROUP');
CREATE TYPE "SeatType" AS ENUM ('SINGLE', 'CARREL', 'GROUP_TABLE');
CREATE TYPE "SeatState" AS ENUM ('FREE', 'LOCKED', 'BOOKED', 'OCCUPIED', 'MAINTENANCE');
CREATE TYPE "BookingStatus" AS ENUM ('ACTIVE', 'CHECKED_IN', 'EXPIRED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "OccupancySource" AS ENUM ('SENSOR', 'CHECKIN', 'MANUAL_ADMIN', 'CHECKOUT');

CREATE TABLE "Building" (
  id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT 'Thapar Central Library'
);

CREATE TABLE "Floor" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "buildingId" TEXT NOT NULL REFERENCES "Building"(id),
  "floorNumber" INT NOT NULL,
  "imageUrl"    TEXT,
  "imageWidth"  INT,
  "imageHeight" INT,
  UNIQUE ("buildingId", "floorNumber")
);

CREATE TABLE "Zone" (
  id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "floorId" TEXT NOT NULL REFERENCES "Floor"(id),
  name   TEXT NOT NULL,
  "zoneType" "ZoneType" NOT NULL,
  "declaredNoiseLevel" INT NOT NULL DEFAULT 2
);

CREATE TABLE "Seat" (
  id     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "zoneId" TEXT NOT NULL REFERENCES "Zone"(id),
  "seatCode" TEXT NOT NULL,
  "seatType" "SeatType" NOT NULL DEFAULT 'SINGLE',
  "hasPowerSocket" BOOLEAN NOT NULL DEFAULT false,
  "hasWindow" BOOLEAN NOT NULL DEFAULT false,
  "posX" DOUBLE PRECISION NOT NULL,
  "posY" DOUBLE PRECISION NOT NULL,
  UNIQUE ("zoneId", "seatCode")
);
CREATE INDEX ON "Seat" ("zoneId");

CREATE TABLE "SeatStatus" (
  "seatId" TEXT PRIMARY KEY REFERENCES "Seat"(id),
  "currentState" "SeatState" NOT NULL DEFAULT 'FREE',
  "lockedBy" TEXT,
  "lockedUntil" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sessionId" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  "rollNo" TEXT UNIQUE,
  email TEXT UNIQUE,
  role "Role" NOT NULL DEFAULT 'STUDENT',
  "strikeCount" INT NOT NULL DEFAULT 0,
  "suspendedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Booking" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seatId" TEXT NOT NULL REFERENCES "Seat"(id),
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  "startTime" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiryTime" TIMESTAMPTZ NOT NULL,
  "checkedInAt" TIMESTAMPTZ,
  "checkedOutAt" TIMESTAMPTZ,
  "sessionExpiresAt" TIMESTAMPTZ,
  status "BookingStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "qrToken" TEXT NOT NULL UNIQUE,
  "qrCodeDataUrl" TEXT,
  "bookingCode" TEXT NOT NULL UNIQUE
);
CREATE INDEX ON "Booking" ("seatId", status);
CREATE INDEX ON "Booking" ("userId", status);

CREATE TABLE "Waitlist" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seatId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX ON "Waitlist" ("seatId");

CREATE TABLE "OccupancyLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "seatId" TEXT NOT NULL REFERENCES "Seat"(id),
  "detectedState" "SeatState" NOT NULL,
  source "OccupancySource" NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "OccupancyLog" ("seatId", ts);

CREATE TABLE "ZoneNoiseReport" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "zoneId" TEXT NOT NULL REFERENCES "Zone"(id),
  "userId" TEXT NOT NULL REFERENCES "User"(id),
  rating INT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
