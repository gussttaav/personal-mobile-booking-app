# Deferred / follow-ups

Known, intentionally-deferred work. Grouped by where it lives. See `CLAUDE.md`
for current-state guidance and `docs/DEVLOG.md` for the reasoning behind each.

## App follow-ups (this repo)

- **Replace the Apple `merchantIdentifier` placeholder** (Stripe plugin,
  `app.json`) with the real merchant id before iOS ships. Ship blocker for iOS
  only — it's Apple Pay config, consumed solely by the iOS build; does NOT
  block Play Store (Android) publishing.
- **iOS camera/mic permission request path.** Currently Android-only (RN core
  `PermissionsAndroid`); the iOS request is a marked TODO in S14. Also the iOS
  `ONLY_ACTIVE_ARCH` Podfile tweak for the Zoom SDK is deferred (iOS-only).
- **Class-reminder residuals.** Local reminder scheduling is now DONE
  (`lib/class-reminders.ts` + `lib/notifications-native.ts`, synced from Home
  focus / settings / session). Two sub-items stay deferred: (a) **deep-link on
  tap** — a tapped reminder currently just opens the app to Inicio; routing to
  booking-detail would need the booking identifiers (incl. join/cancel tokens) in
  the OS payload + a response listener + cold-start routing; (b) **custom
  notification SOUND** — the custom small ICON is now DONE (expo-notifications
  config plugin `icon`/`color` in `app.json`, effective on the next dev-client
  rebuild); a custom sound would still need the plugin's `sounds` array (another
  rebuild) and is left deferred.
- **True return-to-context after re-auth.** S02 re-auth currently lands on Inicio
  (the `(tabs)` group remounts at its initial route); the routing captures no
  prior route. Marked TODO at the refresh hook in `lib/auth-context.tsx`.
- **S09/S10 pack expiry.** Omitted because `GetCreditsResponse` has no expiry
  field yet (TODO in BalanceCard).
- **Migrate the local formatter copies onto `lib/format.ts`.** S20 introduced the
  shared module; `formatEur` still has local copies in `(packs)/packs.tsx`,
  `(packs)/pay.tsx`, `(booking)/confirm.tsx`, `(booking)/confirm-credit.tsx` and
  `(booking)/session-type.tsx`, and the date/duration helpers in
  `components/BookingRow.tsx` + `(home)/booking-detail.tsx`. Mechanical, but left
  out of the S20 diff to keep it reviewable.
- **S20 rebook does not preselect the past slot.** "Reservar otra igual" re-enters
  the booking flow at the right session type/duration, but the user picks a new
  time from scratch (there is no repeat-this-slot endpoint).

- **Play Data safety: web-accessible account-deletion URL.** Google Play's Data
  safety form asks for a deletion path reachable **without installing the app**.
  The in-app flow (S21) satisfies the in-app requirement; the form still needs a
  URL — point it at `https://gustavoai.dev/area-personal` (the same flow on the
  web) and cite `/privacidad` for what gets erased. Play Console task, no code.
- **S21 against a live server.** The deletion flow is implemented but has only
  been exercised against types and unit tests. Run §9 of ACCOUNT-DELETE-01 on
  staging: the 400 `DELETION_NOT_CONFIRMED` path, a 409 arriving on submit
  (re-fetches the verdict), the 404 `USER_NOT_FOUND` = success path, and — on
  device — that backgrounding + reopening after a successful delete lands on the
  signed-out root.

## Backend-hardening (Next.js API — other repo)

These are gaps observed in the live API that the mobile client works around or
depends on; hardening them is backend work.

- **`/api/book` accepts an unaligned `startIso`.** The endpoint does not reject a
  start time that isn't grid-aligned.
- **Channel-route pack branch lacks the `checkoutType` discriminator.** The
  `/api/payment-confirmation/channel` pack branch doesn't carry the discriminator
  cleanly; `pollPackConfirmation()` compensates by failing loud if it sees the
  single-session shape.
- **Rescheduled paid bookings have NULL `stripe_payment_id`.** A paid reschedule
  via `/api/book` with a `rescheduleToken` doesn't re-charge, so the new row has
  no `stripe_payment_id` → an admin-visibility gap (payment can't be traced from
  the new booking row).
- **Web single-session slot-taken blind spot persists.** The single-session
  slot-taken outcome isn't surfaced on the web the way it is on mobile.
