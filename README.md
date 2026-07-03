# GUSTAVOAI.DEV — MOBILE APP

React Native (Expo) student app for the [**gustavoai.dev**](https://www.gustavoai.dev) online tutoring platform.

> **Platform:** [gustavoai.dev](https://www.gustavoai.dev) · **Web app:** [gussttaav/personal-tutoring-platform](https://github.com/gussttaav/personal-tutoring-platform)

![Expo](https://img.shields.io/badge/Expo-SDK_54-000020?logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-payments-635BFF?logo=stripe&logoColor=white)
![Zoom](https://img.shields.io/badge/Zoom-Video_SDK-2D8CFF?logo=zoom&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-22c55e)

---

## Overview

The student-facing mobile companion to the gustavoai tutoring platform. Students sign in with Google, book and pay for classes (single sessions or credit packs), join the live 1:1 video class with in-session chat, and leave a review afterwards — all from their phone.

The app is a **client only**: it consumes the existing gustavoai Next.js API over HTTP and has no backend of its own. The full customer experience is **bilingual (Spanish / English)** with automatic device-language detection and a manual switcher, mirroring the web platform. It runs on a **custom development build**, not Expo Go, because of its native integrations.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| **Expo SDK 54** + **Expo Router** | App framework; file-based routing |
| **React Native 0.81** (New Architecture) | Native runtime; New Arch is required by Reanimated 4 |
| **TypeScript** (strict) | End-to-end type safety, incl. ES/EN i18n key parity enforced by the compiler |
| **Google Sign-In** (`@react-native-google-signin`) | Google OAuth → bearer token exchange with the platform API |
| **Stripe** (`@stripe/stripe-react-native`) | In-app PaymentSheet for single sessions and packs (card) |
| **Zoom Video SDK** (`@zoom/react-native-videosdk`, pinned 2.5.10) | The live 1:1 virtual classroom, embedded in the app |
| **Supabase Realtime** (`@supabase/supabase-js`, pinned 2.110.0) | In-session text chat only (payments stay poll-based) |
| **Reanimated 4** | Animations and keyboard handling |
| **expo-secure-store** | Encrypted storage for the auth session, locale, and notification prefs |
| **expo-calendar** / **expo-notifications** | Add-to-calendar; class-reminder preference |
| **Jest** + **jest-expo** | Unit tests for the pure logic modules |
| **EAS Build** | Builds the custom dev client and distributables |

---

## Features

- **Google sign-in** — one-tap Google auth; the session persists to secure storage and self-heals on expiry with a silent, single-flight token refresh
- **Free intro + paid sessions** — book a 15-minute free intro, or 1h / 2h paid sessions, paid inside the app via Stripe's PaymentSheet
- **Class packs** — buy 5- or 10-class packs at a discount; credits activate immediately after payment and can be spent on future bookings
- **Real-time availability** — a weekly grid fetches free slots on demand and refetches when the screen regains focus, so taken slots show as unavailable
- **Embedded live classroom** — join the 1:1 Zoom session directly in the app: camera/mic pre-join test, event-driven waiting↔in-class states, and privacy-aware camera release when backgrounded
- **In-session chat** — real-time text chat alongside the live video, backed by Supabase Realtime with reconnect-safe message reconciliation
- **Manage bookings** — see upcoming and past classes, and reschedule or cancel from a detail screen, with the 2-hour policy window enforced client-side
- **Add to calendar** — one tap writes the class (with join link) to the device calendar
- **Post-class review** — a gentle progressive rating → comment → optional Google-review flow
- **Bilingual (Spanish / English)** — every screen is localized; the app adopts the account's saved language (falling back to the device language for new users) and can be switched in-app from Settings
- **Profile & settings** — Google identity, credit balance, language switch, and a local class-reminder preference

---

## Architecture

Screens stay thin: UI calls a typed API client, and non-trivial logic lives in small, unit-tested pure modules under `lib/`.

```
app/            File-based routes (Expo Router): the 4-tab app + full-screen
                experiences (login, session-expired, video, review, calendar)
components/      Reusable UI components
constants/      Theme tokens (theme.ts) + config (config.ts: API_BASE, keys)
lib/            Non-UI logic — auth, api-client, i18n, pure pollers/reconcilers,
                secure-store wrappers   (unit tests in lib/__tests__/)
types/          API request/response shapes + domain error codes
docs/           Design system, screen specs, API contract, and the dev docs
```

**Data flow:**
```
Screen → api (lib/api-client.ts) → gustavoai Next.js API
              └ bearer from lib/auth.ts → single-flight silent refresh on 401
```

**Key design decisions** (full reasoning in [docs/DEVLOG.md](docs/DEVLOG.md)):

- **Payments are poll-only** — booking/pack confirmation polls the platform's authoritative confirmation channel to a terminal state, rather than mirroring the web's Realtime path. This avoids an optimistic-vs-real reconciliation bug class.
- **Realtime is chat-only** — the Supabase client is fenced to in-session chat; it is never used for payments.
- **New Arch + Zoom legacy SDK** — Reanimated 4 forces the New Architecture; the Zoom SDK runs through RN's New-Arch interop shim and requires `minSdkVersion 28` (dropping Android 7.0–8.1).
- **Zoom provider is a root singleton** — `ZoomVideoSdkProvider` is mounted once at the app root; re-initializing it on route changes NPE-crashes the app.
- **Pure-JS i18n** — device language via `Intl`, persistence via secure-store, no native localization dep; the account's saved locale wins over the device, and new users seed it from the device.
- **Reactive auth guards** — routes are gated by `<Stack.Protected>` on a reactive session; a lapsed Google credential routes to a re-login screen while preserving the user's identity.

---

## Testing

```bash
npm test          # Jest (jest-expo) — unit tests for the pure lib/ modules
npm run lint      # eslint (expo lint)
```

The unit tests cover the framework-free logic (payment/pack confirmation pollers, the booking-grid time math, and chat message reconciliation) with injectable clocks and no network — the parts most worth testing in isolation.

---

## Local Setup

### Prerequisites

- Node.js + **npm** (do not use pnpm/yarn — `package-lock.json` is authoritative)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`) and an Expo account
- A physical **Android** device or emulator (Android is the current target; iOS is partially deferred — see [docs/TODO.md](docs/TODO.md))
- Access to the gustavoai platform API and its client credentials (Google OAuth web client ID, Stripe publishable key, Supabase URL + anon key)

> **This app does not run in Expo Go.** Its native modules (Zoom, Stripe, Google Sign-In, secure-store, calendar, notifications) are not in Expo Go, so you must install the **custom development build** below.

### 1. Clone and install

```bash
git clone https://github.com/gussttaav/personal-mobile-booking-app.git
cd personal-mobile-booking-app
npm install
```

### 2. Configure

Client configuration is checked into source (these are public client keys, not
secrets). Point them at your environment:

- **`constants/config.ts`** — `API_BASE` (the platform API base URL),
  `STRIPE_PUBLISHABLE_KEY`, `SUPABASE_URL` / `SUPABASE_ANON_KEY`, and
  `GOOGLE_REVIEW_URL`.
- **`app/_layout.tsx`** — the Google Sign-In `webClientId`.
- **`app.json`** — Android `package`, `scheme`, EAS `projectId`/`owner`, and the
  iOS Stripe `merchantIdentifier` (still a placeholder — see docs/TODO.md).

Validate any `app.json` config-plugin change with:

```bash
npx expo config --type prebuild
```

### 3. Build and install the dev client

```bash
eas build --profile development --platform android
```

Install the resulting APK on your device/emulator. **Adding a new native module
later requires rebuilding this dev client** — installing it into `package.json`
alone won't load it.

### 4. Run

```bash
npm start          # start the Metro dev server
# or: npm run android / npm run ios
```

Open the app in the installed development build (scan the QR, or press `a` for Android).

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — the working reference for maintainers: tech stack, live rules, durable gotchas, navigation structure, key files, and the auth / i18n models as they work today. Read this first.
- **[docs/DEVLOG.md](docs/DEVLOG.md)** — architecture decisions (with reasoning) and the chronological build history: *why the app is the way it is.*
- **[docs/TODO.md](docs/TODO.md)** — deferred work and known follow-ups (app-side and backend-hardening).
- **[docs/design/](docs/design/)** — design system (authoritative brand tokens), per-screen specs, brand brief, and data model.
- **[docs/api/api-contract.md](docs/api/api-contract.md)** — the backend API contract.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Contact

**Gustavo Torres Guerrero**  
[gustavoai.dev](https://www.gustavoai.dev) · [LinkedIn](https://www.linkedin.com/in/gustavo-torres-guerrero) · [GitHub](https://github.com/gussttaav) · contacto@gustavoai.dev
