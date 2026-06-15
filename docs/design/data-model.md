# Data Model

Reference for the gustavoai.dev backend data model, synthesised from
`supabase/migrations/0001–0010` and `src/domain/`. Intended for mobile-client
developers building against the API.

---

## Entity Reference

### users

**Purpose:** One row per app account; created (upserted) on first Google SSO login.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| email | TEXT UNIQUE NOT NULL | Identity key used throughout the system |
| name | TEXT NOT NULL DEFAULT '' | Display name from Google profile |
| role | TEXT NOT NULL DEFAULT 'student' | CHECK IN ('student','teacher','admin') — 0001:12 |
| avatar_url | TEXT | Nullable; from Google profile |
| locale | TEXT | CHECK NULL OR IN ('es','en') — 0010:14–15 |

**Relationships:** Referenced (by `user_id` FK) by every other user-scoped table.

---

### credit_packs

**Purpose:** Each row represents one prepaid class bundle purchased through Stripe. A user may hold multiple packs simultaneously.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users(id) | |
| pack_size | INT NOT NULL | CHECK IN (5, 10) — 0001:30 |
| credits_remaining | INT NOT NULL | CHECK >= 0 — 0001:31 |
| stripe_payment_id | TEXT UNIQUE NOT NULL | Idempotency key — 0001:32 |
| expires_at | TIMESTAMPTZ NOT NULL | Credits past this date cannot be decremented |

**Invariants:**
- `credits_remaining` can only decrease via `decrement_credit()` and increase via `restore_credit()` — both acquire a `FOR UPDATE` row lock to prevent TOCTOU races (0009:18, 0001:215).
- A partial index `idx_credit_packs_active` covers only rows where `credits_remaining > 0` — 0001:39–40.
- When a user has multiple active packs, the one expiring soonest is decremented first.

**Relationships:** One user → many credit_packs. Referenced by `bookings.credit_pack_id`.

---

### bookings

**Purpose:** A single class appointment; the central entity of the system.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users(id) | |
| credit_pack_id | UUID FK → credit_packs(id) | NULL for single-session paid or free15min bookings |
| session_type | TEXT NOT NULL | CHECK IN ('free15min','session1h','session2h','pack') — 0001:53–54 |
| starts_at | TIMESTAMPTZ NOT NULL | Class start |
| ends_at | TIMESTAMPTZ NOT NULL | Class end |
| status | TEXT NOT NULL DEFAULT 'confirmed' | CHECK IN ('confirmed','cancelled','completed','no_show') — 0001:57–58 |
| calendar_event_id | TEXT | Google Calendar event ID |
| cancel_token | TEXT UNIQUE | Signed token for student self-service cancellation |
| join_token | TEXT UNIQUE | Separate token for Zoom session join gating — 0001:61 |
| stripe_payment_id | TEXT | For single-session paid bookings only |
| note | TEXT | Optional note from the student |

**Lifecycle:**
```
confirmed ──► cancelled   (student or admin cancels; restores one credit if credit_pack_id IS NOT NULL)
          ──► completed   (cleanup cron: class ended AND zoom_sessions.student_joined_at IS NOT NULL)
          ──► no_show     (cleanup cron: class ended AND zoom_sessions.student_joined_at IS NULL)
```

Transitions are enforced at the service layer: `markCompleted` and `markNoShow` both include `WHERE status = 'confirmed'`, so they are no-ops on already-terminal rows.

**Invariants:**
- **Exclusion constraint** `bookings_no_overlap` prevents any two `confirmed` bookings from having overlapping time ranges — 0005:9–13:
  ```sql
  EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'confirmed')
  ```
- `cancel_token` and `join_token` are always distinct values; `join_token` was split out from `cancel_token` as a security fix — 0001:61.
- `credit_pack_id` is NULL when the booking is the free 15-min intro or was paid per-session via Stripe.

**Relationships:** One user → many bookings. One booking → one zoom_session. One booking → zero-or-one review.

---

### zoom_sessions

**Purpose:** Zoom Video SDK session metadata, linked 1-to-1 with a booking.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| booking_id | UUID FK → bookings(id) | |
| session_name | TEXT NOT NULL | Zoom Video SDK session identifier name |
| session_passcode | TEXT NOT NULL | Passcode required to join |
| session_id | TEXT NOT NULL DEFAULT '' | Zoom Video SDK session_id — added 0001:242 |
| duration_minutes | INT NOT NULL DEFAULT 0 | Needed to reconstruct ZoomSession on lookup — 0001:243 |
| started_at | TIMESTAMPTZ | NULL until teacher starts the session |
| ended_at | TIMESTAMPTZ | NULL until the cleanup cron terminates the session |
| student_joined_at | TIMESTAMPTZ | NULL until student joins; only written once — 0008:10–11 |

**Invariants:**
- `student_joined_at` is written exactly once (first join wins); subsequent calls to `markStudentJoined` are no-ops — `ISessionRepository` contract.
- The cleanup cron at `/api/internal/session-cleanup` checks `student_joined_at IS NOT NULL` to decide between `completed` and `no_show` when closing out a booking.

**Relationships:** One booking → one zoom_session. One zoom_session → many session_messages.

---

### payments

**Purpose:** Local audit record for every Stripe transaction. Stripe is the authoritative source; this table adds queryable history.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users(id) | |
| stripe_payment_id | TEXT UNIQUE NOT NULL | |
| amount_cents | INT NOT NULL | In minor currency units (e.g. euro cents) |
| currency | TEXT NOT NULL DEFAULT 'eur' | |
| status | TEXT NOT NULL DEFAULT 'succeeded' | CHECK IN ('pending','succeeded','refunded','failed') — 0001:105–106 |
| checkout_type | TEXT NOT NULL | CHECK IN ('pack','single') — 0001:107 |
| metadata | JSONB DEFAULT '{}' | Flexible bag for Stripe-supplied metadata |

**Relationships:** One user → many payments.

---

### session_messages

**Purpose:** Durable in-session Zoom chat messages, replacing an ephemeral Redis list.

| Field | Type | Notes |
|-------|------|-------|
| id | BIGINT IDENTITY PK | Sequential; used for cursor-based pagination |
| zoom_session_id | UUID FK → zoom_sessions(id) ON DELETE CASCADE | |
| content | TEXT NOT NULL | Raw message text |

**Invariants:** Messages are append-only. Deleting the parent `zoom_sessions` row cascades and removes all messages — 0001:252.

**Relationships:** One zoom_session → many session_messages.

---

### reviews

**Purpose:** Post-class rating (1–5 stars) with an optional written comment; one row per booking.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| booking_id | UUID FK → bookings(id) ON DELETE CASCADE | UNIQUE — one review per class |
| user_id | UUID FK → users(id) ON DELETE RESTRICT | |
| rating | INT NOT NULL | CHECK >= 1 AND <= 5 — 0004:8 |
| comment | TEXT | Optional; filled in a second step after rating |

**Invariants:**
- `UNIQUE (booking_id)` — 0004:12 — makes double-reviewing a class impossible at the DB level.
- Rating and comment are written separately: `upsertRating` captures the star value first and preserves any existing comment; `setComment` fills the text later.

**Relationships:** One booking → zero-or-one review.

---

### google_review_prompts

**Purpose:** Tracks the Google Maps review CTA lifecycle per student, so it is shown at the right cadence and not shown again after the user accepts or permanently dismisses it.

| Field | Type | Notes |
|-------|------|-------|
| user_id | UUID PK FK → users(id) ON DELETE CASCADE | One row per user |
| shown_count | INT NOT NULL DEFAULT 0 | Number of times the CTA was displayed |
| skipped_count | INT NOT NULL DEFAULT 0 | Number of times the user dismissed without clicking |
| dismissed | BOOLEAN NOT NULL DEFAULT FALSE | TRUE after 2 skips or 1 accept; CTA never shown again |
| last_shown_completed_count | INT | Paid-class count at the time the CTA last appeared |
| accepted_at | TIMESTAMPTZ | Set when user clicks through to Google |

**Lifecycle:** CTA is shown after every 3 completed paid classes (free15min never counts). After 2 skips `dismissed = true`. After 1 accept `dismissed = true` and `accepted_at` is stamped.

**Relationships:** One user → zero-or-one google_review_prompts row.

---

### audit_log

**Purpose:** Append-only event log for user-scoped actions (credit changes, bookings, cancellations, etc.).

| Field | Type | Notes |
|-------|------|-------|
| id | BIGINT IDENTITY PK | Monotonically increasing |
| user_id | UUID FK → users(id) | Nullable — system events carry no user |
| action | TEXT NOT NULL | e.g. `credit_decremented`, `booking_created` |
| details | JSONB DEFAULT '{}' | Structured event payload |

**Invariants:** Rows are never updated or deleted.

---

### subscriptions

**Purpose:** Email subscriptions to optional content channels.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | |
| user_id | UUID FK → users(id) ON DELETE RESTRICT | |
| type | TEXT NOT NULL | CHECK IN ('courses','blog') |

**Invariants:** `UNIQUE (user_id, type)` — 0003 — one subscription per channel per user; re-subscribing is a no-op.

---

## Operational / Infrastructure Tables

These four tables support system operation and are not user-visible domain objects. Mobile clients do not interact with them directly.

### slot_locks

Short-lived rows acting as distributed mutex locks during the booking flow. The PK is the normalised ISO start-time string. `acquire_slot_lock()` atomically cleans up expired locks, inserts a new one, and returns `TRUE` if acquired — 0001:308–327. Complements the exclusion constraint on `bookings`: the lock fires first to avoid noisy constraint errors.

### webhook_events

Stripe idempotency guard. One row per processed webhook event (PK = idempotency key). Prevents double-crediting when Stripe retries delivery.

### failed_bookings

Dead-letter queue. A row is written when a Stripe webhook payment succeeds but the downstream booking creation fails (e.g. a Google Calendar error). The admin recovery panel reads and retries these rows.

### pending_terminations

Fallback queue for Zoom session termination. Every booking writes a row at creation time; the daily cron at `/api/internal/session-cleanup` sweeps rows whose `fire_at` has passed and calls the terminate handler. Retried up to 5 attempts — partial index at 0006:13–15. Prevents orphaned Zoom sessions if the primary cron scheduler fails.

---

## Stored Procedures & Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `decrement_credit(p_user_id UUID)` | JSONB `{ok, remaining, pack_size}` | Atomically decrements one credit from the earliest-expiring active pack via `FOR UPDATE` (0009:11–18). Returns `pack_size` of that pack so callers avoid a second balance query — 0009:36. |
| `restore_credit(p_user_id UUID)` | JSONB `{ok, credits}` | Restores one credit after cancellation; will not exceed `pack_size` — 0001:202–232. |
| `acquire_slot_lock(start_iso TEXT, duration_minutes INT)` | BOOLEAN | Cleans up expired lock for the slot, inserts a new one, returns `TRUE` if inserted — 0001:308–327. |
| `release_slot_lock(start_iso TEXT)` | VOID | Deletes the lock row after booking succeeds or fails — 0001:329–334. |
| `update_updated_at()` | TRIGGER | BEFORE UPDATE on `users`, `credit_packs`, `bookings` — keeps `updated_at` current — 0001:139–149. |

---

## What a typical student's data looks like

Walkthrough for **Ana**, a hypothetical student, over her first 3 months.

**1. Signup**
Ana signs in with Google for the first time. One `users` row is upserted:
`role = 'student'`, `locale = NULL`. No other rows are written.

**2. First pack purchase**
Ana buys a 5-class pack through Stripe Checkout:
- `payments`: one row — `checkout_type = 'pack'`, `status = 'succeeded'`, `amount_cents = 17000`, `currency = 'eur'`.
- `credit_packs`: one row — `pack_size = 5`, `credits_remaining = 5`, `expires_at = now() + 6 months`, `stripe_payment_id` = Stripe's checkout session ID (idempotency key).
- `audit_log`: one row — `action = 'credit_added'`.

**3. First booking**
Ana picks a 1-hour slot. `BookingService` orchestrates atomically:
1. `acquire_slot_lock(startIso, 60)` → `slot_locks` row inserted.
2. `decrement_credit(userId)` → `credit_packs.credits_remaining` drops to 4; one `audit_log` row written.
3. Google Calendar event created → `calendar_event_id` returned.
4. `bookings` row inserted: `status = 'confirmed'`, `session_type = 'session1h'`, `credit_pack_id` → Ana's pack, `cancel_token` and `join_token` set to distinct signed values.
5. `zoom_sessions` row inserted: `session_name`, `session_passcode`, `duration_minutes = 60`, `student_joined_at = NULL`.
6. `pending_terminations` row inserted: `event_id = calendar_event_id`, `fire_at = ends_at + grace period`.
7. `release_slot_lock(startIso)` → `slot_locks` row deleted.

**4. First class**
Ana opens the join link (resolved via `join_token`) and enters the Zoom session. On her first join, `zoom_sessions.student_joined_at` is stamped. After the session window closes, the daily cleanup cron runs:
- Sees `student_joined_at IS NOT NULL` → calls `markCompleted` → `bookings.status = 'completed'`.
- Sets `zoom_sessions.ended_at`.
- Deletes the `pending_terminations` row.

**5. Post-class review**
The app shows Ana a 1–5 star prompt:
- `reviews` row created: `booking_id` → her first booking, `rating = 5`, `comment = NULL`.
- She adds a comment: `reviews.comment` updated.
- `google_review_prompts` row created (or incremented). The Google-review CTA is not shown yet — it fires after 3 completed paid classes.

**6. Second booking**
Ana books a second 1-hour class using one of her 4 remaining credits. A new `bookings` row and `zoom_sessions` row are created, following the same flow as step 3 (`credits_remaining` drops to 3).

---

**Ana's total footprint after these 6 steps:**

| Table | Rows |
|-------|------|
| users | 1 |
| credit_packs | 1 (credits_remaining = 3) |
| bookings | 2 (1 completed, 1 confirmed) |
| zoom_sessions | 2 |
| payments | 1 |
| reviews | 1 |
| audit_log | ~4 (credit_added + 2× credit_decremented + booking events) |
| google_review_prompts | 1 (shown_count = 0; not yet triggered) |
| pending_terminations | 1 (for the second booking; first was deleted after class) |
