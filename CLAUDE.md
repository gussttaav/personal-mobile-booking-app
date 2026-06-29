## Project: gustavoai mobile

A React Native (Expo) mobile app for students of an existing online
tutoring web service. It consumes the existing Next.js API over HTTP —
it does NOT have its own backend.

### Tech
- Expo SDK 54, Expo Router (file-based), TypeScript strict
- npm (NOT pnpm/yarn) — keep package-lock.json authoritative
- Tests: `npm test` (jest + jest-expo preset, pinned to ~54 to match the SDK).
  Dev-only devDependencies — NOT a native module, no dev-client rebuild needed.
  Specs live in `lib/__tests__/`.
- Now running on a CUSTOM DEV BUILD (expo-dev-client), NOT Expo Go. Any NEW native module
  requires rebuilding the dev client before it will load — adding it to package.json is not
  enough; the running binary won't have it and rendering its views crashes with
  IllegalViewOperationException. Batch native deps and flag the rebuild cost before adding.
- Native deps added & configured in app.json, and COMPILED INTO the current dev client:
  expo-linear-gradient (no plugin/config; in use for the Home ambient top glow),
  @stripe/stripe-react-native (plugin: enableGooglePay true; merchantIdentifier is a
  PLACEHOLDER — replace with the real Apple merchant id for iOS), expo-secure-store
  (plugin: configureAndroidBackup), expo-calendar (plugin: calendarPermission; auto-adds
  READ/WRITE_CALENDAR), expo-notifications (no plugin yet — add it when a custom notification
  icon/sound exists; POST_NOTIFICATIONS is declared in android.permissions).
  Stripe integration IS written: StripeProvider in app/_layout.tsx (card-only, Google Pay
  off for now); PaymentSheet wired in app/(tabs)/(booking)/confirm.tsx (S06 Pass A).
  S06 Pass B confirms the booking by AUTHORITATIVE POLLING of
  /api/payment-confirmation/channel (status is total) — NO Supabase/Realtime client
  was added (the web's useSSECredits Realtime path is intentionally not mirrored on
  mobile). See lib/payment-confirmation.ts. On 'confirmed' it navigates to S08
  (app/(tabs)/(booking)/success.tsx, built — renders booking summary + join card
  from the params it receives); slot_taken/failed/timeout resolve to
  on-screen terminal states. types/api.ts GetPaymentConfirmationChannelResponse is now
  a union discriminated on checkoutType (pack | single).
  CREDIT booking path (S07, app/(tabs)/(booking)/confirm-credit.tsx) IS built and is
  SEPARATE from the Stripe flow: it is SYNCHRONOUS — POST /api/book with
  sessionType:'pack' returns the completed booking in one call (no Stripe, no poll,
  no Realtime). Entered from Home's "Reservar con crédito" → grid in mode:'credit'
  (always 1h, session-type skipped) → S07. S07 fetches getCredits for the balance,
  guards against double-submit (submittingRef), and routes outcomes by ApiError.code
  (NOT status — the contract documents INSUFFICIENT_CREDITS as 400, robust either way):
  success→S08 (sessionType:'pack' renders as 1h), INSUFFICIENT_CREDITS→sin-créditos
  cross-sell (Ver packs / Pagar esta clase reusing the slot in S06), SLOT_UNAVAILABLE→
  back to grid, 429/400/500/network→inline retry banner. Device tz comes from
  getDeviceTimeZone() in lib/grid-time.ts. On success S07 passes remainingCredits to
  S08; when it hits 0 on a pack booking, S08 shows a "Has usado tu último crédito"
  repurchase nudge (→ Packs).
  DEPLETED-PACK SIGNAL: GET /api/credits NULLS packSize once a pack is fully consumed
  (despite the contract wording), so "owns/owned a pack" must NOT be derived from
  credits.packSize alone. Home computes ownedPack = credits.packSize != null OR any
  booking has sessionType:'pack' (Booking.packSize/sessionType) and gates the depleted
  CreditBalanceCard nudge on that — otherwise the 0-credit repurchase card vanishes.
  PACKS TAB (S09 app/(tabs)/(packs)/packs.tsx + S10 .../pay.tsx) IS built. S09 is the
  catalog: loads getPricing (required) + getCredits (best-effort) in parallel; renders
  the two packs (pack10 featured "Recomendado", pack5) with price/per-class/savings ALL
  from pricing.packs (never hardcoded); "con pack activo" shows a glowing balance card,
  "sin pack" shows value-props + convert. EXPIRY is omitted — GetCreditsResponse has no
  expiry field yet (TODO in BalanceCard). "Comprar" → S10 with packSize (5|10). S10
  REUSES the S06 Stripe path but SIMPLER (no slot → no slot_taken): POST /api/stripe/
  checkout {type:'pack',packSize} → initPaymentSheet/presentPaymentSheet (card), then
  holds at "Confirmando pago…" (PRODUCT RULE: never show credits before they exist).
  Confirmation is POLL-ONLY via pollPackConfirmation() (NOT a Realtime subscription —
  same authoritative-poll choice as S06): resolves on the pack branch's confirmed===true,
  fails LOUD (kind:'error'→limbo) if the channel returns the single-session shape, 30s
  timeout→limbo (manual recheck). On confirmed→in-screen success state showing the NEW
  balance (credits) + "Reservar ahora" (→Home) / "Volver a Packs". Declined/other Stripe
  error→rejected (Reintentar); sheet cancel→silent back to summary. Double-submit guarded
  by submittingRef + state. No S08 reuse — S10 has its own success layout.
  S11 (app/(tabs)/(home)/booking-detail.tsx) IS built: renders hero card (date/time
  prominent, pulsing "Empieza en N min" chip when imminent/active), details card
  (Fecha, Horario, Pago rows), cancel-policy banner, and a sticky action bar with
  JOIN (primary+glowing when imminent/active, idle otherwise) + secondary row
  (Calendario stub→Alert TODO(S19), Reprogramar→S13, Cancelar→S12 danger style).
  Data comes from params passed by Home (token, joinToken, sessionType, startsAt,
  endsAt, packSize) — no API fetch in S11. Home's two router.push calls to S11 now
  pass the full Booking object fields. S11 routes to S13 with { token, startsAt,
  sessionType }. The S08→S11 path (goDetail) is NOT yet wired — S08 passes eventId
  not token; deferred to a future build.
  S13 (app/(tabs)/(home)/reschedule.tsx + reschedule-confirm.tsx) IS built: 3-file
  architecture. reschedule.tsx is the 2h gatekeeper — synchronous check on mount,
  shows blocked bottom-sheet if < 2h before original start, otherwise router.replace
  → S05 with mode:'reschedule' (rescheduleToken, lockedSessionType, origStartsAt).
  S05 in reschedule mode locks duration to the original sessionType, hides the duration
  toggle, shows a "Moviendo desde" banner, and on "Confirmar cambio" → reschedule-
  confirm.tsx. reschedule-confirm.tsx: 7-phase state machine (confirm/submitting/
  success/slot_taken/err_invalid_token/err_outside_window/err_generic). Confirm sheet:
  before→after card + 2h reassurance + consequence note. POSTs api.postBook({...,
  rescheduleToken}) — payment-free (server bypasses REQUIRES_PAYMENT). Double-submit
  guarded by submittingRef. Success: full-screen "Clase reprogramada" with before→after
  comparison. SLOT_UNAVAILABLE→slot_taken (back to grid); INVALID_RESCHEDULE_TOKEN /
  SESSION_TYPE_MISMATCH / RESCHEDULE_TOKEN_CONSUMED→err_invalid_token (→Home);
  OUTSIDE_RESCHEDULE_WINDOW→err_outside_window (→Home); 500/network→err_generic
  (Reintentar resets to confirm). S05 mode:'reschedule' is a third mode alongside
  'pay' and 'credit'; EmptyState shows "Mantener la hora actual" (router.back) instead
  of "Probar con 1 hora" in reschedule mode.
  S12 (app/(tabs)/(home)/cancel.tsx) IS built: destructive-action confirmation with
  7-phase state machine (confirm/blocked/submitting/success/err_generic/
  err_invalid_token/err_outside_window). Bottom-sheet layout for confirm/blocked/
  error states; full-screen for success. Calls api.postCancel({token}) — no auth
  bearer needed, Origin header already sent by api-client. 2h window check is
  synchronous (initialises phase state on mount, no useEffect). isPack drives copy
  fork (credit vs paid), but PostCancelResponse.creditsRestored is the authoritative
  signal for the success variant. Success→router.replace('/(tabs)/(home)') triggers
  Home's useFocusEffect refetch, removing the cancelled booking. All error codes
  (INVALID_CANCEL_TOKEN, CANCEL_TOKEN_CONSUMED, OUTSIDE_CANCEL_WINDOW) have
  dedicated phases. 403/500/network → err_generic (retryable). "Avisar a Gustavo"
  and "Escribir a Gustavo" are Alert stubs (TODO: wire to contact flow).
  secure-store/notifications/calendar integration code is NOT written yet — only
  app.json/build config is in place. Validate app.json plugin changes with
  `npx expo config --type prebuild` (the VSCode Expo extension's plugin linter throws false
  "invalid config plugin" warnings — ignore those).
- Colored glows/shadows: use the RN `boxShadow` style prop (works on Android via SDK 54's
  New Arch), NOT `shadowColor`/`shadowRadius` (iOS-only — silently ignored on Android).
  Apply `boxShadow` only to views that have a background; on a transparent view Android
  renders it as a dark silhouette (no extra native module needed — this is the safe way to
  glow without a dev-client rebuild).

### Design source of truth
- Design system (authoritative brand tokens, as code): docs/design/design-system/
  - colors_and_type.css holds exact color + typography values
  - _ds_manifest.json enumerates components and specs
  - These drive constants/theme.ts — transcribe values from here, not from screenshots
- Screen specifications: docs/design/screens/ (one .dc.html per screen)
  - These are WEB html/css — translate design intent into React Native idioms,
    do not port markup one-to-one
- App structure reference: docs/design/screens/Inventario de Pantallas.dc.html
  and Navegacion y Home.dc.html define the full screen list and navigation model
- Visual verification: docs/design/screenshots/ — compare built screens against these
- Written brief and brand description: docs/design/design-brief.md, docs/design/brand.md
- Data model: docs/design/data-model.md
- API contract (the existing Next.js backend): docs/api/api-contract.md

### Navigation structure
```
app/
├── _layout.tsx            — root Stack; registers (tabs) + full-screen experiences
├── login.tsx              — S01 Bienvenida / Iniciar sesión
├── session-expired.tsx    — S02 Sesión expirada · Re-login   (tab bar hidden)
├── video-prejoin.tsx      — S14 Pre-unión                    (tab bar hidden)
├── video-room.tsx         — S15 Sala · en clase              (tab bar hidden)
├── review.tsx             — S16 Valoración post-clase        (tab bar hidden)
├── add-to-calendar.tsx    — S19 Añadir al calendario         (modal)
└── (tabs)/
    ├── _layout.tsx        — 4-tab Tabs navigator (MaterialCommunityIcons, outline/filled by focus)
    ├── (home)/            — Tab: Inicio (home-outline / home)
    │   ├── index.tsx      — S03 Inicio   ← the ONLY route at "/" (see note below)
    │   ├── booking-detail.tsx — S11 Detalle de la reserva
    │   ├── cancel.tsx         — S12 Cancelar reserva
    │   ├── reschedule.tsx     — S13 Reprogramar reserva · 2h gate (blocked state or
    │   │                        router.replace → S05 mode:'reschedule')
    │   └── reschedule-confirm.tsx — S13 confirm sheet + terminal states (slot_taken,
    │                        success, err_invalid_token, err_outside_window, err_generic)
    ├── (booking)/         — Tab: Reservar (calendar-outline / calendar)
    │   ├── session-type.tsx   — S04 Tipo de sesión  (stack initial route → /(tabs)/(booking)/session-type)
    │   ├── schedule.tsx   — S05 Cuadrícula semanal (mode param: 'pay' → S06; 'credit'
    │   │                     → S07 always 1h, toggle hidden; 'reschedule' → reschedule-
    │   │                     confirm.tsx — locked sessionType, "Confirmar cambio" CTA,
    │   │                     "Moviendo desde" banner, no duration toggle, rescheduleToken
    │   │                     forwarded. Refetches availability on REGAINED focus via
    │   │                     useFocusEffect — skips first focus — so booked slots show taken)
    │   ├── confirm.tsx    — S06 Confirmar y pagar (Stripe, async)
    │   ├── confirm-credit.tsx — S07 Confirmar con crédito (synchronous POST /api/book, no Stripe)
    │   └── success.tsx    — S08 Reserva confirmada
    ├── (packs)/           — Tab: Packs (gift-outline / gift)
    │   ├── packs.tsx      — S09 Packs  (stack initial route → /(tabs)/(packs)/packs)
    │   └── pay.tsx        — S10 Pago del pack
    └── (profile)/         — Tab: Perfil (account-outline / account)
        ├── profile.tsx    — S17 Perfil  (stack initial route → /(tabs)/(profile)/profile)
        └── settings.tsx   — S18 Ajustes
```
Screens outside `(tabs)` automatically hide the tab bar (Expo Router behaviour).
Each tab group has its own `_layout.tsx` wrapping a `<Stack>` with
`unstable_settings.initialRouteName` set to its landing screen.

Default tab / "/" resolution: only `(home)/index.tsx` lives at `/`. The other three
tab landing screens are named files (session-type/packs/profile), NOT `index.tsx`, so
exactly one route owns `/`. This is deliberate — when multiple tab groups each had an
`index.tsx` they all mapped to `/`, and expo-router resolved a cold start to the
alphabetically-first group `(booking)` instead of Inicio. `unstable_settings.initialRouteName`
in `(tabs)/_layout.tsx` alone did NOT fix it. Keep new tabs' landing screens as named
routes (not `index.tsx`) so the app reliably opens on Inicio.

### Key files
- `constants/config.ts` — `API_BASE` URL (production: https://www.gustavoai.dev)
- `lib/auth.ts` — auth module: `signInWithGoogle`, `exchangeGoogleToken`, `refreshSession`
  (single-flight silent refresh — see Auth status), `signOutGoogle`,
  `hydrateSession` (load persisted → in-memory at launch), `AuthSession`/`AuthUser` types,
  `AuthError` class, `getStoredSession`/`setStoredSession` (synchronous in-memory cache)
- `lib/token-store.ts` — expo-secure-store wrapper: `loadPersistedSession`/`persistSession`/
  `clearPersistedSession` (whole session as one JSON blob under `auth.session`)
- `lib/auth-context.tsx` — `AuthProvider`/`useAuth`: reactive `session`+`isReady` that drive
  the `<Stack.Protected>` guards and expose `signIn`/`signOut`
- `types/api.ts` — TypeScript interfaces for all API request/response shapes and domain error codes
- `lib/api-client.ts` — typed fetch wrapper; use `api.*` methods from here, never call `fetch` directly
  - reads the bearer synchronously via `getStoredSession()` — no change needed for secure storage
  - `registerRefreshHook(fn)` — wired by lib/auth-context.tsx at init; `fn` returns
    `Promise<boolean>` (true = refreshed, retry; false = gave up, session cleared)
  - `ApiError` class — `{ status, code, requiresAuth? }`
- `app/_layout.tsx` — `GoogleSignin.configure({ webClientId })` + `SplashScreen.preventAutoHideAsync()`
  run here at app init; wraps the app in `AuthProvider` and gates routes with `<Stack.Protected>`
- `lib/grid-time.ts` — pure tz/grid math for S05 (booking grid): converts the schedule-tz
  `weeklyHours` frame into device-tz hour rows (DST-correct via `Intl.DateTimeFormat`),
  and `buildGridModel()` composes schedule frame + live availability into the four cell
  states. Unit-tested in `lib/__tests__/grid-time.test.ts`
- `lib/payment-confirmation.ts` — pure confirmation pollers (no React/timers baked in):
  `pollPaymentConfirmation()` (S06 single) polls /api/payment-confirmation/channel until a
  terminal status (confirmed/slot_taken/failed) or a 30s ceiling (timeout);
  `pollPackConfirmation()` (S10 pack) polls the SAME endpoint's pack branch until
  confirmed===true (returns credits/packSize/name) or 30s timeout — no slot_taken, and
  fails LOUD (kind:'error') if the channel returns the single-session shape for a flow we
  initiated as a pack. Both swallow transient errors; `now`/`sleep` injectable; resolve
  exactly once. Unit-tested in `lib/__tests__/payment-confirmation.test.ts`

### Conventions
- Build screens one at a time against stubbed data first; wire real API later
- Native dependencies (Google Sign-In, Stripe, Zoom) are deferred and batched
- Do not add a native dependency without flagging the build-budget cost first
- Auth module lives in `lib/auth.ts`; screens import from there, never call
  `GoogleSignin` or the auth endpoint directly
- All backend calls go through `api` from `lib/api-client.ts`; screens never call `fetch` directly

### Auth status
- Google Sign-In handshake verified end-to-end on physical Android (dev build)
- Bearer token exchange working against staging backend
- Secure token storage DONE: the full session is persisted to expo-secure-store via
  `lib/token-store.ts`. lib/auth.ts keeps an in-memory cache (`getStoredSession`,
  synchronous — what api-client reads) that's write-through on exchange/sign-out and
  rehydrated at launch by `hydrateSession()`
- Launch routing DONE: `lib/auth-context.tsx` (`AuthProvider`/`useAuth`) hydrates on
  mount and holds `session`+`isReady`; `app/_layout.tsx` keeps the native splash up
  until `isReady`, then gates routes with `<Stack.Protected guard>` (signed-in group
  vs `login`). No login flash on cold start. Launch is presence-check only — an
  expired token 401s on first API call (handled by the silent-refresh task)
- S01 sign-in screen built at `app/login.tsx`; sign-out wired temporarily in
  `app/(tabs)/(profile)/profile.tsx` (moves into S17 Perfil later)
- Silent refresh on 401 DONE (A3): `refreshSession()` in lib/auth.ts re-fetches a
  Google idToken via `GoogleSignin.signInSilently()` (the cached-credentials path,
  NO picker) and re-exchanges it. SINGLE-FLIGHT: a module-level `_refreshInFlight`
  promise collapses concurrent 401s into exactly one refresh; all waiters retry
  with the one new token. api-client retries at most once (the `isRetry` flag).
  The hook is wired in lib/auth-context.tsx: on refresh success it mirrors the new
  session into React state; on failure (no cached credential / network / backend
  reject) it signs out + `setSession(null)`, which flips the guard → routes to
  `/login`. Tested in `lib/__tests__/auth-refresh.test.ts` (single-flight, retry
  discipline, no-refresh-on-non-401, no-loop-on-failure).
  ANDROID LIMITATION: `signInSilently()` only works while Google still holds a
  cached credential for this install; if it returns `noSavedCredentialFound` there
  is no silent path → fallback is sign-out → interactive `/login`.
- Pending: S02 session-expired re-login screen — currently refresh-failure routes
  to `/login`; the hook point (the catch in lib/auth-context.tsx) is where S02
  would route instead. Reactive only — no proactive pre-expiry refresh.

### Internationalization (i18n)
- ES/EN FOUNDATION is built — machinery only, NOT a full translation. Pure JS,
  NO native dep / NO rebuild: device language via the `Intl` API (mirrors
  getDeviceTimeZone), persistence via the already-compiled expo-secure-store
  (NOT AsyncStorage/expo-localization). Module lives in `lib/i18n/`:
  - `device-locale.ts` — `getDeviceLanguage()` (Intl.DateTimeFormat().resolved
    Options().locale) + `deriveLocale(lang)` (Spanish→'es', else 'en').
  - `strings.ts` — keyed ES/EN dictionaries (`es` canonical, `en` typed against
    it so TS enforces matching keys); `translate(locale, key)` resolves dotted
    paths ('home.empty.title'), returns the key itself if missing. Add keys here
    as screens are localized.
  - `locale-store.ts` — secure-store wrapper under `app.locale`.
  - `locale-context.tsx` — `LocaleProvider` (mounted in app/_layout.tsx INSIDE
    AuthProvider, outside StripeProvider) + `useLocale()` ({locale, setLocale, t})
    + `useT()`. `setLocale(l)` (S18) switches UI + persists to device + POSTs
    /api/locale (api.postLocale already existed). Internal `applyLocale` skips
    the POST (used when adopting a value the backend already holds).
- INITIALIZATION POLICY (strict ordering): the reconcile runs ONLY on a fresh
  token exchange — interactive sign-in OR silent refresh — via `onAuthExchange`
  in lib/auth.ts (a listener set notified at the end of exchangeGoogleToken;
  hydrateSession deliberately does NOT fire it, so persisted launches keep the
  device-stored choice and never re-derive from device language). On exchange:
  `user.locale != null` → adopt it (backend/stored preference ALWAYS wins, even
  over device language, no POST); `null` (new user, mobile auth never seeds) →
  derive from device, apply, and POST /api/locale once to SEED the DB (emails
  default 'es' until seeded — fire early). `AuthUser.locale` (Locale | null) is
  now captured from /api/auth/mobile and persisted in the session blob.
- PROOF STRINGS wired so far (everything else is still hardcoded Spanish):
  the 4 tab labels (app/(tabs)/_layout.tsx) and the Home empty-state title +
  subtitle (app/(tabs)/(home)/index.tsx EmptyState). S18 (settings.tsx) has a
  minimal ES/EN segmented toggle that exercises setLocale end-to-end, reachable
  via an "Ajustes" row in S17 Perfil (profile.tsx → router.push settings); S18
  shows its own header (the (profile) stack is headerShown:false) for the back
  button.
- Translate remaining screens incrementally via `useT()`/`t()` — add the keys to
  lib/i18n/strings.ts (both languages, enforced by the type) as you go.

### Out of scope for now
- Zoom video integration (last phase)

## Maintaining this file

This file is read at the start of every session — keep it accurate or it
misleads. When a change affects anything below, update this file IN THE SAME
commit as the change:
- Directory structure or where key files live
- A new convention, or a change to an existing one
- A dependency added/removed (especially native deps — note the build cost)
- A deferred decision becoming active (e.g. auth approach finalized)
- A new script, env var, or setup step

When you finish a task, before reporting done, check whether any of the above
changed. If so, update this file as part of the same change and mention it in
your summary. If nothing changed, say "CLAUDE.md: no update needed" so I know
it was considered, not forgotten.