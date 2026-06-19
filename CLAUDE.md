## Project: gustavoai mobile

A React Native (Expo) mobile app for students of an existing online
tutoring web service. It consumes the existing Next.js API over HTTP —
it does NOT have its own backend.

### Tech
- Expo SDK 54, Expo Router (file-based), TypeScript strict
- npm (NOT pnpm/yarn) — keep package-lock.json authoritative
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
  Integration code for Stripe/secure-store/notifications/calendar is NOT written yet — only
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
    │   ├── cancel.tsx     — S12 Cancelar reserva
    │   └── reschedule.tsx — S13 Reprogramar reserva
    ├── (booking)/         — Tab: Reservar (calendar-outline / calendar)
    │   ├── session-type.tsx   — S04 Tipo de sesión  (stack initial route → /(tabs)/(booking)/session-type)
    │   ├── schedule.tsx   — S05 Cuadrícula semanal
    │   ├── confirm.tsx    — S06 Confirmar y pagar
    │   ├── confirm-credit.tsx — S07 Confirmar con crédito
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
- `lib/auth.ts` — auth module: `signInWithGoogle`, `exchangeGoogleToken`, `signOutGoogle`,
  `hydrateSession` (load persisted → in-memory at launch), `AuthSession`/`AuthUser` types,
  `AuthError` class, `getStoredSession`/`setStoredSession` (synchronous in-memory cache)
- `lib/token-store.ts` — expo-secure-store wrapper: `loadPersistedSession`/`persistSession`/
  `clearPersistedSession` (whole session as one JSON blob under `auth.session`)
- `lib/auth-context.tsx` — `AuthProvider`/`useAuth`: reactive `session`+`isReady` that drive
  the `<Stack.Protected>` guards and expose `signIn`/`signOut`
- `types/api.ts` — TypeScript interfaces for all API request/response shapes and domain error codes
- `lib/api-client.ts` — typed fetch wrapper; use `api.*` methods from here, never call `fetch` directly
  - reads the bearer synchronously via `getStoredSession()` — no change needed for secure storage
  - `registerRefreshHook(fn)` — wire to silent-refresh when A3 task is done
  - `ApiError` class — `{ status, code, requiresAuth? }`
- `app/_layout.tsx` — `GoogleSignin.configure({ webClientId })` + `SplashScreen.preventAutoHideAsync()`
  run here at app init; wraps the app in `AuthProvider` and gates routes with `<Stack.Protected>`

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
- Pending: silent refresh on 401 (A3 task) — `registerRefreshHook` in lib/api-client.ts is the hook point
- Pending: S02 session-expired re-login screen (reuses this auth logic)

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