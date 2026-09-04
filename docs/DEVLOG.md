# DEVLOG — why the app is the way it is

This is the narrative and reasoning behind the app: architecture decisions,
backend-contract findings, and the chronological build history. `CLAUDE.md` is
the lean current-state reference (the live rules a maintainer needs tomorrow);
**this file is the archive of how we got there and why.**

When a decision is made or a screen is built, the *reasoning and dated record*
goes here; only the resulting *current-state rule* goes into `CLAUDE.md`.

---

## Part 1 — Architecture Decision Records

Each: the decision, the context that forced it, and the consequences we accepted.

### ADR-1: Payment confirmation is POLL-ONLY, not Realtime

**Decision.** S06 (single-session) and S10 (pack) confirm payment by
authoritative polling of `/api/payment-confirmation/channel`, not by a Supabase
Realtime subscription.

**Context.** The web app confirms credits over a Realtime SSE path
(`useSSECredits`). We deliberately did **not** mirror that on mobile. The
backend channel's status is *total* (authoritative) — polling it to a terminal
state is sufficient and simple. A Realtime subscription would introduce an
optimistic-vs-real reconciliation surface (the whole bug class of "the UI showed
credits before they existed / showed a booking the server later rejected").

**Consequences.** `lib/payment-confirmation.ts` holds two pure pollers
(`pollPaymentConfirmation` for S06, `pollPackConfirmation` for S10), no
React/timers baked in, `now`/`sleep` injectable, resolve-exactly-once, unit
tested. Both swallow transient errors and cap at a 30s ceiling (→ timeout/limbo).
`pollPackConfirmation` fails LOUD (`kind:'error'`) if the channel returns the
single-session shape for a flow we initiated as a pack. The Supabase client
(`lib/supabase.ts`) exists but is **fenced to chat only** (see ADR-3). PRODUCT
RULE that fell out of this: S10 never shows credits before they exist — it holds
at "Confirmando pago…" until `confirmed===true`.

### ADR-2: New Arch + Zoom's legacy SDK through the interop shim; minSdk 28 bump

**Decision.** Run the app on React Native's New Architecture (forced by
Reanimated 4) with `@zoom/react-native-videosdk` **pinned EXACT 2.5.10** — a
legacy-arch SDK — running through RN's New-Arch **interop shim**. Bump
`android.minSdkVersion` to **28**.

**Context.** Reanimated 4 requires New Arch. Zoom 2.5.10 is a legacy-arch native
module; New Arch's interop layer is supposed to bridge such modules but Zoom
video *views* rendering through the shim was unsupported/unproven — the gamble
was whether `<ZoomView>` would render at all or crash with
`IllegalViewOperationException`. Separately, Zoom 2.5.10 declares `minSdk 28`, so
the Expo-54 default of 24 fails the Android manifest merge
(`processDebugMainManifest`).

**Consequences.** The gamble paid off: video-view render was **verified on
2026-07-01** — a throwaway smoke test confirmed the local `<ZoomView>` renders
the camera feed through the interop shim on Android (the
`eventId → /api/zoom/token → joinSession → getMySelf → <ZoomView>` chain works
end-to-end, no `IllegalViewOperationException`). The smoke-test screen was
deleted once verified. S14's local preview and S15's remote view both render
through the same path. The minSdk bump (via the `expo-build-properties` plugin,
`android.minSdkVersion:28`) **drops support for Android 7.0–8.1 (API 24–27)** —
accepted as the only viable path for this Zoom version (override/downgrade
rejected). `expo-build-properties` is a config plugin only (no runtime native
module; takes effect at prebuild). Zoom ships **no** config plugin — autolinking
handles the native module. Camera/mic permissions were added: iOS infoPlist
`NSCameraUsageDescription`/`NSMicrophoneUsageDescription` (Spanish), Android
`CAMERA` + `RECORD_AUDIO` (alongside `POST_NOTIFICATIONS`). The iOS
`ONLY_ACTIVE_ARCH` Podfile tweak is deferred (iOS-only TODO; current target is
Android).

### ADR-3: The Supabase Realtime client is CHAT-ONLY

**Decision.** `lib/supabase.ts` + `lib/use-chat-session.ts` are the app's only
Realtime consumers, scoped exclusively to in-session text chat (S15 Pass B).
Payments never use this path.

**Context.** Once a Supabase client existed for chat, it would be tempting to
also confirm payments over Realtime. That would undo ADR-1. A scope-fence comment
lives in `lib/supabase.ts`.

**Consequences.** Auth-session persistence is disabled in the client (chat uses
no Supabase auth), which avoids pulling in an AsyncStorage dependency.
`@supabase/supabase-js` is pinned EXACT 2.110.0 and is JS-only (no native build
impact, rides into the bundle).

### ADR-4: Exactly one route owns "/" (named tab-landing files)

**Decision.** Only `app/(tabs)/(home)/index.tsx` is named `index.tsx`; the other
three tab landing screens are **named files** (`session-type.tsx`, `packs.tsx`,
`profile.tsx`), not `index.tsx`.

**Context.** When multiple tab groups each had an `index.tsx`, they all mapped to
`/`, and expo-router resolved a cold start to the alphabetically-first group
`(booking)` instead of Inicio. Setting `unstable_settings.initialRouteName` in
`(tabs)/_layout.tsx` alone did **not** fix it.

**Consequences.** Exactly one route owns `/`, so the app reliably cold-starts on
Inicio. Live rule for any new tab: keep its landing screen a named route, not
`index.tsx`.

### ADR-5: ZoomVideoSdkProvider is an app-session singleton at the root

**Decision.** `ZoomVideoSdkProvider` is mounted **once** at the app root
(`app/_layout.tsx`, inside `StripeProvider` around `RootNavigator`, config
`enableLog:__DEV__`), **not** scoped to the `(video)` route group.

**Context.** The `(video)` layout remounts on every entry. The library re-calls
`initSdk` with no unmount cleanup; a second init on the already-initialized
native SDK returns an error the native module rejects with a null `userInfo`,
NPE-crashing the app (`RNZoomVideoSdkModule.initSdk`).

**Consequences.** Init-at-launch is the accepted tradeoff (native lib init only;
no camera/mic access, no launch prompt). The `(video)` group still exists
(`app/(video)/_layout.tsx` = a plain `<Stack>`) purely to hold the
tab-bar-hidden video routes; parenthesized so URLs stay `/video-prejoin`,
`/video-room`.

### ADR-6: i18n is pure-JS; DB-locale-wins / null-seeds-from-device precedence

**Decision.** The i18n foundation (`lib/i18n/`) is pure JS — device language via
`Intl`, persistence via the already-compiled expo-secure-store — **no
expo-localization, no AsyncStorage, no native dep, no rebuild.**

**Context.** We needed device-language detection + a persisted user choice + a
server sync without adding a native module. `Intl.DateTimeFormat().resolvedOptions().locale`
gives the device language (mirrors `getDeviceTimeZone`); secure-store already
ships in the dev client.

**Precedence rule (strict ordering).** The locale reconcile runs ONLY on a fresh
token exchange — interactive sign-in OR silent refresh — via `onAuthExchange` in
`lib/auth.ts` (a listener set notified at the end of `exchangeGoogleToken`;
`hydrateSession` deliberately does NOT fire it, so persisted launches keep the
device-stored choice and never re-derive from device language). On exchange:
`user.locale != null` → **adopt it** (backend/stored preference always wins, even
over device language, no POST); `null` (new user — mobile auth never seeds) →
derive from device, apply, and POST `/api/locale` **once** to seed the DB (emails
default to 'es' until seeded, so fire early). `AuthUser.locale` (`Locale | null`)
is captured from `/api/auth/mobile` and persisted in the session blob.

**Consequences / known limitation.** The native **Stripe PaymentSheet** (S06
`confirm.tsx`, S10 `pay.tsx`) does NOT follow the in-app language toggle: it is a
native surface whose language comes from the Android OS/app locale
(`Locale.getDefault()`), and `@stripe/stripe-react-native` 0.50.3 exposes no
locale option (checked initPaymentSheet / presentPaymentSheet / StripeProvider /
native `PaymentSheet.Configuration`). Our pure-JS i18n has no native locale to
hand it. Accepted as-is (2026-07-02): the sheet follows the device language.
Forcing a match would require a native module calling
`AppCompatDelegate.setApplicationLocales(...)` + a dev-client rebuild, and that
API recreates the Android activity (RN reload) so it can't fire mid-checkout —
deferred, not worth the rebuild for a short standard payment surface. Euro
formatting (`formatEur`) is deliberately left on `es-ES` — number formatting, not
translated text.

### ADR-7: Auth — bearer + single-flight silent refresh + expired-session routing

**Decision.** Google Sign-In → bearer token exchange; the full session is
persisted to expo-secure-store; a 401 triggers a single-flight silent refresh;
an unrecoverable-but-identity-preserving lapse routes to S02 rather than
signing out.

**Context.** Google Sign-In handshake was verified end-to-end on physical Android
(dev build); bearer exchange works against staging. `signInSilently()` (the
cached-credentials path, no picker) re-fetches a Google idToken, which we
re-exchange. But `signInSilently()` only works while Google still holds a cached
credential for this install (~30 days); if it returns `noSavedCredentialFound`
there is no silent path.

**Design.** `refreshSession()` in `lib/auth.ts` collapses concurrent 401s into
exactly one refresh via a module-level `_refreshInFlight` promise (single-flight);
all waiters retry with the one new token; api-client retries at most once (the
`isRetry` flag). The hook (wired in `lib/auth-context.tsx`) mirrors the new
session into React state on success. On failure it forks by `AuthError` code:
`NO_SAVED_CREDENTIAL` (the ~30-day credential lapsed) → **keep** the session +
set the `expired` flag → route to S02, preserving identity for the "Continuar
como" card; any other failure (network/backend reject) → sign out +
`setSession(null)` → `/login`. Reachability: `app/_layout.tsx` splits the
signed-in guard into `isSignedIn && !expired` (tabs + full-screen experiences) vs
`isSignedIn && expired` (session-expired only). On successful re-auth `signIn()`
sets a fresh session + clears `expired` → guard flips back.

**Consequences.** Reactive only — no proactive pre-expiry refresh; cold restart
self-heals (stale persisted session → first 401 → refresh hook → expired again).
RETURN-TO-CONTEXT is land-on-Inicio (the `(tabs)` group remounts at its initial
route): the routing captures no prior route, so true return-to-context is a
marked TODO at the refresh hook in `lib/auth-context.tsx`. Tested in
`lib/__tests__/auth-refresh.test.ts` (single-flight, retry discipline,
no-refresh-on-non-401, no-loop-on-failure).

---

### ADR-8: Free 15-min intro — true 15-min grid + client-side new-user gate

**Decision.** Add a free 15-minute intro session as a first-class booking flow:
S04 offers a free card → S05 in `mode:'free'` renders a **true 15-min-step grid**
→ `confirm-free.tsx` books it synchronously via `POST /api/book`
(`sessionType:'free15min'`, no payment, no credit) → S08. The free card is shown
**only to new accounts** (`GET /api/credits` → `hasBookings === false`).

**Context.** The backend already fully supported `free15min` — `POST /api/book`
takes it with no payment/`rescheduleToken`, `GET /api/availability` takes
`duration:15`, and the type + every downstream/display screen (cancel, detail,
reschedule, calendar, video-prejoin, BookingRow) already handled it. The gap was
purely the **creation path**. Two shape-defining choices were made with the
product owner: (1) a *true* 15-min grid rather than booking 15 min inside a 30-min
cell; (2) restrict the intro to new users.

**Design.** The S05 grid step was hardcoded to 30 min in many places
(`lib/grid-time.ts` loops/contiguity and `schedule.tsx` tap/continue math).
Rather than special-case free, the step and block-count were parameterized behind
`gridUnitsFor(duration)` (`'15min'→{15,1}`, `'1h'→{30,2}`, `'2h'→{30,4}`) and
threaded through `buildGridModel` and the screen. `N=1` needed no new branch — the
existing Pass-2 forward/backward loops are skipped when `N===1`, so every free
cell resolves to `available`. The free flow fetches availability at `duration:15`;
all real IANA offsets are multiples of 15 min, so 15-min slots stay aligned to the
15-min cell minutes. `confirm-free.tsx` mirrors `confirm-credit.tsx` minus all
credit logic (no balance load, no cross-sell); it recomputes `endIso = start +
15min` rather than trusting the passed slot end.

**Consequences.** The new-user gate is **client-side only** — the API enforces no
limit and exposes no "already used a free intro" signal, so `hasBookings` is a
proxy and the gate is bypassable; it fails closed (hidden) if the credits check
can't load. Accepted until/unless the backend grows an eligibility flag. The
15-min grid is ~2× as tall as the 30-min grid (more rows/hour) but reuses the same
rendering; cell height was left at 40px. Grid math covered by new cases in
`lib/__tests__/grid-time.test.ts` (`gridUnitsFor`, 15-min step, N=1 availability).

---

### ADR-9: Account deletion lives in S18 (Ajustes), not S17 (Perfil)

**Context.** ACCOUNT-DELETE-01 added `GET`/`DELETE /api/account`, and both stores
now require in-app deletion for any app that supports account creation (Apple
5.1.1(v), Google Play's data-deletion policy) — so the v1.0 "delete account: web
only" scope cut (docs/design/design-brief.md) had to be reversed. The entry point
could go on S17 Perfil (the account-identity screen, which already shows the
avatar, email and a sign-out button) or on S18 Ajustes.

**Decision.** The entry point is a quiet row in a new **Cuenta** section at the
BOTTOM of S18, below sign-out, pushing a dedicated screen
(`(profile)/delete-account.tsx`, S21). Perfil gets nothing.

**Why.**
- S17 is the screen a student opens to look at their balance and history; it is
  reached in one tap from the tab bar, and its only footer control is *Cerrar
  sesión*. Putting an irreversible action next to a routine one, on a
  frequently-visited screen, is exactly the mis-tap the contract's "an unhurried
  entry point, not a primary action" guidance warns against.
- S18 is already the destination for account-shaped state (notification prefs,
  calendar permission, language) and is one level deeper. Perfil's own row
  subtitle already promises "Notificaciones, idioma y **privacidad**".
- The flow is multi-step and stateful (verdict fetch → one of three screens →
  typed-email confirmation → in-flight lock), which is a screen, not a sheet
  hanging off a profile card.

**The teardown is the load-bearing part.** The bearer is stateless and stays valid
for up to an hour after the account is gone; protected routes `ensureUser()`-upsert
and `POST /api/auth/mobile` registers the user. This app auto-refreshes on 401
(ADR-7), so the *existing* recovery path would have resurrected the deleted
account on the very next background request. Hence `setRefreshEnabled(false)` in
`lib/api-client.ts`, called FIRST by `useAuth().completeAccountDeletion()` and
re-armed only by an interactive `signIn()`. `purgeSession()` (a deletion-specific
sibling of `signOutGoogle()`) drops the in-memory bearer before anything else and
does not let a failing `GoogleSignin.signOut()` leave the stored session behind.

**Consequences.** The gate's three outcomes are rendered off `reason`, never off
the counts — rule 2 (every cancellable class is a pack class) blocks with
`packCredits: 0`, so a count-driven screen would print "0 unused classes"; it gets
its own copy (`blockedPack.bodyPackClasses`). The verdict is advisory: a 409 on
submit re-fetches it and re-renders the matching blocked screen instead of showing
an error. Both blocked screens ship a working action (compose an email to Gustavo,
or go to the upcoming-classes screen) — a dead end would not satisfy the store
policies that forced this work. Deletion also cancels the OS-scheduled class
reminders, which point at bookings that no longer exist.

---

## Part 2 — Backend-contract findings that unlocked mobile

Records of what we discovered about the live Next.js API — the gaps we depended
on or had to have built.

- **SINGLE-SESSION-CONFIRM-01.** A single-session confirmation gap had to be
  built on the backend before mobile could confirm single-session payments. The
  slot-taken outcome carries a refund signal.
  `types/api.ts GetPaymentConfirmationChannelResponse` is a union discriminated
  on `checkoutType` (`pack | single`).
- **`eventId` on `/api/my-bookings`.** Exposing `eventId` on the my-bookings item
  (`Booking.eventId`) is what unlocked zoom join, in-session chat, and reviews —
  all keyed by `eventId`.
- **Reschedule payment-carryover.** A paid reschedule goes through `/api/book`
  with a `rescheduleToken` and is **payment-free** (the server bypasses
  `REQUIRES_PAYMENT`) — no re-charge. Finding/consequence: the new booking row
  has a **NULL `stripe_payment_id`** (an admin-visibility gap; see docs/TODO.md).
- **Live `/api/zoom/token` shape (verified 2026-07-01).** `PostZoomTokenResponse`
  = `{ token, sessionName, passcode (→ SDK sessionPassword), startIso,
  durationWithGrace (minutes, incl. grace), expiresAt (unix seconds) }`. The live
  endpoint does **not** return `userName`/`role` despite the contract doc — get
  the join display name from the auth session. `types/api.ts` was aligned to this.
- **Depleted-pack signal.** `GET /api/credits` **NULLs `packSize`** once a pack
  is fully consumed (despite the contract wording). So "owns/owned a pack" must
  NOT be derived from `credits.packSize` alone — Home computes
  `ownedPack = credits.packSize != null OR any booking has sessionType:'pack'`
  and gates the depleted `CreditBalanceCard` nudge on that, otherwise the
  0-credit repurchase card vanishes. `GetCreditsResponse` has no expiry field yet
  (S09/S10 expiry omitted, TODO in BalanceCard).
- **ChatMessage realignment.** The live chat contract is: `GET
  /api/chat-session/channel?eventId → { channelName (HMAC capability
  "chat:<hash>", returned only after a membership check), initialMessages }`;
  RECEIVE via Supabase broadcast on `channelName`, event `"message"`, payload =
  `ChatMessage { id:"<eventId>:<index>", senderEmail, senderName, text,
  sentAt(ISO) }`; SEND via `POST /api/chat-session { eventId, text }` (bearer;
  persists = source of truth, then broadcasts). `types/api.ts ChatMessage` was
  realigned to this — the old stub `{ sender, text, createdAt }` was wrong.

---

## Part 3 — Chronological build history

Per-screen / per-pass implementation diary. Kept for context; the current
behaviour of each screen is summarized in `CLAUDE.md`'s navigation tree.

### Auth (S01/S02) and launch

- Google Sign-In handshake verified end-to-end on physical Android (dev build);
  bearer token exchange working against staging backend.
- Secure token storage: the full session is persisted to expo-secure-store via
  `lib/token-store.ts`; `lib/auth.ts` keeps a synchronous in-memory cache
  (`getStoredSession`, what api-client reads) that's write-through on
  exchange/sign-out and rehydrated at launch by `hydrateSession()`.
- Launch routing: `lib/auth-context.tsx` hydrates on mount, holds
  `session`+`isReady`; `app/_layout.tsx` keeps the native splash up until
  `isReady`, then gates routes with `<Stack.Protected guard>` (signed-in group vs
  `login`). No login flash on cold start. Launch is presence-check only — an
  expired token 401s on first API call (handled by the silent-refresh task; see
  ADR-7).
- S01 sign-in screen at `app/login.tsx`; sign-out lives in its real home on S17
  Perfil (and is reachable from S18 Ajustes) — the temporary stub is gone.
- Silent refresh on 401 (A3) — see ADR-7 for the full design.
- S02 session-expired re-login (`app/session-expired.tsx`): re-entry framing (icon
  badge + "Tu sesión ha caducado" + "Continuar como" identity card from
  `session.user` + the same native Google button as S01), fully localized via
  `sessionExpired.*`; reuses `useAuth().signIn` (no auth reimplemented) with
  idle/connecting/error/offline states mirroring S01.

### Booking + payment flow (S04–S08)

- Stripe integration: `StripeProvider` in `app/_layout.tsx` (card-only, Google
  Pay off for now); PaymentSheet wired in `confirm.tsx` (S06 Pass A).
- S06 Pass B confirms the booking by authoritative polling (see ADR-1). On
  `confirmed` → S08 (`success.tsx`, renders booking summary + join card from its
  params); slot_taken/failed/timeout resolve to on-screen terminal states.
- S07 credit booking (`confirm-credit.tsx`) is SEPARATE from the Stripe flow and
  SYNCHRONOUS — `POST /api/book` with `sessionType:'pack'` returns the completed
  booking in one call (no Stripe, no poll, no Realtime). Entered from Home's
  "Reservar con crédito" → grid in `mode:'credit'` (always 1h, session-type
  skipped) → S07. Fetches `getCredits` for the balance, guards double-submit
  (`submittingRef`), routes outcomes by `ApiError.code` (NOT status — contract
  documents `INSUFFICIENT_CREDITS` as 400, robust either way): success → S08
  (renders as 1h), `INSUFFICIENT_CREDITS` → sin-créditos cross-sell (Ver packs /
  Pagar esta clase reusing the slot in S06), `SLOT_UNAVAILABLE` → back to grid,
  429/400/500/network → inline retry banner. Device tz via `getDeviceTimeZone()`.
  On success passes `remainingCredits` to S08; when it hits 0 on a pack booking,
  S08 shows a "Has usado tu último crédito" repurchase nudge (→ Packs).

### Packs (S09/S10)

- S09 catalog: loads `getPricing` (required) + `getCredits` (best-effort) in
  parallel; renders two packs (pack10 featured "Recomendado", pack5) with
  price/per-class/savings ALL from `pricing.packs` (never hardcoded); "con pack
  activo" shows a glowing balance card, "sin pack" shows value-props + convert.
  Expiry omitted (no field yet). "Comprar" → S10 with `packSize` (5|10).
- S10 reuses the S06 Stripe path but simpler (no slot → no slot_taken): `POST
  /api/stripe/checkout {type:'pack',packSize}` → initPaymentSheet/
  presentPaymentSheet (card), then holds at "Confirmando pago…". Confirmation is
  poll-only via `pollPackConfirmation()` (see ADR-1). On confirmed → in-screen
  success showing the new balance + "Reservar ahora"/"Volver a Packs".
  Declined/other Stripe error → rejected (Reintentar); sheet cancel → silent back.
  Double-submit guarded by `submittingRef` + state. No S08 reuse — own layout.

### Home + detail + lifecycle (S03, S11, S12, S13)

- S11 booking-detail: hero card (date/time prominent, pulsing "Empieza en N min"
  chip when imminent/active), details card (Fecha, Horario, Pago), cancel-policy
  banner, sticky action bar with JOIN (primary+glowing when imminent/active) +
  secondary row (Calendario → S19, Reprogramar → S13, Cancelar → S12). Data comes
  from params passed by Home (token, joinToken, sessionType, startsAt, endsAt,
  packSize) — no API fetch. Routes to S13 with `{ token, startsAt, sessionType }`.
- S08→S11 `goDetail` wired (2026-09-02): S08 now forwards the full param set S11
  expects (`token`, joinToken, eventId, sessionType, startsAt, endsAt), not just
  `eventId`. The cancel/reschedule `token` is `res.cancelToken` from
  `POST /api/book`, threaded through S08 by the two synchronous flows (credit,
  free). The paid (Stripe) flow's `ConfirmedBooking` carries NO cancel token, so
  that path reaches S11 with `token:''`; S11 therefore hides Reprogramar/Cancelar
  when the token is empty (`canManage`) rather than surfacing actions that would
  fail with an invalid token — the class can still be managed later from Home,
  where the token comes off the bookings list. (packSize isn't available at S08,
  so a pack booking shows the generic "1 crédito" pay label, not the sized one.)
- S11 IN-STACK PEEK (2026-09-02): first cut routed S08→`(home)/booking-detail`,
  but that's a cross-tab jump — it switched to Inicio and stranded S08 in the
  Reservar stack, so "back" landed on Home, not S08. Fix: the screen body moved to
  `components/BookingDetailScreen.tsx` and is now registered by TWO thin
  re-export routes — `(home)/booking-detail.tsx` (from Home) and a NEW
  `(booking)/booking-detail.tsx` (from S08). S08 pushes the `(booking)` route, so
  the detail lives on the same stack as S08 and "back" pops to it. Both files
  resolve to the display URL `/booking-detail` but sit under different group
  `_layout`s (distinct route nodes) and are always navigated group-qualified, so
  Expo Router's route-tree builder never flags a conflict (the conflict throw in
  getRoutesCore fires only for same-directory/same-specificity collisions — e.g.
  the two-index-at-"/" case of ADR-4 — not for group siblings). Chosen over a
  "finish flow → show in Inicio" variant per the maintainer.
- S13 reschedule (3-file): `reschedule.tsx` is the 2h gatekeeper — synchronous
  check on mount, shows a blocked bottom-sheet if < 2h before original start,
  else `router.replace` → S05 `mode:'reschedule'` (rescheduleToken,
  lockedSessionType, origStartsAt). S05 in reschedule mode locks duration to the
  original sessionType, hides the toggle, shows a "Moviendo desde" banner, and on
  "Confirmar cambio" → `reschedule-confirm.tsx`: 7-phase state machine
  (confirm/submitting/success/slot_taken/err_invalid_token/err_outside_window/
  err_generic). Confirm sheet: before→after card + 2h reassurance + consequence
  note. POSTs `api.postBook({...,rescheduleToken})` — payment-free (see Part 2).
  Double-submit guarded (`submittingRef`). Error routing: `SLOT_UNAVAILABLE` →
  slot_taken (back to grid); `INVALID_RESCHEDULE_TOKEN` / `SESSION_TYPE_MISMATCH`
  / `RESCHEDULE_TOKEN_CONSUMED` → err_invalid_token (→ Home);
  `OUTSIDE_RESCHEDULE_WINDOW` → err_outside_window (→ Home); 500/network →
  err_generic. `mode:'reschedule'` is a third S05 mode alongside `pay`/`credit`;
  EmptyState shows "Mantener la hora actual" (router.back) instead of "Probar con
  1 hora".
- S12 cancel: destructive-action confirmation, 7-phase state machine
  (confirm/blocked/submitting/success/err_generic/err_invalid_token/
  err_outside_window). Bottom-sheet for confirm/blocked/error; full-screen for
  success. Calls `api.postCancel({token})` — no auth bearer needed (Origin header
  already sent by api-client). 2h window check is synchronous (initializes phase
  state on mount, no useEffect). `isPack` drives copy fork (credit vs paid), but
  `PostCancelResponse.creditsRestored` is the authoritative success signal.
  Success → `router.replace('/(tabs)/(home)')` triggers Home's `useFocusEffect`
  refetch, removing the cancelled booking. All error codes have dedicated phases;
  403/500/network → err_generic. Contact-Gustavo wiring: see "S12/S13 contact
  stubs" below.
- RULE-BEARING COPY kept faithful (verified against
  `docs/design/design-brief.md` Flow E): the paid-cancel refund line is extracted
  as-is — `cancel.refundBody` = "…en 1–3 días hábiles (menos la comisión de
  Stripe)." / "…within 1–3 business days (minus the Stripe fee)." (no fee
  breakdown added, not softened to "minus fees"). Pack product names ("Pack
  Esencial"/"Pack Intensivo") are NOT translated — kept Spanish in both languages.

### Video (S14/S15)

Zoom setup and the render gamble are ADR-2; the provider singleton is ADR-5.

- S14 (`app/(video)/video-prejoin.tsx`) — pre-join camera/mic test. PREVIEW =
  Option A: `<ZoomView>` has a `preview?: boolean` prop, so S14 renders
  `<ZoomView userId="" preview />` for a device-only local preview with no session
  joined. **GOTCHA (fixed on-device):** `userId` MUST be `""` (empty string), NOT
  `null` — native `RNZoomViewManager.setUserId()` does `newUserId.equals(userId)`
  and NPEs on a null userId (crashes the whole dev build with
  `JSApplicationIllegalArgumentException` at `RNZoomViewManager.setUserId`). `""`
  matches the native default and `preview` renders via `startVideoCanvasPreview`
  independent of userId. The TS type says `string | null` but null is a trap
  (memory: zoom-preview-userid-null-crash). **ROTATION:** the preview renders
  sideways because native `refreshRotation()` bails when `!isInSession()`, so S14
  calls `videoHelper.rotateMyVideo(0)` itself ~250ms after the canvas starts (app
  is portrait-locked → `Surface.ROTATION_0`; re-applied after `switchCamera`). If
  preview ever regresses, the fallback is Option B for S14 only (join with
  `videoOptions.localVideoOn` + `audioOptions.mute`, show the joined-session view,
  pass the live session to S15). PERMISSIONS: camera+mic via RN core
  `PermissionsAndroid` (no expo-camera; Android-only — iOS request is a marked
  TODO): check on mount → `requestMultiple` → `NEVER_ASK_AGAIN` routes to a
  recovery state with `Linking.openSettings()`. Never previews/joins without both
  granted. CONTROLS: camera on/off (mount/unmount preview), mic mute (intent only,
  forwarded to S15 as `startMuted`), camera flip via `videoHelper.switchCamera()`.
  ENTRY POINTS pass `eventId` (not joinToken) to `/video-prejoin` — success.tsx
  (S08), booking-detail.tsx (S11, Home forwards `b.eventId`), and Home's
  next-class join button — because `/api/zoom/token` takes `{ eventId }`. On
  "Entrar" calls `api.postZoomToken({eventId})`; errors (401→errorAuth, else
  generic) show on S14, no navigation; success pushes to `/video-room` with the
  token payload + userName (from auth session) + startMuted/startVideoOff intent.
- **GOTCHA (memory: zoom-join-audiooptions-gotcha):** `joinSession()` throws
  "Exception in HostFunction: autoAdjustSpeakerVolume" unless
  `audioOptions.autoAdjustSpeakerVolume` is passed, even though the TS type marks
  it optional. Always include it — every `joinSession()` call (S15 or Option-B).
- S15 PASS A (`app/(video)/video-room.tsx`) — the live video session (video +
  controls + lifecycle + teardown). Joins a FRESH session on mount from the S14
  params (`joinSession` with `audioOptions.autoAdjustSpeakerVolume` always set).
  EVENT-DRIVEN phase machine: connecting → waiting → inClass → error, driven by
  SDK events (onSessionJoin/onUserJoin/onUserLeave/onSessionLeave/onError +
  on{Audio,Video}StatusChanged), NOT assumptions. 1:1 tutoring ⇒ ANY remote user
  IS the tutor, so waiting↔inClass is driven purely by the `remoteUsers` count
  (onUserJoin/Leave carry the full remoteUsers list; verified from
  `RNZoomVideoSdkModule.java`). Tutor leaving → calm 'waiting' (not a crash);
  rejoining → 'inClass'. REMOTE INDICATORS: tutor's camera-off shows an avatar
  placeholder instead of a black frame; a live mic-muted indicator sits in a
  bottom-left tutor chip — both reconciled from
  `getRemoteUsers()[0].videoStatus.isOn()/audioStatus.isMuted()` on the status
  events. Controls (mic/camera/leave) are OPTIMISTIC then RECONCILED from SDK
  truth via `session.getMySelf().audioStatus.isMuted()/videoStatus.isOn()` on the
  status-changed events. First REMOTE `<ZoomView>` render — same interop path as
  S14's local preview. In-session rotation self-corrects (native `refreshRotation`
  runs when `isInSession`), so NO manual `rotateMyVideo` here. TEARDOWN is
  idempotent (leftRef guard + `isInSession()` check) and fires on EVERY exit path:
  Leave button (confirm dialog → `router.replace /review` with eventId), OS back
  gesture / unmount (useEffect cleanup), and unexpected onSessionLeave
  (idle-timeout / tutor ended → also → /review). Android HARDWARE BACK is
  intercepted (BackHandler) to run the SAME confirm→/review flow. NEVER calls
  `zoom.cleanup()` (that kills the root singleton) — teardown =
  `leaveSession(false)` only. App BACKGROUNDING keeps the session ALIVE (a brief
  notification check must not drop the class) but RELEASES THE CAMERA for privacy:
  AppState 'background' → `videoHelper.stopVideo()` (audio stays connected, like a
  call); on 'active' return, `videoHelper.startVideo()` resumes ONLY if the camera
  was on when backgrounded (`cameraOnRef` captured synchronously).
- S15 PASS B (in-session TEXT CHAT) — the app's first and only Supabase Realtime
  integration (ADR-3), layered onto Pass A as a SEPARATE concern (video lifecycle
  untouched). NEW FILES: `lib/chat.ts` (pure, unit-tested — `mergeMessages` dedups
  by id + sorts by index, `parseMessageIndex`; mirrors payment-confirmation's
  pure-core discipline); `lib/use-chat-session.ts` (the Realtime lifecycle hook —
  handshake → merge backlog → `supabase.channel().on('broadcast',{event:'message'}).subscribe()`;
  owns the subscription so the panel open/close is pure UI);
  `components/video/chat-panel.tsx` (the "chat abierto" bottom-sheet UI: own vs
  tutor bubbles, input+send, absolute overlay so the video stays active/visible
  above it). **KEYBOARD GOTCHA (fixed on-device):** SDK 54's Android edge-to-edge
  default does NOT resize/pan the window for the soft keyboard, so a
  KeyboardAvoidingView can't lift an absolute overlay; the raw Keyboard API also
  under-reports the height on some Android OEMs (excludes the gesture-nav region →
  input still clipped). FIX: chat-panel.tsx uses Reanimated's
  `useAnimatedKeyboard` (edge-to-edge-aware, reports the true inset) to animate the
  sheet's bottom padding to `max(keyboard, safe-area-bottom)` — the sheet bg stays
  flush to the screen bottom (extends behind the keyboard) while its content +
  input lift above it; the message FlatList is flex:1 so it shrinks/scrolls and the
  header stays pinned. NB the sheet needs a DEFINITE height (`height:'80%'`, not
  maxHeight) or the flex:1 list resolves to 0 height and the messages vanish.
  SEND = WAIT-FOR-BROADCAST (not optimistic): POST → "sending…" → the bubble
  renders only when its own broadcast echoes back (deduped by id) — one render
  path, no optimistic/real mismatch (the ":index" can't be predicted client-side so
  echo-matching would be fragile). The input clears only on POST success; a failed
  send keeps the text + shows an error (never silently dropped). RECONCILE: backlog
  is re-fetched on every SUBSCRIBED (fires on first subscribe AND on reconnect) and
  re-merged — recovers a broadcast missed in the snapshot→subscribe gap or during a
  socket drop (dedup makes the re-merge safe; same reconcile-on-resubscribe pattern
  as payments). TEARDOWN: the hook's channel is released idempotently
  (`supabase.removeChannel`) both on unmount (its own useEffect cleanup — covers
  every video exit path since they all unmount the room) AND imperatively inside
  the room's existing `teardown()`. BACKGROUNDING: the subscription stays alive
  (matches Pass A); Supabase auto-reconnects and reconcile-on-SUBSCRIBED recovers
  anything missed. Chat is enabled once joined (waiting|inClass); the Pass-A
  placeholder control is wired (opens the sheet; unread badge from `unreadCount`
  while closed).

### Review (S16)

- S16 (`app/review.tsx`) — the post-class review, the LAST screen of the class
  lifecycle. Reached from S15 on leave (`goReview` → `router.replace /review` with
  `{ eventId }`); `eventId` is the ONLY param (app-bar shows the static title + a
  "1 · 2"/"2 · 2" step chip, no date/time subtitle). Gentle progressive form,
  backend owns all logic — 4-phase machine: rating → comment → google → thanks.
  RATING: 1–5 stars; the `kind:"rating"` POST fires ON STAR TAP (not on Continuar)
  so the rating is saved the moment it's picked and the user can leave freely —
  re-tapping a different star re-POSTs (backend upserts, safe). It reads the
  server-decided `showGoogleReview` flag off that response (NEVER computed
  client-side); Continuar (enabled only after a rating save) advances. COMMENT
  (skippable): optional TextInput maxLength 1000 (contract limit; the design
  mock's 280 is superseded), live counter; "Enviar reseña" POSTs `kind:"comment"`
  only when non-empty, "Omitir" skips — both then branch
  `showGoogleReview ? google : thanks`. GOOGLE (only when
  `showGoogleReview===true`, so 1–3★ NEVER see it): accept POSTs `kind:"google"
  action:"accept"` then `Linking.openURL(GOOGLE_REVIEW_URL)`; "Ahora no" (and
  header X) POSTs `action:"decline"` — the google POST is best-effort (a failure
  still proceeds to thanks, never traps the user). THANKS: check hero + star recap
  + "Volver al inicio" → `router.replace /(tabs)/(home)`. Concurrent-submit guard
  via `busyRef`; failed rating/comment POSTs show an inline error
  (`REVIEW_BOOKING_NOT_FOUND` → friendly copy, else generic) and keep the user's
  selection/text for retry — never silently dropped. NO pure-logic module (thin
  phase machine over `api.postReview`). `GOOGLE_REVIEW_URL` is a PLACEHOLDER in
  `constants/config.ts` (see docs/TODO.md).

### Profile + settings + calendar (S17, S18, S19)

- S17 Perfil (`profile.tsx`): Google identity from the auth session (image with
  initials fallback, name, email, "vinculada con Google" badge — read-only, no
  name edit / no account deletion), credit balance via `api.getCredits()` on focus
  (renders `CreditBalanceCard` only when `packSize != null`; depleted-pack edge not
  surfaced here since Perfil doesn't fetch bookings — see Home's `ownedPack`), an
  Ajustes entry, and the REAL home for sign-out (the temp stub graduated here).
- S18 Ajustes (`settings.tsx`): push-notification PREFERENCE (RN core `<Switch>` +
  5/10/15/30/60-min lead-time pills, default 10) persisted LOCAL-ONLY via
  `lib/notification-store.ts` (no backend); calendar access; language ES/EN (reuses
  `setLocale`); sign-out. PERMISSIONS wired for real (expo-notifications +
  expo-calendar are in the dev client): enabling notifications calls
  `Notifications.requestPermissionsAsync()` — granted reveals the lead-time row,
  denied keeps the toggle OFF (never on-without-permission) and shows a recovery
  banner → `Linking.openSettings()`; calendar "Conectar" calls
  `Calendar.requestCalendarPermissionsAsync()` with the same granted/denied paths.
  Live permission status is read on mount so the UI reflects the real OS state.
  NOTIFICATION SCHEDULING IS DEFERRED — S18 only captures the preference; actual
  reminder scheduling (`Notifications.scheduleNotificationAsync` synced to the
  booking lifecycle using `leadTimeMinutes`) is a marked TODO (see docs/TODO.md).
  No app.json/plugin change and no dev-client rebuild were needed (only permission
  requests, no custom notification icon/sound, so the expo-notifications config
  plugin stays unadded).
- S19 (`app/add-to-calendar.tsx`): shared modal sheet reached from S08 ("Añadir al
  calendario") and S11 ("Calendario"). 4-phase state machine:
  checking→requesting→adding→success (or denied/error). Permission flow: reads
  `Calendar.getCalendarPermissionsAsync()` on mount; if undetermined shows a
  request screen and calls `requestCalendarPermissionsAsync()`; if denied shows
  recovery with `Linking.openSettings()`; granted → writes event immediately.
  Calendar event: localized title via `addToCalendar.eventTitle*` keys (e.g.
  "Sesión de 1 hora con Gustavo Torres" / "1-hour session with Gustavo Torres");
  start/end from ISO params; device timezone via Intl; notes + location hold the
  join URL (`${API_BASE}/${locale}/sesion/${joinToken}`). Cross-platform picker:
  iOS uses `Calendar.getDefaultCalendarAsync()`; Android finds the first local
  writable calendar via `Calendar.getCalendarsAsync()`. Entry points pass params
  `{startIso, endIso, sessionType, joinToken}`.

### i18n rollout (clusters 1–4, 2026-07-02)

The i18n machinery/approach is ADR-6; this is the rollout record.

- FOUNDATION: machinery only, not a full translation. `lib/i18n/`:
  `device-locale.ts` (`getDeviceLanguage()` +
  `deriveLocale(lang)`, Spanish→'es' else 'en'), `strings.ts` (keyed ES/EN
  dictionaries — `es` canonical, `en` typed against it so TS enforces matching
  keys; `translate(locale, key)` resolves dotted paths, returns the key itself if
  missing), `locale-store.ts` (secure-store wrapper under `app.locale`),
  `locale-context.tsx` (`LocaleProvider` mounted in `app/_layout.tsx` INSIDE
  AuthProvider, outside StripeProvider; `useLocale()`/`useT()`; `setLocale(l)` (S18)
  switches UI + persists + POSTs `/api/locale`; internal `applyLocale` skips the
  POST when adopting a value the backend already holds).
- Early localized surfaces: the 4 tab labels, the Home empty-state, the whole
  Perfil tab (S17 `profile.*`, S18 `settings.*`), plus S14 (`prejoin.*`), S19
  (`addToCalendar.*`), S15 (`room.*`).
- CLUSTER 1 (money / rule-bearing): S12 cancel (`cancel.*`), S06 (`confirm.*`), S07
  (`confirmCredit.*`), S08 (`success.*`), S09 (`packs.*`), S10 (`packPay.*`).
- CLUSTER 2 (booking flow): S04 (`sessionType.*`), S05 (`schedule.*`, incl.
  `schedule.legend.*` cell-state labels — noFit ES kept as "No válido"), S13
  reschedule blocked-gate (`reschedule.*`), S11 (`bookingDetail.*`). PROMOTED to
  `common.*`: `back`, `book`, `reschedule`, `continue`, `backToDetail`, the
  contact/soon-alert block (`cantAttendTitle/cantAttendBody/notifyGustavo/soonTitle/
  soonBody`), the `common.timeRemaining.*` trio. New shared error:
  `errors.loadFailed` (with a `{what}` noun the screen supplies). S05 & S11 dropped
  hardcoded Spanish month/weekday arrays for Intl via `bcp47(locale)` +
  `toLocaleDateString`.
- CLUSTER 3 (video block): S14/S15/S16 were already fully `t()`-driven; the only
  remaining hardcoded Spanish was 4 `accessibilityLabel` literals in
  video-prejoin.tsx, extracted. PROMOTED to `common.*`: `close` (retired
  `addToCalendar.dismiss`), `camera` + `microphone` (retired
  `room.micLabel`/`room.cameraLabel`). The flip-camera a11y label stays
  single-screen as `prejoin.flipCameraA11y`. Tone-sensitive copy confirmed (S15
  waiting copy calm in EN, S14 permission-denied explains why+how, S16 Google prompt
  a genuine non-pushy invitation, "Gustavo" untranslated throughout).
- CLUSTER 4 (FINAL): S03 Home (`home.*`, incl. CreditBalanceCard `creditCard.*` and
  BookingRow tag labels), S01 login (`login.*`), S17/S18 footer + S19 close-a11y
  stragglers. S02 was already keyed. A sweep also caught that S13 reschedule-CONFIRM
  (`reschedule-confirm.tsx`, the 7-phase state machine) was NEVER localized (Cluster
  2 only did the blocked-gate) — now under `reschedule.confirm.*`. PROMOTED to
  `common.*`: `signInGoogle`, `signingIn`, `comingSoonIos` (shared S01+S02, retired
  `sessionExpired.*` copies), `today`/`tomorrow` (Intl), `version`, and
  `tagCredit`/`tagPaid`/`tagFree`. Home & BookingRow dropped hardcoded weekday
  arrays for Intl. Login value-prop uses user-approved faithful EN phrasing;
  cross-sell rule/number copy (5/10 classes, -15%, 24h) kept faithful. NB the
  runtime EN↔ES toggle walkthrough could not be run here (no emulator in the build
  env) — verified statically via tsc key-parity + grep sweeps + the i18n unit test.
- FULLY BILINGUAL as of Cluster 4 (2026-07-02): a full-app grep sweep confirms NO
  hardcoded user-facing Spanish remains anywhere (every screen imports
  `@/lib/i18n`; no accented/¿¡ literals or Spanish words in JSX text /
  accessibilityLabel / placeholder / Alert.alert). tsc enforces ES/EN key parity.
  Only the native Stripe PaymentSheet still follows the device locale (ADR-6) and
  euro number-formatting stays es-ES.
- KEY-NAMING CONVENTION (established Cluster 1): `screen.section.element`. Strings
  repeated across ≥2 screens live in `common.*`; recurring error/failure copy in
  `errors.*`. `t()` has NO interpolation — put a `{token}` in the value and
  `.replace('{token}', v)` at the call site (mirrors `review.stepOfTwo`); plurals
  get two explicit keys (`…One`/`…Other`, as in
  `confirmCredit.credit.remainingOne/Other`). Sub-components that render strings
  call `useLocale()` themselves rather than threading `t` through props.

### Local notification scheduling (class reminders, 2026-09-01)

The follow-on to the S18 preference-only work: schedule an OS-local reminder
before each upcoming class using the stored `leadTimeMinutes`.

- SPLIT, per the `history.ts`/`payment-confirmation.ts` convention: pure decision
  logic in `lib/class-reminders.ts` (injectable `now`, no React/expo, unit-tested)
  + a thin effectful `lib/notifications-native.ts` (the ONLY caller of
  expo-notifications; untested). `computeDesiredReminders(bookings, prefs, now)`
  → fireAt = start − lead, drop non-strictly-future (also drops started/past
  classes), sort soonest-first, cap at `MAX_SCHEDULED_REMINDERS`=60 (iOS's 64
  pending-notification limit). `reconcileReminders(desired, scheduled)` diffs by
  identity `eventId@fireAtMs` → `{ toCancelIds, toSchedule }` (unchanged = no-op;
  a moved fire time cancels the old + schedules the new).
- NO CENTRAL BOOKINGS STORE (the app re-fetches per screen), so sync is driven by
  a single idempotent `syncClassReminders(bookings?)` fired from three points:
  Home's focus `load()` (passes the already-fetched list — no extra request; and
  since create/cancel/reschedule all return to Home, this one hook covers the whole
  lifecycle + refreshes stale localized copy after a language change), S18
  toggle/lead-time changes (self-fetch), and `_layout` on session-ready (self-fetch;
  covers cold start + elapsed-while-closed; sign-out → `cancelAllReminders`). Keyed
  on `useAuth().session`, NOT `onAuthExchange` (which skips cold-start hydration).
- ROBUSTNESS: an in-flight mutex (Home-focus + session-ready can overlap and the
  list→reconcile→apply sequence isn't atomic); the orchestrator never throws
  (reminders are a convenience); and crucially a bookings-fetch failure BAILS
  WITHOUT CANCELLING, so a network blip can't wipe valid reminders. Identity +
  `fireAtMs` are stashed in `content.data` because the trigger doesn't reliably
  surface the fire date cross-platform; we only ever touch
  `data.kind==='class-reminder'`.
- NATIVE: `Notifications.setNotificationHandler` at module scope in
  `app/_layout.tsx` (SDK-54 fields `shouldShowBanner`/`shouldShowList`/… —
  `shouldShowAlert` is deprecated) so a reminder that fires foregrounded still
  shows. An Android channel (`setNotificationChannelAsync`, importance HIGH) is
  created lazily inside sync — REQUIRED on minSdk 28 or the notification silently
  never displays. Verified: NO new native dep, NO app.json plugin change, NO
  dev-client rebuild — every call is a JS runtime call into the already-linked
  module (`npx expo config --type prebuild` unchanged; `tsc` clean against the
  installed expo-notifications 0.32.17 types).
- COPY: new `notifications.reminder.*` keys (ES/EN) — "countdown + time" body
  ("Empieza en {lead}, a las {time}." / "Starts in {lead}, at {time}."), tokens
  `.replace`d at schedule time (`leadTimeLabel` promoted to `lib/format.ts`, shared
  with the S18 pills; `formatTime` for the time).
- DEFERRED (docs/TODO.md): deep-link on tap — a tapped reminder just opens the app
  to Inicio (chosen to keep the OS payload minimal, no join/cancel secrets, no
  response-listener/cold-start routing); and a custom notification icon/sound
  (needs the config plugin + a rebuild). RUNTIME on-device behaviour could not be
  exercised here (no emulator in the build env) — verified via the 16-case unit
  test, tsc, and the prebuild-config check.

### S12/S13 contact stubs → email fallback (2026-09-02)

Replaced the three "coming soon" `Alert` stubs in the cancel/reschedule lifecycle.

- PRODUCT CALL (maintainer): the 2h cancel/reschedule rule is absolute — inside
  the window it "is simply not allowed, no alternative should be considered." So
  the `blocked` / `err_outside_window` sheets in S12 cancel AND the S13
  `reschedule.tsx` gate LOST their "Avisar a Gustavo" button *and* the green
  "¿No puedes asistir? — avísale a Gustavo" info card. Those sheets now just state
  the rule + "Volver al detalle". No contact affordance where the rule bites.
- The ONLY place a contact path survives is a genuine failure: `err_generic`
  (403/500/network) in S12 cancel and reschedule-confirm — both now show
  **retry + "Escribir a Gustavo"**, the latter opening the device mail composer
  via new `lib/contact.ts` `openGustavoEmail(...)` → `mailto:CONTACT_EMAIL`
  (`contacto@gustavoai.dev`, new `constants/config.ts` const) with a pre-filled
  subject + body (the body carries the class date/time so Gustavo can identify
  the booking). `Linking.openURL(...).catch()` → alert showing the address if no
  mail app handles the intent.
- i18n: retired `common.{cantAttendTitle,cantAttendBody,notifyGustavo,soonBody}`
  and `cancel.errGeneric.{stillFailing,contactLink,contactTitle,contactBody}`.
  Promoted `common.{stillFailing,writeToGustavo}` + added
  `common.{noMailAppTitle,noMailAppBody}` (`{email}` token) and per-flow
  `{cancel.errGeneric,reschedule.confirm}.{emailSubject,emailBody}` (`{date}`
  token). `common.soonTitle` kept — still used by the S13 add-to-calendar stub.
- No native dep, no rebuild (`Linking` is RN core). tsc + eslint + 94 tests green.

### App identity: name + dark-icon fixes + notification small icon (2026-09-02)

Maintainer reported three things on-device: the app-drawer icon and the push
notification's leading (circular) icon both **blend into dark** backgrounds, and
the launcher label reads `personal-mobile-booking-app` (truncated). Root-caused to
**two** things, not three: the adaptive-icon background was `#131315` (== the page
bg) — invisible on a black home screen AND in the dark notification shade (that
leading circle is the launcher icon) — and `expo.name` drove the label. The
status-bar SMALL icon was already fine (Android auto-silhouettes to white).

Decisions + changes (batched into ONE pending dev-client rebuild — all three are
prebuild-baked native resources, none are OTA/JS):
- **Name.** `expo.name` → `"Gustavo Prof"` (launcher label + notification header +
  iOS display name). `slug`/`extra.eas.projectId` untouched, so EAS linkage is
  unaffected. NOTE: this is distinct from the Play Store *listing* title (Play
  Console, ≤30 chars, no build) — that is set there, not in the repo.
- **Adaptive icon background.** `#131315` → `#2a2a2c` (`--surface-high`). Maintainer
  picked "elevated dark" to stay nocturne; the example value floated (`#201f22`)
  was only ~13 levels above `#131315` and would still blend, so we used
  `--surface-high` for a real tonal edge. Dropped the redundant solid-color
  `backgroundImage` (`android-icon-background.png`, now UNUSED) — `backgroundColor`
  is the single source of truth. Regenerated `icon.png` (iOS/base, opaque) by
  compositing the existing green-G foreground over `#2a2a2c`.
- **Notification small icon.** Activated the `expo-notifications` config plugin
  (`icon` + `color` `#4edea3`). expo-notifications 0.32.17 was ALREADY a linked
  dependency (JS scheduling shipped earlier), so this adds NO new native module —
  only a generated drawable + manifest meta-data, which is why it still needs a
  rebuild. `notification-icon.png` = the foreground G's alpha painted white, cropped
  to the glyph + ~12% margin (fills ~76%, vs the safe-zone foreground's ~51%) so it
  reads at status-bar size; Android uses the alpha channel only, `color` tints the
  in-shade small icon + badge.
- Verified: `npx expo config --type prebuild` clean (name/adaptiveIcon/plugin all
  resolve, exit 0). On-device appearance can only be confirmed after the rebuild.

### Production release configuration — OTA, env split, EAS profiles (2026-09-03)

First move toward a Play Store release. The app had a working EAS link
(`projectId` + a three-profile `eas.json`) but nothing production-shaped: the
`production` profile carried only `autoIncrement`, and `constants/config.ts`
hardcoded **staging** values — `API_BASE = https://staging.gustavoai.dev` and,
less obviously, a Stripe **test** publishable key (`pk_test_…`). A production
build off that config would have pointed real users at staging and shown them a
payment sheet that charges nothing.

Decisions:
- **expo-updates added BEFORE the first build, deliberately.** OTA needs a native
  module in the shipped binary; adding it after the first release would have cost
  a second build + Play review just to unlock it. Since no production build
  existed yet, it was free. `runtimeVersion` policy is **`fingerprint`**, not the
  `appVersion` default `eas update:configure` writes — `appVersion` keys
  compatibility to the hand-maintained `expo.version` string, so forgetting to
  bump it after a native change would let an incompatible JS bundle reach an old
  binary. `fingerprint` derives the key from the actual native module set, which
  is the guarantee we want.
- **Env split via `EXPO_PUBLIC_*` + EAS environment variables**, not an
  `app.config.js` variant switch. All four values (API base, Stripe *publishable*
  key, Supabase URL + *anon* key) are public client-side values, so none needs
  secret handling; storing them as EAS env vars keeps `eas build` and `eas update`
  reading the same source, which a build-profile-only `env` block would not
  (`eas update` bundles JS on the CLI's own environment).
- **Release builds throw on a missing var; only dev falls back to staging.** A
  silent staging fallback in a production binary is the exact failure this work
  exists to prevent, and the `staging` build catches a misconfiguration before any
  user sees it. The `update:*` npm scripts hardcode `--environment` for the same
  reason — an OTA published without it would ship a bundle with no vars at all.

Gotcha found: `eas update:configure` rewrote `android.permissions` with the
**resolved** config (plugin-injected `READ_CALENDAR`/`WRITE_CALENDAR` included)
and appended it twice, duplicating all five entries. Restored the hand-maintained
three-entry list; `npx expo config --type prebuild --json` re-verified the
resolved output (5 unique permissions, `runtimeVersion: fingerprint`,
`versionCode: undefined` per `appVersionSource: remote`). `npm test` 94/94,
`tsc --noEmit` clean.

Still open at the end of this entry: EAS env vars not yet created (need the live
Stripe key + the separate production Supabase project's values), no Play Console
app yet, and the production SHA-1s not yet registered on the Google OAuth Android
client.

### Account deletion (S21) — gated in-app erase (2026-09-03)

Implemented ACCOUNT-DELETE-01 end to end: `GET /api/account` (advisory verdict) +
`DELETE /api/account` (`{ confirmEmail }`, irreversible), both on a **shared
10/hour-per-account** budget. Placement reasoning and the refresh-disarm rule are
ADR-9; the contract is now transcribed into `docs/api/api-contract.md` under a new
**Account** section.

Shape of the work:
- `lib/account-deletion.ts` (pure, tested — 17 cases): `gateFor()` maps a verdict
  to one of three screens keying off `reason`; `confirmEmailMatches()` mirrors the
  server's trimmed/case-insensitive comparison; `classifyDeleteFailure()` folds the
  status/code matrix into five outcomes, of which `404 USER_NOT_FOUND` is a
  **success** (the account is already gone — that is what was asked for).
- `api.getAccount()` / `api.deleteAccount()`. The wrapper already serializes a body
  for every non-`GET` method, so the `DELETE`-with-a-body trap the contract warns
  about doesn't apply here; nothing else changed in the request path.
- `useAuth().completeAccountDeletion()` runs the teardown in the mandated order and
  ends by nulling the session, which flips the existing `<Stack.Protected>` guard —
  no manual navigator reset. The "deleted" confirmation is an `Alert`, deliberately:
  it is imperative and survives this screen unmounting under the guard flip, where
  an in-screen success state could not (and nothing can pass params through a
  guard-driven redirect to `/login`).
- S18 gained a **Cuenta** section (last row on the screen); S21 renders four states
  plus in-flight, all bilingual (`deleteAccount.*`, copy aligned with the web app's
  strings from §8 of the contract). The typed-email field grows a Reanimated
  keyboard spacer — SDK 54's edge-to-edge Android default doesn't pan (same rule as
  the chat sheet).

No native dependency, so this ships **OTA**. `npm test` 108/108, `tsc --noEmit`
clean, `expo lint` clean for the new files. Not yet exercised against a live
server: the curl sequence in §9 of the contract (and the on-device checks it calls
out — body survival, a 409 arriving on submit, and backgrounding after a delete
landing on the signed-out root) is still to run against staging.

### First OTA publish — two failures worth keeping (2026-09-04)

Published the first EAS Update to the `staging` channel (a card-only checkout
change: `link.display = NEVER` on both PaymentSheet call sites). It failed twice
before landing, and both failures are more instructive than the change itself.

**1. `eas update` defaults to `--platform=all`.** The export died bundling for
web: `@stripe/stripe-react-native`'s `NativeCardField` spec imports
`react-native/Libraries/Utilities/codegenNativeCommands`, which web cannot
resolve. `app.json` declares `web.output: static`, so web is a real platform as
far as the CLI is concerned. The app only ships Android — both `update:*` scripts
now pin `--platform android`. Note this would have hit `update:production`
identically on the first production OTA.

**2. Fixing (1) severed OTA compatibility with the installed APK.** The fix edited
two npm *scripts*. That moved the fingerprint from `5b1bd763…` to `f76a79df…`, so
the published update was never served to the build already on the phone. Proven
by swapping `package.json` back to its build-time content and recomputing:
the old file reproduces `5b1bd763…` **exactly**, matching what EAS recorded for
build `08694b3c`.

The rule this establishes is in CLAUDE.md: the fingerprint covers the whole root
`package.json` including `scripts`, plus `app.json`/`eas.json`/config plugins. The
"JS ships OTA" mental model is too loose — only `app/`, `lib/`, `components/` are
genuinely outside it. Resolved by rebuilding staging (`d6d7fa42`, commit
`6d80d8f`), whose runtimeVersion now matches the published update.

Also observed: something in the local environment amends every commit immediately
after creation (reflog shows `commit` followed by `commit (amend)`, identical tree
and message). A commit pushed inside the same shell call goes out pre-amend, so
local and origin diverge with duplicate content. `git pull --rebase` drops the
duplicate by patch-id; no force-push needed.

Scope note: the wallet list (Klarna, Amazon Pay, Bancontact, EPS) is NOT
client-controllable. `initPaymentSheet` accepts `paymentMethodTypes` only on the
deferred `intentConfiguration` flow, which the union type makes mutually exclusive
with `paymentIntentClientSecret` — the flow this app uses. Those methods come from
`/api/stripe/checkout` and must be removed in the Stripe Dashboard or server-side.
