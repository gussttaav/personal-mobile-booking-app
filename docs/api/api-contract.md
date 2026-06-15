# API Contract — Mobile Client

> **Scope:** Student-facing endpoints only. Admin (`/api/admin/*`) and internal/cron
> (`/api/internal/*`) routes are excluded — the mobile app never calls them.

---

## Global Conventions

### Base URL
All paths are relative to `NEXT_PUBLIC_BASE_URL` (e.g. `https://gustavoai.dev`).

### Authentication
The server uses **NextAuth v5** with a signed JWT stored in a `HttpOnly` session cookie
(`authjs.session-token`). Every protected endpoint calls `auth()` internally and returns
**401** when the cookie is absent, expired, or invalid.

A mobile client must:
1. Initiate Google OAuth via the standard NextAuth flow (see [Auth](#auth)).
2. Store and send the session cookie on every subsequent request (standard `Cookie` header).

### CSRF Protection
Every **state-mutating POST** that is not a Stripe webhook requires two things:

| Header | Required value |
|---|---|
| `Origin` | Must equal `NEXT_PUBLIC_BASE_URL` exactly (e.g. `https://gustavoai.dev`) |
| `Sec-Fetch-Site` | Must NOT be `cross-site`; omit it or send `same-origin` |

If `Origin` is missing or doesn't match → **403 Forbidden**.

> **Mobile note:** Native HTTP clients (e.g. `URLSession`, `OkHttp`, `fetch` in React
> Native) do not add `Origin` automatically. Your API wrapper **must** inject
> `Origin: https://gustavoai.dev` on every POST/mutation call.

### Error Response Shape
All errors follow the same envelope:

```json
{ "error": "<ERROR_CODE_OR_MESSAGE>" }
```

Domain errors use machine-readable uppercase codes (e.g. `"INSUFFICIENT_CREDITS"`).
Generic 401 responses carry a human-readable string (`"Autenticación requerida"`).

### Rate Limiting
Rate limits are enforced via Upstash Redis sliding windows. Exceeding any limit returns
**429** with body `{ "error": "Too Many Requests" }` (exact message may vary).

---

## Auth

### `GET /api/auth/[...nextauth]`
### `POST /api/auth/[...nextauth]`

Delegated entirely to **NextAuth v5** (Google OAuth provider). The mobile app should
use the NextAuth-standard OAuth dance:

1. Open `GET /api/auth/signin/google` in a browser/WebView — redirects to Google consent.
2. Google redirects back to `/api/auth/callback/google` — NextAuth sets the session cookie.
3. All subsequent requests carry that cookie.

| Property | Value |
|---|---|
| Auth required | No (this is the auth endpoint) |
| CSRF | Handled internally by NextAuth |
| Rate limiting | None |

There is no token-based or API-key auth — the app is **cookie-session only**.

---

## Availability

### `GET /api/availability`

Returns the list of bookable time slots for a given date.

| Property | Value |
|---|---|
| Auth required | No (public) |
| CSRF | No |
| Rate limit | 60 req/min per IP |

**Query parameters:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `date` | `string` | Yes | `YYYY-MM-DD` format |
| `duration` | `number` | No | `15`, `30`, `60`, or `120`. Defaults to all durations |
| `tz` | `string` | No | IANA timezone (e.g. `America/New_York`). Defaults to server timezone |

**Success `200`:**
```json
{
  "slots": [
    {
      "start":      "2026-06-20T14:00:00.000Z",
      "end":        "2026-06-20T15:00:00.000Z",
      "label":      "10:00 AM",
      "localLabel": "10:00 AM EDT"
    }
  ],
  "timezone": "America/Argentina/Buenos_Aires"
}
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 400 | (message) | Invalid date format or invalid duration value |
| 429 | (message) | Rate limit exceeded |
| 500 | (message) | Google Calendar API failure |

---

## Booking

### `POST /api/book`

Books a session slot. Paid sessions (`session1h`, `session2h`) require a
`rescheduleToken` obtained after payment completes — they **cannot** be booked directly.
Pack sessions deduct one credit atomically.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limiting | None |

**Request body:**
```json
{
  "startIso":        "2026-06-20T14:00:00.000Z",
  "endIso":          "2026-06-20T15:00:00.000Z",
  "sessionType":     "free15min | session1h | session2h | pack",
  "note":            "optional, max 1000 chars",
  "timezone":        "America/New_York",
  "rescheduleToken": "optional — required for session1h/session2h, and for reschedules"
}
```

`sessionType` values:

| Value | Description | Payment |
|---|---|---|
| `free15min` | Free 15-min intro call | None |
| `session1h` | 1-hour individual session | Requires prior Stripe payment → `rescheduleToken` |
| `session2h` | 2-hour individual session | Requires prior Stripe payment → `rescheduleToken` |
| `pack` | Class from a credit pack | Deducts 1 credit |

**Success `200`:**
```json
{
  "ok":             true,
  "eventId":        "google_calendar_event_id",
  "zoomSessionName":"abc123",
  "zoomPasscode":   "123456",
  "cancelToken":    "opaque-token",
  "joinToken":      "opaque-token",
  "emailFailed":    false
}
```

> `joinToken` is used with `GET /sesion/:joinToken` (web) or `POST /api/zoom/token` (app).
> `cancelToken` is used with `POST /api/cancel`.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed |
| 400 | `INVALID_REQUEST` | Schema validation failed |
| 400 | `REQUIRES_PAYMENT` | `session1h`/`session2h` sent without `rescheduleToken` |
| 400 | `INSUFFICIENT_CREDITS` | Pack session with zero credits |
| 400 | `INVALID_RESCHEDULE_TOKEN` | Token not found or already used |
| 400 | `OUTSIDE_RESCHEDULE_WINDOW` | Session starts in < 2 hours |
| 400 | `SESSION_TYPE_MISMATCH` | Reschedule token session type differs |
| 400 | `RESCHEDULE_TOKEN_CONSUMED` | Token already consumed by a concurrent request |
| 409 | `SLOT_UNAVAILABLE` | Slot was taken between availability check and booking |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### `POST /api/cancel`

Cancels a booking using the `cancelToken` returned at booking time. No user session
is required — the token is the credential. Cancellation is only allowed more than
**2 hours** before the session start. Pack credits are restored on successful cancellation.

| Property | Value |
|---|---|
| Auth required | No (token-based) |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limiting | None |

**Request body:**
```json
{
  "token": "opaque-cancel-token"
}
```

**Success `200`:**
```json
{
  "ok":              true,
  "sessionLabel":    "Sesión individual · 1 hora",
  "startIso":        "2026-06-20T14:00:00.000Z",
  "creditsRestored": false
}
```

> `sessionLabel` language follows the `NEXT_LOCALE` cookie value (`es`/`en`).

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 403 | (message) | CSRF check failed |
| 400 | (message) | Missing or non-string `token` field |
| 400 | `INVALID_CANCEL_TOKEN` | Token not found in database |
| 400 | `OUTSIDE_CANCEL_WINDOW` | Session starts in < 2 hours |
| 400 | `CANCEL_TOKEN_CONSUMED` | Token already used (concurrent cancellation) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Payment

### `POST /api/stripe/checkout`

Creates a Stripe PaymentIntent and returns its `clientSecret` for use with the
Stripe SDK. Two flows:

- **`pack`** — buys a credit pack (5 or 10 classes).
- **`single`** — pays for one `session1h` or `session2h`; the slot is reserved via
  the webhook after payment succeeds.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limit | 10 req/min per IP |

**Request body (pack):**
```json
{
  "type":     "pack",
  "packSize": 5
}
```
`packSize`: `5` or `10`.

**Request body (single session):**
```json
{
  "type":            "single",
  "duration":        "1h",
  "startIso":        "2026-06-20T14:00:00.000Z",
  "endIso":          "2026-06-20T15:00:00.000Z",
  "rescheduleToken": "optional — present only for rescheduling a paid session"
}
```
`duration`: `"1h"` or `"2h"`.

**Success `200`:**
```json
{
  "clientSecret":    "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxxxxxxxxxxxxxx"
}
```

Use `clientSecret` with the Stripe SDK to complete payment. After payment succeeds,
Stripe fires a webhook that creates/completes the booking server-side.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed |
| 400 | `INVALID_REQUEST` | Schema validation failed or malformed JSON |
| 429 | (message) | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Stripe PaymentIntent creation error |

---

### `GET /api/stripe/session`

Retrieves a confirmed payment summary. Use this after Stripe payment succeeds to
display a confirmation screen (especially for the redirect-based flow).

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limiting | None |

**Query parameters:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `payment_intent_id` | `string` | Yes | Must start with `pi_` |

**Success `200` (pack checkout):**
```json
{
  "checkoutType": "pack",
  "email":        "student@example.com",
  "name":         "Student Name",
  "packSize":     5
}
```

**Success `200` (single session checkout):**
```json
{
  "checkoutType":    "single",
  "email":           "student@example.com",
  "name":            "Student Name",
  "sessionDuration": "1h"
}
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 400 | (message) | Missing or malformed `payment_intent_id` |
| 401 | (message) | Not authenticated |
| 402 | (message) | Payment not yet completed |
| 403 | (message) | Authenticated user's email ≠ PaymentIntent's email |
| 400 | (message) | Incomplete metadata in PaymentIntent |
| 500 | (message) | Stripe retrieval error |

---

### `GET /api/payment-confirmation/channel`

Returns the Supabase Realtime channel name to subscribe to for live payment
confirmation, plus the current payment state (useful if the webhook already fired
before the client subscribed).

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limiting | None |

**Query parameters:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `payment_intent_id` | `string` | Yes | Must start with `pi_` |

**Success `200`:**
```json
{
  "channelName": "payment-confirmed:hmac-derived-string",
  "confirmed":   false,
  "credits":     null,
  "name":        "Student Name",
  "packSize":    null
}
```

When `confirmed` is `true`, `credits` and `packSize` are populated (for pack
purchases). Subscribe to `channelName` via Supabase Realtime to receive the
`payment-confirmed` event in real time.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 400 | (message) | Missing or malformed `payment_intent_id` |
| 401 | (message) | Not authenticated |
| 403 | (message) | Authenticated email ≠ PaymentIntent email |
| 500 | (message) | Stripe retrieval error |

---

## Session / Chat

### `POST /api/zoom/token`

Issues a Zoom Video SDK JWT so the authenticated student can join their booked session.
Only the student who owns the booking (or the tutor) may call this.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limit | 60 req/min per IP (shared with availability limiter) |

**Request body:**
```json
{
  "eventId": "google_calendar_event_id"
}
```

**Success `200`:**
```json
{
  "token":       "eyJ...",
  "sessionName": "abc123",
  "userName":    "Student Name",
  "role":        0
}
```

`role`: `0` = participant (student), `1` = host (tutor).

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed or `UNAUTHORIZED` (not the session's student) |
| 400 | (message) | Missing or empty `eventId` |
| 404 | `BOOKING_NOT_FOUND` | No booking found for this `eventId` |
| 429 | (message) | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### `GET /api/chat-session/channel`

Returns the Supabase Realtime channel name for in-session chat, plus the full message
backlog. Call this once when entering a session to bootstrap the chat UI.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limiting | None |

**Query parameters:**

| Param | Type | Required |
|---|---|---|
| `eventId` | `string` | Yes |

**Success `200`:**
```json
{
  "channelName":    "session-chat:hmac-derived-string",
  "initialMessages": [
    {
      "sender":    "student@example.com",
      "text":      "Hello!",
      "createdAt": "2026-06-20T14:05:00.000Z"
    }
  ]
}
```

Subscribe to `channelName` via Supabase Realtime after loading the backlog to receive
new messages in real time.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 400 | (message) | Missing `eventId` |
| 401 | (message) | Not authenticated |
| 403 | `UNAUTHORIZED` | Not the session's student or tutor |
| 404 | `BOOKING_NOT_FOUND` | No booking for this `eventId` |

---

### `POST /api/chat-session`

Sends a chat message during an active session. Messages are persisted in Supabase and
broadcast to the Realtime channel returned by `GET /api/chat-session/channel`.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limit | 20 req/min per IP |

**Request body:**
```json
{
  "eventId": "google_calendar_event_id",
  "text":    "Message content (max 1000 chars)"
}
```

`text` is server-side truncated to 1000 characters.

**Success `200`:**
```json
{ "ok": true }
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed or `UNAUTHORIZED` (not session member) |
| 400 | (message) | Missing or empty `eventId` or `text` |
| 404 | `BOOKING_NOT_FOUND` | No booking for this `eventId` |
| 429 | (message) | Rate limit exceeded |

---

### `POST /api/chat`

Pre-session AI chat (public chatbot powered by Gemini). Anonymous users can send a
limited number of messages before being asked to sign in.

| Property | Value |
|---|---|
| Auth required | No (optional — raises rate limits when authenticated) |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limit | **Authenticated:** 20 req/min per user email · **Anonymous:** 5 req/min + 30 req/day per IP |

**Request body:**
```json
{
  "message":   "Your question (max 1000 chars)",
  "sessionId": "optional-uuid-from-previous-reply"
}
```

Pass `sessionId` from the previous response to maintain conversation context.

**Success `200`:**
```json
{
  "reply":     "AI response text",
  "sessionId": "uuid-for-next-turn"
}
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 400 | (message) | Missing or empty `message`, or malformed JSON |
| 403 | (message) | CSRF check failed |
| 429 | (message) | Rate limit exceeded |
| 429 | `{ "error": "...", "requiresAuth": true }` | Anonymous daily cap reached — prompt to sign in |
| 502 | (message) | Gemini API error |
| 503 | (message) | Global daily Gemini request cap reached |

---

## Profile

### `GET /api/credits`

Returns the authenticated student's credit balance and account summary.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limit | 60 req/min per IP |

**Success `200`:**
```json
{
  "credits":     3,
  "name":        "Student Name",
  "packSize":    5,
  "hasBookings": true
}
```

`packSize` is `null` if the user has never purchased a pack.
`hasBookings` is `true` if the user has at least one booking on record.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 429 | (message) | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

### `POST /api/locale`

Persists the user's preferred locale to the database (`users.locale`) and sets the
`NEXT_LOCALE` cookie (1-year expiry). Call this when the user explicitly changes language.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limiting | None |

**Request body:**
```json
{
  "locale": "es"
}
```

`locale`: `"es"` or `"en"`.

**Success `200`:**
```json
{ "ok": true }
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed |
| 400 | `INVALID_REQUEST` | Schema validation failed |

---

## History

### `GET /api/my-bookings`

Returns all of the authenticated student's bookings (upcoming and past).

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limiting | None |

**Success `200`:**
```json
{
  "bookings": [
    {
      "token":       "opaque-cancel-token",
      "joinToken":   "opaque-join-token",
      "sessionType": "pack",
      "startsAt":    "2026-06-20T14:00:00.000Z",
      "endsAt":      "2026-06-20T15:00:00.000Z",
      "packSize":    5
    }
  ]
}
```

`packSize` is only present for `sessionType: "pack"` bookings.
`token` is the cancel token; use it with `POST /api/cancel`.
`joinToken` can be used to build the join URL (`/sesion/:joinToken`) or with
`POST /api/zoom/token` (which takes `eventId`, not `joinToken` — resolve `eventId`
from the session/booking screen via a deep-link or server-side lookup).

> **Note:** The response includes all bookings regardless of status (confirmed,
> completed, cancelled). The mobile app must filter by `startsAt` to separate
> upcoming from past sessions.

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |

---

## Reviews

### `POST /api/reviews`

Submits a post-session review. Three sub-actions share this endpoint, discriminated
by `kind`.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | Yes — `Origin` header required; 403 if invalid |
| Rate limit | 20 req/min per IP |

**Request body — star rating:**
```json
{
  "kind":    "rating",
  "eventId": "google_calendar_event_id",
  "rating":  5
}
```
`rating`: integer `1`–`5`.

**Request body — written comment:**
```json
{
  "kind":    "comment",
  "eventId": "google_calendar_event_id",
  "comment": "Great session! (max 1000 chars)"
}
```

**Request body — Google review prompt response:**
```json
{
  "kind":   "google",
  "action": "accept"
}
```
`action`: `"accept"` or `"decline"`.

**Success `200` (rating):**
```json
{
  "ok":               true,
  "showGoogleReview": true
}
```
`showGoogleReview` is `true` when the server wants the app to show the Google review
prompt (e.g. after a 5-star rating from an eligible student).

**Success `200` (comment or google):**
```json
{ "ok": true }
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 403 | (message) | CSRF check failed |
| 400 | `INVALID_REQUEST` | Schema validation failed |
| 404 | `REVIEW_BOOKING_NOT_FOUND` | No eligible booking found for this `eventId` |
| 429 | (message) | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Newsletter Subscriptions

### `POST /api/subscribe`

Subscribes the authenticated student to a newsletter list.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limit | 10 req/min per IP |

**Request body:**
```json
{
  "type": "courses"
}
```
`type`: `"courses"` or `"blog"`.

**Success `200`:**
```json
{ "ok": true }
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 400 | `INVALID_REQUEST` | Schema validation failed |
| 409 | `ALREADY_SUBSCRIBED` | Already subscribed to this list |
| 429 | (message) | Rate limit exceeded |

---

### `GET /api/subscribe?type=<type>`

Checks whether the authenticated student is subscribed to a given list.

| Property | Value |
|---|---|
| Auth required | Yes — 401 if absent |
| CSRF | No |
| Rate limit | 10 req/min per IP |

**Query parameters:**

| Param | Type | Required |
|---|---|---|
| `type` | `"courses" \| "blog"` | Yes |

**Success `200`:**
```json
{ "subscribed": true }
```

**Errors:**

| Status | `error` | Condition |
|---|---|---|
| 401 | (message) | Not authenticated |
| 400 | `INVALID_REQUEST` | Schema validation failed |
| 429 | (message) | Rate limit exceeded |

---

## Rate Limit Summary

| Endpoint(s) | Limit | Key |
|---|---|---|
| `GET /api/availability` | 60/min | Per IP |
| `GET /api/credits` | 60/min | Per IP |
| `POST /api/zoom/token` | 60/min | Per IP |
| `POST /api/chat` (authenticated) | 20/min | Per user email |
| `POST /api/chat-session` | 20/min | Per IP |
| `POST /api/reviews` | 20/min | Per IP |
| `POST /api/stripe/checkout` | 10/min | Per IP |
| `GET /api/subscribe`, `POST /api/subscribe` | 10/min | Per IP |
| `POST /api/chat` (anonymous) | 5/min + 30/day | Per IP |

---

## Domain Error Code Reference

| Code | Default HTTP | Description |
|---|---|---|
| `INSUFFICIENT_CREDITS` | 400 | Student has no pack credits left |
| `SLOT_UNAVAILABLE` | 409 | Time slot was taken by a concurrent booking |
| `INVALID_RESCHEDULE_TOKEN` | 400 | Reschedule token not found or already used |
| `OUTSIDE_RESCHEDULE_WINDOW` | 400 | Session starts in < 2 hours |
| `SESSION_TYPE_MISMATCH` | 400 | Reschedule token session type doesn't match request |
| `RESCHEDULE_TOKEN_CONSUMED` | 400 | Token already consumed by a concurrent request |
| `REQUIRES_PAYMENT` | 400 | Paid session type sent without a reschedule token |
| `INVALID_CANCEL_TOKEN` | 400 | Cancel token not found |
| `OUTSIDE_CANCEL_WINDOW` | 400 | Session starts in < 2 hours (cancellation window closed) |
| `CANCEL_TOKEN_CONSUMED` | 400 | Cancel token already used |
| `BOOKING_NOT_FOUND` | 400 | Booking not found for the given identifier |
| `UNAUTHORIZED` | 403 | Authenticated user is not the owner of this resource |
| `ALREADY_SUBSCRIBED` | 409 | User is already on this mailing list |
| `REVIEW_BOOKING_NOT_FOUND` | 404 | No eligible booking found for review |
| `INTERNAL_ERROR` | 500 | Unhandled server error (reported to Sentry) |
