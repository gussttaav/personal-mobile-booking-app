## Project: gustavoai mobile

A React Native (Expo) mobile app for students of an existing online
tutoring web service. It consumes the existing Next.js API over HTTP —
it does NOT have its own backend.

### Tech
- Expo SDK 54, Expo Router (file-based), TypeScript strict
- npm (NOT pnpm/yarn) — keep package-lock.json authoritative
- Testing on physical Android via Expo Go until native deps require a dev build

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

### Key files
- `constants/config.ts` — `API_BASE` URL (production: https://www.gustavoai.dev)
- `lib/auth.ts` — auth module: `signInWithGoogle`, `exchangeGoogleToken`, `signOutGoogle`,
  `AuthSession`/`AuthUser` types, `AuthError` class,
  `getStoredSession`/`setStoredSession` (in-memory session store)
- `types/api.ts` — TypeScript interfaces for all API request/response shapes and domain error codes
- `lib/api-client.ts` — typed fetch wrapper; use `api.*` methods from here, never call `fetch` directly
  - `registerRefreshHook(fn)` — wire to silent-refresh when A3 task is done
  - `ApiError` class — `{ status, code, requiresAuth? }`
- `app/_layout.tsx` — `GoogleSignin.configure({ webClientId })` runs here at app init

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
- In-memory session store added to lib/auth.ts (`getStoredSession`/`setStoredSession`)
- Pending: secure token storage (expo-secure-store) — see TODOs in lib/auth.ts
- Pending: silent refresh on 401 (A3 task) — `registerRefreshHook` in lib/api-client.ts is the hook point

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