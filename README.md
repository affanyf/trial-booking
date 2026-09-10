# Trial Booking Reliability System

A minimal, backend-correctness-focused slice of a trial class booking system. The brief: get the booking/payment invariants and the last-seat race condition provably right — not ship a feature-complete product.

Only **trial booking** is implemented. Regular enrollment is explicitly out of scope.

---

## How to run this

Requirements: Docker, and nvm (or Node 20.20.2 directly).

```bash
# 1. Start Postgres
docker compose up -d

# 2. Use the pinned Node version
nvm use

# 3. Install dependencies
npm install

# 4. Apply the schema + the raw-SQL partial unique index migration
npx prisma migrate deploy

# 5. Seed demo data (parents, students, trial classes, sample bookings)
npx prisma db seed

# 6. Run the app
npm run dev
```

Open `http://localhost:3000` for the minimal UI, or hit the API directly (see [API Contract](#api-contract) below).

Run the test suite (needs Postgres running, same as above):

```bash
npm test
```

To inspect the database directly (e.g. via DBeaver): host `localhost`, port `5432`, db `trial_booking`, user/password `postgres`/`postgres` — see `.env` for the exact `DATABASE_URL`.

---

## What was built

- **Schema** (Prisma + Postgres): `Parent`, `Student`, `TrialClass`, `Booking`, `PaymentAttempt`, plus a hand-written raw-SQL partial unique index (`unique_active_booking`) that Prisma's schema DSL can't express.
- **8 API endpoints** exactly matching the spec's contract:
  - `GET /api/parents`
  - `GET /api/students?parent_id={id}`
  - `GET /api/trial-classes`
  - `GET /api/trial-classes/available`
  - `POST /api/bookings`
  - `GET /api/bookings/{id}`
  - `POST /api/bookings/{id}/payment` — the critical one; see [Concurrency](#concurrency--the-last-seat-race) below.
  - `GET /api/trial-classes/{id}/roster`
- **Seed script** (`prisma/seed.ts`) covering every required demo scenario: a class with an open seat, a class with exactly 3/4 confirmed (the "one seat left" demo), a duplicate-booking setup, and a payment-failure example.
- **Test suite** (Vitest) covering the four required scenarios, including the last-seat race run under real concurrent requests against a real Postgres instance.
- **Minimal UI** (3 server-rendered pages + 2 Server Actions) for a manual walkthrough: a booking form, a booking-status/payment page, and an admin roster page.

## Time spent

- Brainstorming / requirements discussion with Claude (chat, not code): ~1–1.5 hours
- Implementation (Claude Code session covering setup, endpoints, tests, UI): ~3–3.5 hours

---

## Assumptions made

- Trial class capacity is assumed to always be 4, but stored as a field (`capacity`) rather than hardcoded, to keep it flexible
- No authentication/login system — access to both parent-facing and admin endpoints is assumed to be equally "trusted" for the scope of this test
- Seat availability is checked **at payment confirmation time**, not when a booking is first created — matching the official scenario in the requirements, where two users are allowed to both hold `pending_payment` bookings for the same class before one of them "wins"
- `pending_payment` bookings have no automatic expiry/timeout mechanism — this is out of scope for the 4-hour timebox
- Mock payment is simulated simply (success/failure), with no real payment gateway integration
- No refund mechanism is needed, since seat availability is checked before the payment simulation runs — so a user who loses the race is never actually charged

---

## Key Architecture and Backend Decisions

**Tech stack:** Next.js (App Router, full-stack with Server Actions/Route Handlers), PostgreSQL via Docker Compose, Prisma ORM.

**Data model:** `bookings.status` is the single source of truth for booking status (not `payment_attempts`), since a single booking can have multiple payment attempts. `payment_attempts` stores one row per attempt (not a single counter), to preserve a clear audit trail.

**Seat availability is computed in real time** (`COUNT(*)` of `confirmed` bookings), rather than from a stored counter — to avoid the risk of a counter drifting out of sync with the actual data.

**Duplicate bookings are prevented** with a partial unique index on `(student_id, trial_class_id)`, scoped to active statuses only (`pending_payment`, `confirmed`) — so a `cancelled`/`payment_failed` booking can still be retried.

**The last-seat race condition** is handled with row-level locking (`SELECT ... FOR UPDATE`) inside a database transaction, in the `POST /bookings/{id}/payment` endpoint. The operation order is: lock the trial_class row → count confirmed bookings → if full, reject immediately without running the payment simulation; if a seat is still available, only then run the payment simulation. This approach was chosen over `SERIALIZABLE` isolation with retry logic because its behavior is more predictable (blocking rather than abort-and-retry) and easier to explain and verify.

---

## What was deliberately cut

- Authentication/login (for both parent and admin)
- Regular enrollment (out of scope — only trial booking is implemented)
- A polished UI
- Refund mechanism (not needed, given the payment-check-before-charge design)
- Automatic expiry/timeout for long-abandoned `pending_payment` bookings
- Notifications (email/SMS) to parents after a booking is confirmed or fails
- Cancellation endpoint — the `cancelled` status exists in the schema but nothing sets it.
- Pagination or search on any list endpoint (fine at seed/demo scale).
- Deployment to a public environment (the project runs entirely locally)

## What I would monitor after release

- The rate of `seat_unavailable` failures as classes approach capacity — to gauge how often the race condition actually occurs in production
- The distribution of failure `reason` values on `payment_attempts` (`seat_unavailable` vs `payment_declined`) — to distinguish capacity issues from payment gateway issues
- Transaction duration / lock wait time on `POST /bookings/{id}/payment` — the `FOR UPDATE` lock is the whole safety mechanism; if wait times climb, that's contention worth knowing about before it becomes a user-facing timeout.
- Bookings stuck in `pending_payment` for an unusually long time (a signal of abandoned bookings, and a candidate for a future expiry mechanism)
- Count of stale `pending_payment` bookings (created long ago, never paid) — these permanently occupy the `unique_active_booking` slot for that student+class until someone deliberately cancels, which isn't implemented yet.

## What I would do next with more time

- Load-test the race at higher concurrency (10–50 simultaneous payment attempts, not just 2) to validate lock behavior under real contention.
- Add simple authentication for parents and admin/teacher
- Cancellation flow (and, if scope ever includes real payments, refunds).
- Improve the UI (styling, loading states, better error handling)
- Add an expiry/timeout mechanism for unresolved `pending_payment` bookings
- Add email notifications to parents on booking confirmation or failure
- Integrate a more realistic payment gateway (replacing the mock payment)
- Pagination/search once seed-scale data stops being representative.

---

## API Contract

| Method | Path | Notes |
|---|---|---|
| GET | `/api/parents` | |
| GET | `/api/students?parent_id={id}` | `parent_id` required |
| GET | `/api/trial-classes` | all classes, including full ones |
| GET | `/api/trial-classes/available` | `confirmed_count < capacity` only |
| POST | `/api/bookings` | `{ student_id, trial_class_id }` → 201 / 409 on duplicate active booking |
| GET | `/api/bookings/{id}` | |
| POST | `/api/bookings/{id}/payment` | `{ payment_method }` → confirmed / payment_failed (seat_unavailable \| payment_declined) |
| GET | `/api/trial-classes/{id}/roster` | confirmed bookings only |
