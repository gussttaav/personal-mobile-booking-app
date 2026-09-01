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
- **Local notification scheduling.** S18 captures the preference only
  (`lib/notification-store.ts`). Actual reminder scheduling
  (`Notifications.scheduleNotificationAsync` synced to the booking lifecycle
  using `leadTimeMinutes`) is a marked TODO in `settings.tsx`. When a custom
  notification icon/sound is added, also add the expo-notifications config plugin
  (needs a dev-client rebuild).
- **Wire S08 → S11 `goDetail`.** S08 passes `eventId`, but S11 booking-detail
  reads `token`; the path is not yet wired.
- **Wire the S12 contact stubs.** "Avisar a Gustavo" / "Escribir a Gustavo" are
  currently `Alert` stubs.
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
