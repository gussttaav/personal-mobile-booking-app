## Project: gustavoai mobile

A React Native (Expo) mobile app for students of an existing online tutoring web
service. It consumes the existing Next.js API over HTTP — it does NOT have its
own backend.

> This file is the **lean current-state reference** — the rules a maintainer
> needs today. Build history, dated verification records, and the reasoning
> behind architecture decisions live in [docs/DEVLOG.md](docs/DEVLOG.md).
> Deferred work lives in [docs/TODO.md](docs/TODO.md). See "Maintaining this
> file" at the bottom.

### Tech + live rules
- Expo SDK 54, Expo Router (file-based), TypeScript strict.
- **npm only** (NOT pnpm/yarn) — keep `package-lock.json` authoritative.
- Tests: `npm test` (jest + jest-expo, pinned ~54 to match the SDK; dev-only, no
  native module, no rebuild). Specs live in `lib/__tests__/`.
- **Running on a custom dev build (expo-dev-client), NOT Expo Go.** LIVE
  CONSTRAINT: any NEW native module requires rebuilding the dev client before it
  will load — adding it to `package.json` is not enough; the running binary won't
  have it and rendering its views crashes with `IllegalViewOperationException`.
  Batch native deps and flag the rebuild cost before adding.
- **Native deps compiled into the current dev client:**
  - expo-linear-gradient (Home ambient top glow; no plugin)
  - @stripe/stripe-react-native (plugin: `enableGooglePay` true; card-only in the
    app for now; iOS `merchantIdentifier` is a PLACEHOLDER — see docs/TODO.md)
  - expo-secure-store (plugin: `configureAndroidBackup`)
  - expo-calendar (plugin: `calendarPermission`; auto-adds READ/WRITE_CALENDAR)
  - expo-notifications (local class-reminder scheduling is LIVE via JS only — no
    config plugin, no rebuild; `POST_NOTIFICATIONS` declared in
    `android.permissions`. Add the config plugin only for a custom icon/sound —
    that needs a dev-client rebuild. See `lib/notifications-native.ts`.)
  - @zoom/react-native-videosdk **pinned EXACT 2.5.10** — legacy-arch SDK running
    through RN's New-Arch interop shim; ships no config plugin (autolinking
    handles it); requires **minSdkVersion 28** (via `expo-build-properties`,
    dropping Android 7.0–8.1). Camera/mic perms added (iOS `NSCamera/NSMicrophone
    UsageDescription`; Android `CAMERA` + `RECORD_AUDIO`).
  - @supabase/supabase-js **pinned EXACT 2.110.0** — JS-only (no native impact),
    scoped to in-session chat Realtime only (see scope fence in Conventions)
  - Reanimated 4 (the app is New Arch for it)
- Validate `app.json` plugin changes with `npx expo config --type prebuild`
  (ignore the VSCode Expo extension's false "invalid config plugin" warnings).

### Durable gotchas (rules)
- **Zoom `joinSession()` requires `audioOptions.autoAdjustSpeakerVolume`** — it
  throws `"autoAdjustSpeakerVolume"` otherwise, despite being typed optional.
  Always set it, on every `joinSession()` call. (memory: zoom-join-audiooptions-gotcha)
- **`<ZoomView userId>` must be `""` (empty string), NOT `null`** — native
  `setUserId` NPEs and crashes the build on null. The TS type says `string |
  null`; null is a trap. (memory: zoom-preview-userid-null-crash)
- **`ZoomVideoSdkProvider` is an app-session singleton mounted once at the root**
  (`app/_layout.tsx`). Never scope it to the `(video)` group — re-init on group
  remount NPE-crashes. (memory: zoom-provider-singleton-root)
- **Zoom pre-join preview renders sideways** (native `refreshRotation` bails when
  `!isInSession`) → S14 calls `videoHelper.rotateMyVideo(0)` itself. In-session
  (S15) self-corrects; no manual rotation there.
- **Colored glows/shadows: use the RN `boxShadow` style prop** (works on Android
  via New Arch), NOT `shadowColor`/`shadowRadius` (iOS-only, silently ignored on
  Android). Apply only to views WITH a background — on a transparent view Android
  renders it as a dark silhouette.
- **Booking history (`/api/my-bookings/history`) has two traps:** `completed`/
  `no_show` are settled by a **daily cron**, so a class that ended hours ago can
  still read `confirmed` — treat `confirmed && endsAt < now` as completed
  (`effectiveStatus()` in `lib/history.ts`), never as an unknown state. And
  `eventId` **may be `""`** — gate the review CTA on a non-empty value, since
  `POST /api/reviews` keys off it.
- **Chat keyboard on Android:** SDK 54's edge-to-edge default doesn't pan for the
  soft keyboard; use Reanimated `useAnimatedKeyboard` (not KeyboardAvoidingView /
  the raw Keyboard API) to lift the chat sheet. The sheet needs a definite
  `height` (not `maxHeight`) or its `flex:1` list collapses to 0.
- **Class reminders (`lib/notifications-native.ts`) rules:** an Android channel
  (`setNotificationChannelAsync`) is REQUIRED (minSdk 28) or the notification
  silently never shows. A reminder's identity is `eventId@fireAtMs` stashed in
  `content.data` (never read the fire date off the trigger — it's not reliable
  cross-platform); only touch notifications whose `data.kind === 'class-reminder'`.
  `syncClassReminders` must NOT cancel when the bookings fetch fails (a blip would
  wipe valid reminders) — it bails instead. Use the SDK-54 handler fields
  (`shouldShowBanner`/`shouldShowList`/…), not the deprecated `shouldShowAlert`.

### Design source of truth
- Brand tokens as code: `docs/design/design-system/` (`colors_and_type.css` =
  exact color/type values, `_ds_manifest.json` = components). These drive
  `constants/theme.ts` — transcribe values from here, not from screenshots.
- Screen specs: `docs/design/screens/*.dc.html` — WEB html/css; translate intent
  into RN idioms, do not port markup one-to-one. App structure:
  `Inventario de Pantallas.dc.html` + `Navegacion y Home.dc.html`.
- Visual verification: `docs/design/screenshots/`. Brief/brand/data model:
  `docs/design/{design-brief,brand,data-model}.md`. API contract:
  `docs/api/api-contract.md`.

### Navigation structure
```
app/
├── _layout.tsx            — root Stack; GoogleSignin.configure + SplashScreen +
│                            AuthProvider + LocaleProvider + StripeProvider +
│                            ZoomVideoSdkProvider (root singleton); <Stack.Protected> guards
├── login.tsx              — S01 Bienvenida / Iniciar sesión
├── session-expired.tsx    — S02 Sesión expirada · Re-login   (tab bar hidden)
├── review.tsx             — S16 Valoración post-clase        (tab bar hidden)
├── add-to-calendar.tsx    — S19 Añadir al calendario         (modal)
├── (video)/               — tab-bar-hidden video routes; _layout is a plain <Stack>.
│   │                        Parenthesized → URLs stay /video-prejoin, /video-room.
│   ├── video-prejoin.tsx  — S14 pre-join camera/mic test
│   └── video-room.tsx     — S15 live video (Pass A) + in-session chat (Pass B via
│                            Supabase Realtime: components/video/chat-panel.tsx +
│                            lib/use-chat-session.ts + lib/chat.ts)
└── (tabs)/
    ├── _layout.tsx        — 4-tab Tabs navigator (MaterialCommunityIcons, outline/filled)
    ├── (home)/            — Tab: Inicio (home-outline / home)
    │   ├── index.tsx      — S03 Inicio   ← the ONLY route at "/" (see note below)
    │   ├── booking-detail.tsx     — S11 Detalle de la reserva
    │   ├── cancel.tsx             — S12 Cancelar reserva (2h gate)
    │   ├── reschedule.tsx         — S13 Reprogramar · 2h gate → S05 mode:'reschedule'
    │   └── reschedule-confirm.tsx — S13 confirm sheet + terminal states
    ├── (booking)/         — Tab: Reservar (calendar-outline / calendar)
    │   ├── session-type.tsx   — S04 Tipo de sesión (stack initial route; the free
    │   │                        15-min intro card shows only for new accounts —
    │   │                        hasBookings:false via GET /api/credits)
    │   ├── schedule.tsx       — S05 Cuadrícula semanal (mode: 'pay'→S06 / 'credit'→S07 /
    │   │                        'free'→confirm-free / 'reschedule'→reschedule-confirm;
    │   │                        'free' uses a 15-min grid step, others 30-min; refetches
    │   │                        availability on regained focus)
    │   ├── confirm.tsx        — S06 Confirmar y pagar (Stripe, async, poll-confirm)
    │   ├── confirm-credit.tsx — S07 Confirmar con crédito (synchronous POST /api/book)
    │   ├── confirm-free.tsx   — Confirmar sesión gratuita (synchronous POST /api/book,
    │   │                        sessionType 'free15min', no payment/credit)
    │   └── success.tsx        — S08 Reserva confirmada
    ├── (packs)/           — Tab: Packs (gift-outline / gift)
    │   ├── packs.tsx      — S09 Packs (stack initial route)
    │   └── pay.tsx        — S10 Pago del pack (Stripe, poll-confirm)
    └── (profile)/         — Tab: Perfil (account-outline / account)
        ├── profile.tsx    — S17 Perfil (stack initial route)
        ├── history.tsx    — S20 Historial de reservas (past classes; loads the WHOLE
        │                    history up front — the header count + stats are totals)
        ├── history-detail.tsx — S20 detail · read-only past class (Dejar reseña →
        │                    /review with returnTo; Reservar otra igual)
        └── settings.tsx   — S18 Ajustes
```
- Screens outside `(tabs)` automatically hide the tab bar (Expo Router behaviour).
- Each tab group has its own `_layout.tsx` wrapping a `<Stack>` with
  `unstable_settings.initialRouteName` set to its landing screen.
- **"/" resolution:** only `(home)/index.tsx` lives at `/`; the other three tab
  landing screens are **named files** (session-type/packs/profile), NOT
  `index.tsx`, so exactly one route owns `/` and the app reliably cold-starts on
  Inicio. Keep any new tab's landing screen a named route. (Why: docs/DEVLOG.md
  ADR-4.)

### Key files
- `constants/config.ts` — `API_BASE` (prod: https://www.gustavoai.dev);
- `lib/auth.ts` — auth module: `signInWithGoogle`, `exchangeGoogleToken`,
  `refreshSession` (single-flight silent refresh), `signOutGoogle`,
  `hydrateSession`, `AuthSession`/`AuthUser` types, `AuthError`,
  `getStoredSession`/`setStoredSession` (synchronous in-memory cache). Screens
  import auth from here — never call `GoogleSignin` or the auth endpoint directly.
- `lib/token-store.ts` — expo-secure-store wrapper; whole session as one JSON blob
  under `auth.session` (`loadPersistedSession`/`persistSession`/`clearPersistedSession`).
- `lib/auth-context.tsx` — `AuthProvider`/`useAuth`: reactive `session`+`isReady`
  (+`expired`) driving the `<Stack.Protected>` guards; exposes `signIn`/`signOut`.
- `types/api.ts` — TS interfaces for all API request/response shapes + domain
  error codes.
- `lib/api-client.ts` — typed fetch wrapper; use `api.*` from here, never call
  `fetch` directly. Reads the bearer synchronously via `getStoredSession()`;
  `registerRefreshHook(fn)` (wired by auth-context); `ApiError` `{ status, code,
  requiresAuth? }`.
- `app/_layout.tsx` — app init (see nav tree); provider stack + route guards.
- `lib/grid-time.ts` — pure tz/grid math for S05: `weeklyHours` frame → device-tz
  hour rows (DST-correct via `Intl`); `buildGridModel()` → the four cell states;
  `getDeviceTimeZone()`. Step-parameterized via `gridUnitsFor(duration)` — '15min'
  → 15-min step / 1 cell (free intro), '1h'/'2h' → 30-min step / 2·4 cells. Tested.
- `lib/payment-confirmation.ts` — pure confirmation pollers (no React/timers;
  `now`/`sleep` injectable, resolve once): `pollPaymentConfirmation()` (S06) and
  `pollPackConfirmation()` (S10) poll `/api/payment-confirmation/channel` to a
  terminal state or a 30s ceiling. Payments are POLL-ONLY. Tested.
- `lib/chat.ts` — pure chat reconciliation: `mergeMessages()` (dedup by `id`,
  sort by index), `parseMessageIndex()`. Tested.
- `lib/history.ts` — pure S20 logic: `fetchAllHistory()` (walks the keyset cursor
  to the last page; page fetcher injected), `effectiveStatus()` (the settlement-lag
  rule — see gotchas), `groupByMonth()`, `historyStats()`. Tested.
- `lib/format.ts` — shared display formatters: `formatEur` (stays `es-ES`),
  `bcp47`, `formatTime`/`formatDate`/`formatTimeRange`, `durationLabel`,
  `durationFromSessionType`, `leadTimeLabel` (reminder lead "10 min"/"1 h"). NEW
  screens import from here. (Older screens still carry local copies — see docs/TODO.md.)
- `lib/class-reminders.ts` — PURE class-reminder logic (no React/expo, `now`
  injectable): `computeDesiredReminders()` (fireAt = start − lead, drops non-future,
  caps at `MAX_SCHEDULED_REMINDERS`=60 for iOS's 64-pending limit) +
  `reconcileReminders()` (diff by identity `eventId@fireAtMs`). Tested.
- `lib/notifications-native.ts` — the ONLY module that calls expo-notifications
  (untested; effectful). `syncClassReminders(bookings?)` — fire-and-forget,
  in-flight-guarded orchestrator: loads prefs+permission, reconciles OS-scheduled
  reminders against the current bookings, schedules/cancels the diff (copy resolved
  via `translate` at schedule time). Disabled/not-granted → `cancelAllReminders()`.
  Triggered from Home focus (reuses the fetched list), S18 toggle/lead-time change,
  and `_layout` session-ready (sign-out cancels all). Module-scope
  `setNotificationHandler` lives in `app/_layout.tsx`.
- `lib/use-chat-session.ts` — S15 Pass B Realtime lifecycle hook (handshake →
  merge backlog → `supabase.channel().on('broadcast').subscribe()`; send via
  `api.postChatSession`; reconcile-on-SUBSCRIBED; idempotent teardown). CHAT-ONLY.
- `lib/supabase.ts` — shared Supabase client, chat Realtime only (auth
  persistence disabled). CHAT-ONLY.
- `lib/notification-store.ts` — expo-secure-store wrapper for the S18 notification
  PREFERENCE (`{ enabled, leadTimeMinutes }`) under `app.notification-prefs`.
  Local-only; `DEFAULT_NOTIFICATION_PREFS` = enabled:false/leadTime:10. The prefs
  drive scheduling in `lib/class-reminders.ts` / `lib/notifications-native.ts`.
- `lib/i18n/` — see i18n below.

### Conventions
- Build screens one at a time against stubbed data first; wire real API later.
- Do not add a native dependency without flagging the build-budget cost first;
  batch native deps (a new one needs a dev-client rebuild).
- Auth only via `lib/auth.ts`; all backend calls via `api` from
  `lib/api-client.ts` (screens never call `fetch` directly).
- **Scope fence:** `lib/supabase.ts` + `lib/use-chat-session.ts` are CHAT-ONLY.
  Payments are POLL-ONLY (`lib/payment-confirmation.ts`) — do NOT reuse the
  Realtime path for payments. (Why: docs/DEVLOG.md ADR-1, ADR-3.)

### Auth model (current)
Google Sign-In → bearer token exchange; the full session is persisted to
expo-secure-store (`lib/token-store.ts`) with a synchronous in-memory cache (what
api-client reads). Launch hydrates via `AuthProvider`, holds the native splash
until `isReady`, then gates routes with `<Stack.Protected>` (no login flash);
launch is presence-check only — an expired token 401s on first API call. A 401
triggers a **single-flight silent refresh** (`refreshSession()` via
`GoogleSignin.signInSilently()`, no picker; api-client retries at most once). On
failure it forks by `AuthError` code: `NO_SAVED_CREDENTIAL` (the ~30-day Google
credential lapsed) → **keep** the session + set `expired` → route to S02
(preserving identity for the "Continuar como" card); any other failure → sign
out → `/login`. Guards split on `isSignedIn && !expired` vs `isSignedIn &&
expired`. Reactive only; cold restart self-heals. Tested in
`auth-refresh.test.ts`. (Detail: docs/DEVLOG.md ADR-7.)

### Internationalization (i18n)
Pure-JS foundation in `lib/i18n/` — device language via `Intl`, persistence via
expo-secure-store (no expo-localization / no AsyncStorage / no native dep):
`device-locale.ts`; `strings.ts` (keyed ES/EN dictionaries — `es` canonical, `en`
typed against it so tsc enforces key parity; `translate()` resolves dotted paths);
`locale-store.ts` (under `app.locale`); `locale-context.tsx` (`LocaleProvider`,
`useLocale()`/`useT()`).

- **The app is fully bilingual** — no hardcoded user-facing Spanish anywhere.
- **Key convention:** `screen.section.element`. Strings shared across ≥2 screens
  live in `common.*`; recurring error/failure copy in `errors.*` (never duplicate
  per screen). `t()` has NO interpolation — put a `{token}` in the value and
  `.replace('{token}', v)` at the call site; plurals get two keys (`…One`/`…Other`).
  Sub-components call `useLocale()` themselves rather than threading `t` as a prop.
- **`setLocale(l)`** (S18) switches the UI, persists to device, and POSTs
  `/api/locale`. Internal `applyLocale` skips the POST (adopting a value the
  backend already holds).
- **Precedence:** the reconcile runs ONLY on a fresh token exchange (interactive
  sign-in OR silent refresh; `hydrateSession` does NOT fire it). On exchange:
  `user.locale != null` → adopt it (**backend/stored wins**, even over device
  language, no POST); `null` (new user) → derive from device, apply, and POST
  `/api/locale` **once** to seed the DB.
- **For any NEW screen:** use `useT()`/`t()`, add keys to `strings.ts` in BOTH
  languages (parity enforced by the type), reuse `common.*`/`errors.*`, never
  leave hardcoded user-facing Spanish.
- **KNOWN LIMITATION:** the native Stripe PaymentSheet follows the device OS
  locale, not the in-app toggle (no locale option in the SDK; our i18n is
  pure-JS). Euro formatting (`formatEur`) stays `es-ES`. Accepted as-is (why:
  docs/DEVLOG.md ADR-6).
- **RULE-BEARING COPY kept faithful:** the paid-cancel refund line is extracted
  as-is (`cancel.refundBody`, "…menos la comisión de Stripe" / "…minus the Stripe
  fee" — not softened). Pack product names ("Pack Esencial"/"Pack Intensivo") are
  NOT translated.

### Deferred / follow-ups
Full list in [docs/TODO.md](docs/TODO.md). Ship blocker to flag: the Apple
`merchantIdentifier` placeholder (`app.json`) must be replaced with the real
merchant id before an **iOS** ship — it's Apple Pay only (Stripe plugin),
consumed solely by the iOS build, so it does NOT block Play Store (Android)
publishing.

## Maintaining this file

This file is read at the start of every session — keep it accurate or it
misleads. **CLAUDE.md holds current-state guidance only.** Build history, dated
verification records, and architecture-decision reasoning belong in
[docs/DEVLOG.md](docs/DEVLOG.md); deferred work in [docs/TODO.md](docs/TODO.md).
This discipline is what keeps CLAUDE.md from re-bloating into a build-log — do
not append narrative or "we built X then Y" records here.

When a change affects any of the following, update this file IN THE SAME commit
as the change:
- Directory structure or where key files live
- A new convention, or a change to an existing one
- A dependency added/removed (especially native deps — note the build cost)
- A deferred decision becoming active (e.g. an auth/i18n approach finalized)
- A new script, env var, or setup step
- A new durable gotcha (add it as a terse rule, not a story)

When the change carries reasoning or a build/verification narrative, append THAT
to `docs/DEVLOG.md` (a new ADR or a build-history entry) rather than to CLAUDE.md.

When you finish a task, before reporting done, check whether any of the above
changed. If so, update the right file(s) as part of the same change and mention
it in your summary. If nothing changed, say "CLAUDE.md: no update needed" so it's
clear it was considered, not forgotten.
