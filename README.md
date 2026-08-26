# Thapar Library Seat Allocator — Schema Layer

## Setup order

```bash
npm install prisma @prisma/client
npx prisma migrate dev --name init      # creates tables from schema.prisma
psql $DATABASE_URL -f prisma/migrations/0001_init/migration.sql
```

Prisma builds the tables; the raw SQL file adds everything Prisma
can't express natively (exclusion constraint, triggers, materialized view,
pg_notify). Keep them as two separate steps — don't try to force the
raw SQL into a Prisma migration's auto-generated section, it'll get
clobbered on the next `migrate dev`.

## Why this file split

| File | DBMS concept it demonstrates |
|---|---|
| `schema.prisma` | Spatial hierarchy (Building→Floor→Zone→Seat), normalization (SeatStatus separated from Seat, OccupancyLog separated from SeatStatus for history vs. current-state) |
| `migration.sql` §1 | Interval scheduling via `EXCLUDE USING gist` — DB-level conflict prevention, not app-level `if` checks |
| `migration.sql` §2 | Trigger-based finite state machine for seat state (FREE→LOCKED→BOOKED→OCCUPIED→FREE) |
| `migration.sql` §3 | Scheduled sweep for 30-min auto-expiry |
| `migration.sql` §4 | Materialized view for "quietest hour" analytics |
| `pg_notify` calls | Real-time push — the DB tells listening clients when state changes, no polling |

## Why SeatStatus is a separate table from Seat

`Seat` is static (where it is, what it has). `SeatStatus` is the current
snapshot (1:1, overwritten constantly). `OccupancyLog` and `Booking` are
history (append-only, INSERT-only for OccupancyLog). This is the
textbook argument for **not** cramming "current state" as a column
directly on `Seat` — it separates high-churn data from low-churn data
and gives you a clean audit trail.

## Next steps

1. Seed script — Buildings/Floors/Zones/Seats + one SeatStatus row per Seat
2. Seat-locking endpoint (soft lock before booking confirm)
3. Booking confirm endpoint (wrapped in a transaction, relies on the
   EXCLUDE constraint to reject conflicts atomically)
4. SSE endpoint that does `LISTEN seat_updates` on a dedicated pg
   connection and streams `pg_notify` payloads to connected browsers
5. Sensor simulator script (`OccupancyLog` inserts on an interval)
