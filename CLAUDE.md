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
  ZOOM VIDEO (S14/S15): @zoom/react-native-videosdk pinned EXACT 2.5.10 is INSTALLED,
  CONFIGURED in app.json, and NOW COMPILED INTO the current dev client (the EAS build ran).
  VIDEO-VIEW RENDER VERIFIED (2026-07-01): a throwaway smoke test confirmed the local
  <ZoomView> renders the camera feed through the New-Arch interop shim on Android — the
  eventId→/api/zoom/token→joinSession→getMySelf→<ZoomView> chain works end-to-end, no
  IllegalViewOperationException. So S14/S15 can be built for real against live video.
  GOTCHA (see memory zoom-join-audiooptions-gotcha): joinSession() throws "Exception in
  HostFunction: autoAdjustSpeakerVolume" unless audioOptions.autoAdjustSpeakerVolume is
  passed, even though the TS type marks it optional — always include it. types/api.ts is
  now aligned to the LIVE responses (verified 2026-07-01): PostZoomTokenResponse =
  { token, sessionName, passcode (→ SDK sessionPassword), startIso, durationWithGrace
  (minutes, incl. grace), expiresAt (unix seconds) } — the live endpoint does NOT return
  userName/role despite the contract doc (get the join display name from the auth session);
  and Booking (my-bookings item) now carries eventId. The temporary smoke-test screen has
  been deleted now that video render is verified.
  S14 (app/(video)/video-prejoin.tsx) IS built — the pre-join camera/mic test.
  S15 PASS A (app/(video)/video-room.tsx) IS built — the LIVE video session (video +
  controls + lifecycle + teardown). Joins a FRESH session on mount from the S14 params
  (joinSession with audioOptions.autoAdjustSpeakerVolume ALWAYS set — the gotcha).
  EVENT-DRIVEN phase machine: connecting → waiting → inClass → error, driven by SDK
  events (onSessionJoin/onUserJoin/onUserLeave/onSessionLeave/onError + on{Audio,Video}
  StatusChanged), NOT assumptions. 1:1 tutoring ⇒ ANY remote user IS the tutor, so
  waiting↔inClass is driven purely by the remoteUsers count (onUserJoin/Leave carry the
  full remoteUsers list; verified from RNZoomVideoSdkModule.java). Tutor leaving →
  calm 'waiting' (not a crash); rejoining → 'inClass'. REMOTE INDICATORS: the tutor's
  camera-off state shows an avatar placeholder instead of a black frame, and a live
  mic-muted indicator sits in a bottom-left tutor chip — both reconciled from
  getRemoteUsers()[0].videoStatus.isOn()/audioStatus.isMuted() on the status events.
  Controls (mic/camera/leave) are
  OPTIMISTIC then RECONCILED from SDK truth via session.getMySelf().audioStatus.isMuted()
  / videoStatus.isOn() on the status-changed events. First REMOTE ZoomView render — same
  New-Arch interop path as S14's local preview. In-session rotation self-corrects (native
  refreshRotation runs when isInSession), so NO manual rotateMyVideo here (S14 needed it
  only because preview isn't in-session). TEARDOWN is idempotent (leftRef guard +
  isInSession() check) and fires on EVERY exit path: Leave button (confirm dialog →
  router.replace /review with eventId), OS back gesture / unmount (useEffect cleanup),
  and unexpected onSessionLeave (idle-timeout / tutor ended → also → /review). Android
  HARDWARE BACK is intercepted (BackHandler) to run the SAME confirm→/review flow as the
  Leave button — not a silent pop back to pre-join. NEVER calls zoom.cleanup() (that kills
  the root singleton) — teardown = leaveSession(false) only. App BACKGROUNDING keeps the
  session ALIVE (a brief notification check must not drop the class) but RELEASES THE
  CAMERA for privacy: AppState 'background' → videoHelper.stopVideo() (audio stays
  connected, like a call); on 'active' return, videoHelper.startVideo() resumes ONLY if
  the camera was on when backgrounded (cameraOnRef captured synchronously). Strings live
  in the room.* i18n namespace (ES+EN). No native dep / no rebuild (Zoom already
  compiled in).
  S15 PASS B (in-session TEXT CHAT) IS built — the app's FIRST and ONLY Supabase Realtime
  integration, layered onto Pass A as a SEPARATE concern (the video lifecycle is untouched).
  Backend contract: GET /api/chat-session/channel?eventId → { channelName (HMAC capability
  "chat:<hash>", returned only after a membership check), initialMessages }; RECEIVE via
  Supabase BROADCAST on channelName, event "message", payload = a ChatMessage
  { id:"<eventId>:<index>", senderEmail, senderName, text, sentAt(ISO) }; SEND via
  POST /api/chat-session { eventId, text } (bearer; persists=source of truth, then broadcasts).
  types/api.ts ChatMessage was REALIGNED to this shape (the old stub { sender,text,createdAt }
  was wrong). NEW FILES: lib/chat.ts (PURE, unit-tested in lib/__tests__/chat.test.ts —
  mergeMessages dedups by id + sorts by index, parseMessageIndex; mirrors payment-confirmation's
  pure-core discipline); lib/use-chat-session.ts (the Realtime lifecycle hook — handshake →
  merge backlog → supabase.channel().on('broadcast',{event:'message'}).subscribe(); owns the
  subscription so the panel open/close is pure UI); components/video/chat-panel.tsx (the
  "chat abierto" bottom-sheet UI: own vs tutor bubbles, input+send, absolute overlay so the
  video stays active/visible above it). KEYBOARD GOTCHA (hit + fixed on-device): SDK 54's
  Android edge-to-edge default does NOT resize/pan the window for the soft keyboard, so a
  KeyboardAvoidingView can't lift an absolute overlay; the raw Keyboard API also under-reports
  the height on some Android OEMs (excludes the gesture-nav region → input still clipped).
  FIX: chat-panel.tsx uses Reanimated's useAnimatedKeyboard (edge-to-edge-aware, reports the
  true inset) to animate the SHEET's bottom padding to max(keyboard, safe-area-bottom) — the
  sheet bg stays flush to the screen bottom (extends behind the keyboard) while its content +
  input lift above the keyboard; the message FlatList is flex:1 so it shrinks/scrolls and the
  header stays pinned. NB the sheet needs a DEFINITE height (height:'80%', not maxHeight) or the
  flex:1 list resolves to 0 height and the messages vanish. Reanimated 4 is already compiled in
  — no native dep / no rebuild.
  SCOPE FENCE: lib/use-chat-session.ts + lib/supabase.ts
  are CHAT-ONLY — payments stay POLL-ONLY (lib/payment-confirmation.ts); do NOT reuse this
  Realtime path for payments. SEND = WAIT-FOR-BROADCAST (not optimistic): POST → "sending…"
  → the bubble renders only when its own broadcast echoes back (deduped by id) — one render
  path, no optimistic/real mismatch (the ":index" can't be predicted client-side so echo-
  matching would be fragile). The input clears only on POST success; a failed send keeps the
  text + shows an error (never silently dropped). RECONCILE: backlog is re-fetched on every
  SUBSCRIBED (fires on first subscribe AND on reconnect) and re-merged — recovers a broadcast
  missed in the snapshot→subscribe gap or during a socket drop (dedup makes the re-merge safe;
  same reconcile-on-resubscribe pattern as payments). TEARDOWN: the hook's channel is released
  idempotently (supabase.removeChannel) both on unmount (its own useEffect cleanup — covers
  EVERY video exit path since they all unmount the room) AND imperatively inside the room's
  existing teardown() so it releases immediately on Leave/back/session-lost alongside video.
  BACKGROUNDING: the subscription stays ALIVE (matches Pass A keeping the session alive — a
  brief notification check must not drop chat); Supabase auto-reconnects and reconcile-on-
  SUBSCRIBED recovers anything missed. Chat is enabled once joined (waiting|inClass); the
  Pass-A placeholder control is now wired (opens the sheet; unread badge from unreadCount
  while closed). Strings in the room.chat.* i18n namespace (ES+EN). NO native dep / NO rebuild
  (@supabase/supabase-js is JS-only, already bundled).
  PROVIDER WIRING: ZoomVideoSdkProvider is an APP-SESSION SINGLETON mounted ONCE at the
  root (app/_layout.tsx, inside StripeProvider around RootNavigator, config
  enableLog:__DEV__). It MUST NOT be scoped to the (video) group: that layout remounts on
  every entry and the library re-calls initSdk with NO unmount cleanup — a second init on
  the already-initialized native SDK returns an error the native module rejects with a
  null userInfo, NPE-crashing the app (RNZoomVideoSdkModule.initSdk). Init-at-launch is
  the accepted tradeoff (native lib init only; no camera/mic access, no launch prompt).
  The (video) group still exists (app/(video)/_layout.tsx = a plain <Stack>) to hold the
  tab-bar-hidden video routes; parenthesized so URLs stay /video-prejoin, /video-room
  (app/_layout.tsx registers the "(video)" group in place of the two flat screens). PREVIEW = Option A: ZoomView has a
  `preview?: boolean` prop, so S14 renders <ZoomView userId="" preview /> for a
  DEVICE-ONLY local preview with NO session joined — join happens later in S15.
  GOTCHA (hit + fixed on-device): userId MUST be "" (empty string), NOT null — the
  native RNZoomViewManager.setUserId() does newUserId.equals(userId) and throws a
  NullPointerException on a null userId (crashes the whole dev build with
  JSApplicationIllegalArgumentException at RNZoomViewManager.setUserId). "" matches the
  native default and `preview` renders via startVideoCanvasPreview independent of userId.
  The TS type says `string | null` but null is a trap. Option A preview VERIFIED to
  render live local video through the New-Arch interop shim on-device (2026-07-01).
  ROTATION: the preview renders sideways because the native refreshRotation() bails when
  !isInSession(), so no display-rotation correction runs pre-join — S14 calls
  videoHelper.rotateMyVideo(0) itself ~250ms after the canvas starts (app is
  portrait-locked → Surface.ROTATION_0; re-applied after switchCamera). See memory
  zoom-preview-userid-null-crash. If preview ever regresses, the fallback is Option B for
  S14 only (join with videoOptions.localVideoOn + audioOptions.mute, show the
  joined-session view, pass the live session to S15).
  PERMISSIONS: camera+mic via react-native core
  PermissionsAndroid (no expo-camera; Android-only — iOS request is a marked TODO,
  deferred): check on mount → requestMultiple → NEVER_ASK_AGAIN routes to a recovery
  state with Linking.openSettings(). Never previews/joins without both granted. CONTROLS:
  camera on/off (mount/unmount preview), mic mute (intent only, forwarded to S15 as
  startMuted), camera flip via videoHelper.switchCamera() (best-effort, may only take
  effect in-session). ENTRY POINTS now pass eventId (not joinToken) to /video-prejoin —
  success.tsx (S08), booking-detail.tsx (S11, +eventId param; Home forwards b.eventId),
  and Home's next-class join button — because /api/zoom/token takes { eventId }. On
  "Entrar" S14 calls api.postZoomToken({eventId}); errors (401→errorAuth, else generic)
  show on S14, no navigation; success pushes to /video-room with the token payload +
  userName (from auth session) + startMuted/startVideoOff intent. Strings live in the
  prejoin.* i18n namespace (ES+EN). REMINDER: whenever joinSession() is called (S15 or
  Option-B), audioOptions MUST include autoAdjustSpeakerVolume (see
  zoom-join-audiooptions-gotcha).
  NO config plugin (Zoom ships none; autolinking
  handles the native module). REQUIRES minSdkVersion 28 (Android 9): Zoom 2.5.10 declares
  minSdk 28, so the Expo-54 default of 24 fails manifest merge (processDebugMainManifest) —
  bumped via the expo-build-properties plugin (android.minSdkVersion:28) added to app.json.
  This DROPS support for Android 7.0–8.1 (API 24–27); accepted as the only viable path for
  this Zoom version (override/downgrade rejected). expo-build-properties is a config plugin
  only (no runtime native module; takes effect at prebuild). It is
  a LEGACY-ARCH SDK running through RN's New-Arch interop shim (the app is New Arch for
  Reanimated 4) — video views VERIFIED to render through the shim (see above). Camera/mic permissions
  added for it: iOS infoPlist NSCameraUsageDescription / NSMicrophoneUsageDescription
  (Spanish), Android CAMERA + RECORD_AUDIO (alongside POST_NOTIFICATIONS). The iOS
  ONLY_ACTIVE_ARCH Podfile tweak is DEFERRED — iOS-only TODO for whenever iOS ships
  (current target is Android). @supabase/supabase-js pinned EXACT 2.110.0 is also installed
  but is JS-ONLY (no native build impact, rides into the bundle): lib/supabase.ts is a
  shared client SCOPED TO in-session chat Realtime (S15) ONLY — explicitly NOT for payment
  confirmation, which stays poll-only (scope fence comment in the file). Auth session
  persistence is disabled there (chat uses no Supabase auth), avoiding an AsyncStorage dep.
  NOW IN USE by S15 Pass B chat (lib/use-chat-session.ts) — the only Realtime consumer.
  Stripe integration IS written: StripeProvider in app/_layout.tsx (card-only, Google Pay
  off for now); PaymentSheet wired in app/(tabs)/(booking)/confirm.tsx (S06 Pass A).
  S06 Pass B confirms the booking by AUTHORITATIVE POLLING of
  /api/payment-confirmation/channel (status is total) — NO Supabase/Realtime is used for
  PAYMENTS (the web's useSSECredits Realtime path is intentionally not mirrored on mobile;
  the lib/supabase.ts client exists but is fenced to chat only). See
  lib/payment-confirmation.ts. On 'confirmed' it navigates to S08
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
  (Calendario→S19 add-to-calendar modal, Reprogramar→S13, Cancelar→S12 danger style).
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
  S17 (app/(tabs)/(profile)/profile.tsx) + S18 (app/(tabs)/(profile)/settings.tsx)
  IS built — the Perfil tab is complete and both screens are FULLY localized
  (useT()). S17 Perfil: Google identity from the auth session (image with initials
  fallback, name, email, "vinculada con Google" badge — read-only, no name edit / no
  account deletion), credit balance via api.getCredits() on focus (renders
  CreditBalanceCard only when packSize != null; depleted-pack edge not surfaced here
  since Perfil doesn't fetch bookings — see Home's ownedPack), an Ajustes entry, and
  the REAL home for sign-out (the temp profile.tsx stub graduated here). S18 Ajustes:
  push-notification PREFERENCE (RN core <Switch> + 5/10/15/30/60-min lead-time pills,
  default 10) persisted LOCAL-ONLY via new lib/notification-store.ts (no backend);
  calendar access; language ES/EN (reuses setLocale); sign-out. PERMISSIONS are wired
  for real (expo-notifications + expo-calendar are in the dev client): enabling
  notifications calls Notifications.requestPermissionsAsync() — granted reveals the
  lead-time row, denied keeps the toggle OFF (never on-without-permission) and shows a
  recovery banner → Linking.openSettings(); calendar "Conectar" calls
  Calendar.requestCalendarPermissionsAsync() with the same granted/denied-recovery
  paths. Live permission status is read on mount (getPermissionsAsync /
  getCalendarPermissionsAsync) so the UI reflects the real OS state. NOTIFICATION
  SCHEDULING IS DEFERRED — S18 only captures the preference; actual reminder
  scheduling (Notifications.scheduleNotificationAsync synced to the booking lifecycle
  using leadTimeMinutes) is a marked TODO in settings.tsx. No app.json/plugin change
  and NO dev-client rebuild were needed (only permission requests, no custom
  notification icon/sound, so the expo-notifications config plugin stays unadded).
  Remaining secure-store integration is done for prefs; no other native integration
  code pending here.
  S19 (app/add-to-calendar.tsx) IS built: shared modal sheet reached from S08
  ("Añadir al calendario" primary button) and S11 ("Calendario" secondary button).
  4-phase state machine: checking→requesting→adding→success (or denied/error).
  Permission flow: reads Calendar.getCalendarPermissionsAsync() on mount; if
  undetermined shows a request screen and calls requestCalendarPermissionsAsync();
  if denied shows recovery state with Linking.openSettings(); granted → writes
  event immediately. Calendar event: localized title via `addToCalendar.eventTitle*`
  keys (e.g. "Sesión de 1 hora con Gustavo Torres" / "1-hour session with Gustavo
  Torres"); start/end from ISO params; device timezone via Intl; notes + location
  hold the join URL (`${API_BASE}/${locale}/sesion/${joinToken}`). Cross-platform
  calendar picker: iOS uses Calendar.getDefaultCalendarAsync(); Android finds the
  first local writable calendar via Calendar.getCalendarsAsync(). No dev-client
  rebuild needed — expo-calendar was already compiled in. Entry points pass params
  {startIso, endIso, sessionType, joinToken}. S08's Alert stub removed; S11's Alert
  stub removed. All user-facing strings in addToCalendar.* i18n namespace (ES + EN).
  S16 (app/review.tsx) IS built — the post-class review, the LAST screen of the class
  lifecycle. Reached from S15 on leave (video-room.tsx goReview → router.replace /review
  with { eventId }); eventId is the ONLY param (so the app-bar shows the static title +
  a "1 · 2"/"2 · 2" step chip, no date/time subtitle). Gentle progressive form, backend
  owns all logic — 4-phase machine: rating → comment → google → thanks. RATING: 1–5 stars;
  the kind:"rating" POST fires ON STAR TAP (not on Continuar) so the rating is saved the
  moment it's picked and the user can leave freely — re-tapping a different star re-POSTs
  (backend upserts, safe). It reads the server-decided showGoogleReview flag off that
  response (NEVER computed client-side); Continuar (enabled only after a rating save)
  advances. COMMENT (skippable): optional TextInput maxLength 1000 (contract limit; the
  design mock's 280 is superseded), live counter; "Enviar reseña" POSTs kind:"comment"
  only when non-empty, "Omitir" skips — both then branch showGoogleReview ? google :
  thanks. GOOGLE (only when showGoogleReview===true, so 1–3★ NEVER see it): accept POSTs
  kind:"google" action:"accept" then Linking.openURL(GOOGLE_REVIEW_URL); "Ahora no" (and
  header X) POSTs action:"decline" — the google POST is best-effort (a failure still
  proceeds to thanks, never traps the user). THANKS: check hero + star recap + "Volver al
  inicio" → router.replace /(tabs)/(home). Concurrent-submit guard via busyRef; failed
  rating/comment POSTs show an inline error (REVIEW_BOOKING_NOT_FOUND → friendly copy,
  else generic) and keep the user's selection/text for retry — never silently dropped.
  Strings in the review.* i18n namespace (ES+EN). NO pure-logic module (thin phase machine
  over api.postReview — unlike chat/payment; no new unit test). NO native dep / NO rebuild
  (pure JS + core Linking). GOOGLE_REVIEW_URL is a PLACEHOLDER in constants/config.ts.
  Validate app.json plugin changes with
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
├── review.tsx             — S16 Valoración post-clase (BUILT) (tab bar hidden)
├── add-to-calendar.tsx    — S19 Añadir al calendario         (modal)
├── (video)/               — route group holding the tab-bar-hidden video routes;
│   │                        _layout is a plain <Stack>. (ZoomVideoSdkProvider is an
│   │                        app-session singleton at the ROOT, not here — re-init on
│   │                        group re-entry crashes.) Parenthesized → URLs stay
│   │                        /video-prejoin, /video-room
│   ├── video-prejoin.tsx  — S14 Pre-unión · prueba de cámara/micro
│   └── video-room.tsx     — S15 Sala · en clase (Pass A: live video + controls +
│                             lifecycle + teardown; Pass B: in-session text chat via
│                             Supabase Realtime — components/video/chat-panel.tsx +
│                             lib/use-chat-session.ts + lib/chat.ts)
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
- `constants/config.ts` — `API_BASE` URL (production: https://www.gustavoai.dev);
  also `GOOGLE_REVIEW_URL` — the S16 "Dejar reseña en Google" target. PLACEHOLDER: the
  backend does NOT return this URL (the kind:"google" POST only records the accept/decline
  outcome), so replace it with the real Google Business review link before shipping.
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
- `lib/chat.ts` — pure in-session chat reconciliation (S15 Pass B; no React/Supabase):
  `mergeMessages()` unions backlog + live broadcasts deduped by `id`, sorted by message
  index; `parseMessageIndex()` parses "<eventId>:<index>". Unit-tested in
  `lib/__tests__/chat.test.ts`. Mirrors payment-confirmation's pure-core discipline.
- `lib/use-chat-session.ts` — S15 Pass B Realtime lifecycle hook (handshake → merge backlog →
  supabase.channel().on('broadcast').subscribe(); send via api.postChatSession; reconcile-on-
  SUBSCRIBED; idempotent teardown; unread count). CHAT-ONLY scope fence (never payments).
- `lib/notification-store.ts` — expo-secure-store wrapper (mirrors locale-store.ts)
  for the S18 notification PREFERENCE (`{ enabled, leadTimeMinutes }`) under
  `app.notification-prefs`. Local-only (no backend); `loadNotificationPrefs()` returns
  `DEFAULT_NOTIFICATION_PREFS` (enabled:false, leadTimeMinutes:10) when unset/corrupt.
  Preference only — scheduling is deferred (see S18 note).

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
- S01 sign-in screen built at `app/login.tsx`; sign-out now lives in its real home
  on S17 Perfil (and is also reachable from S18 Ajustes) — the temporary stub is gone
- Silent refresh on 401 DONE (A3): `refreshSession()` in lib/auth.ts re-fetches a
  Google idToken via `GoogleSignin.signInSilently()` (the cached-credentials path,
  NO picker) and re-exchanges it. SINGLE-FLIGHT: a module-level `_refreshInFlight`
  promise collapses concurrent 401s into exactly one refresh; all waiters retry
  with the one new token. api-client retries at most once (the `isRetry` flag).
  The hook is wired in lib/auth-context.tsx: on refresh success it mirrors the new
  session into React state. On failure the catch FORKS by AuthError code:
  `NO_SAVED_CREDENTIAL` (the ~30-day Google credential lapsed, no silent path) →
  KEEP the session + set the new `expired` flag, routing to S02 (session-expired)
  while preserving the user's identity for the "Continuar como" card; any other
  failure (network / backend reject) → sign out + `setSession(null)` → `/login`.
  Tested in `lib/__tests__/auth-refresh.test.ts` (single-flight, retry
  discipline, no-refresh-on-non-401, no-loop-on-failure).
  ANDROID LIMITATION: `signInSilently()` only works while Google still holds a
  cached credential for this install; if it returns `noSavedCredentialFound` there
  is no silent path → that's the NO_SAVED_CREDENTIAL → S02 path above.
- S02 session-expired re-login screen (app/session-expired.tsx) IS built —
  re-entry framing (icon badge + "Tu sesión ha caducado" + "Continuar como"
  identity card from session.user + the same native Google button as S01),
  fully localized via `sessionExpired.*` i18n keys; reuses `useAuth().signIn`
  (no auth reimplemented) with idle/connecting/error/offline states mirroring
  S01. REACHABILITY: auth-context now holds an `expired` boolean exposed via
  useAuth; app/_layout.tsx splits the signed-in guard into
  `isSignedIn && !expired` (tabs + full-screen experiences) vs
  `isSignedIn && expired` (session-expired only), so the lapsed-session route is
  reachable without clearing the session. On successful re-auth signIn() sets a
  fresh session + clears `expired` → guard flips back to the app. RETURN-TO-
  CONTEXT is land-on-Inicio (the (tabs) group remounts at its initial route): the
  routing captures no prior route, so true return-to-context is a marked TODO at
  the refresh hook in lib/auth-context.tsx. Reactive only — no proactive
  pre-expiry refresh. Cold restart self-heals (stale persisted session → first
  401 → refresh hook → expired again).

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
- LOCALIZED so far (everything else is still hardcoded Spanish): the 4 tab labels
  (app/(tabs)/_layout.tsx), the Home empty-state title + subtitle
  (app/(tabs)/(home)/index.tsx EmptyState), and the WHOLE Perfil tab — S17
  profile.tsx (`profile.*` keys) and S18 settings.tsx (`settings.*` keys). S18's
  ES/EN segmented control exercises setLocale end-to-end, reachable via the "Ajustes"
  row in S17 (profile.tsx → router.push settings); S18 shows its own header (the
  (profile) stack is headerShown:false) for the back button. Also localized: S14 pre-join
  (`prejoin.*`), S19 add-to-calendar (`addToCalendar.*`), and S15 video room (`room.*`).
  CLUSTER 1 (money / rule-bearing screens) is now localized: S12 cancel (`cancel.*`),
  S06 confirm & pay (`confirm.*`), S07 confirm-with-credit (`confirmCredit.*`), S08
  booking success (`success.*`), S09 packs catalog (`packs.*`), S10 pack pay (`packPay.*`).
  CLUSTER 2 (the booking flow) is now localized: S04 session-type (`sessionType.*`),
  S05 schedule/weekly grid (`schedule.*`, incl. the `schedule.legend.*` cell-state labels
  Available/Booked/Unavailable/Won't fit — noFit ES kept as "No válido"), S13 reschedule
  blocked-gate (`reschedule.*`), S11 booking-detail (`bookingDetail.*`). Cluster 2 PROMOTED
  to `common.*`: `back`, `book`, `reschedule`, `continue`, `backToDetail` (moved off
  `cancel.*`), plus the contact/soon-alert block (`cantAttendTitle/cantAttendBody/
  notifyGustavo/soonTitle/soonBody`) and the `common.timeRemaining.*` trio — all
  de-duplicated out of `cancel.*` (cancel.tsx now reads them from `common.*`), since S13
  reuses the same copy. New shared error: `errors.loadFailed` (with a `{what}` noun the
  screen supplies, e.g. `sessionType.pricesWord` / `schedule.availabilityWord`). S05 & S11
  DROPPED their hardcoded Spanish month/weekday arrays in favour of Intl via `bcp47(locale)`
  + `toLocaleDateString` (same Cluster-1 pattern; `formatEur` stays es-ES).
- KEY-NAMING CONVENTION (established with Cluster 1, applies to later clusters):
  `screen.section.element`. Strings repeated across ≥2 screens live in a shared
  `common.*` namespace (never duplicated per screen — e.g. `common.backHome`,
  `common.retry`, `common.yourBooking`, `common.tutorName/tutorSubtitle`,
  `common.duration1h/2h/15min`, `common.notePlaceholder`, `common.payPrice`/`retryPrice`);
  recurring error/failure copy lives in `errors.*` (`errors.checkoutInitTitle`,
  `errors.paymentRejectedTitle`, `errors.noConnection`, etc.). `t()` has NO built-in
  interpolation — put a `{token}` in the value and `.replace('{token}', v)` at the call
  site (mirrors `review.stepOfTwo`); plurals get two explicit keys (`…One`/`…Other`,
  as in `confirmCredit.credit.remainingOne/Other`). Sub-components that render strings
  call `useLocale()` themselves rather than threading `t` through props.
- DATE/DURATION LOCALIZATION: each money screen's local `formatDate`/`formatTimeRange`
  helpers now take the app `locale` and map it to a BCP-47 tag via a `bcp47(locale)`
  helper (`es`→'es-ES', `en`→'en-GB' — en-GB keeps the day-before-month order the
  Spanish uses); duration words come from `common.duration*`, not inline literals. NOTE
  euro formatting (`formatEur`) is deliberately left on `es-ES` — number formatting, not
  translated text; out of scope for this pass.
- KNOWN LIMITATION — the Stripe PaymentSheet (S06 confirm.tsx, S10 pay.tsx) does NOT
  follow the in-app language toggle: it is a NATIVE surface whose language comes from the
  Android OS/app locale (`Locale.getDefault()`), and `@stripe/stripe-react-native` 0.50.3
  exposes NO locale option (checked initPaymentSheet / presentPaymentSheet / StripeProvider
  / native PaymentSheet.Configuration). Our i18n is pure-JS (no expo-localization / no
  native locale) so the sheet can't see it. ACCEPTED AS-IS (2026-07-02): the sheet follows
  the device language. Forcing it to match would require a native module calling
  `AppCompatDelegate.setApplicationLocales(...)` + a DEV-CLIENT REBUILD, and that API
  recreates the Android activity (RN reload) so it can't fire mid-checkout — deferred, not
  worth the rebuild for a short standard payment surface.
- RULE-BEARING COPY kept faithful (verified against docs/design/design-brief.md Flow E):
  the paid-cancel refund line is extracted AS-IS — `cancel.refundBody` = "...en 1–3 días
  hábiles (menos la comisión de Stripe)." / "...within 1–3 business days (minus the Stripe
  fee)." (NO fee breakdown added; NOT softened to "minus fees"). Pack product names
  ("Pack Esencial"/"Pack Intensivo") are NOT translated — kept Spanish in both languages.
- Translate remaining screens incrementally via `useT()`/`t()` — add the keys to
  lib/i18n/strings.ts (both languages, enforced by the type) as you go.

### Out of scope for now
- Nothing pending — Zoom video (S14/S15) and the post-class review (S16, the last
  screen) are all built. Remaining follow-ups are the marked TODOs in the notes above
  (iOS permission requests / Podfile tweak, notification scheduling, S08→S11 goDetail
  wiring, and replacing the GOOGLE_REVIEW_URL placeholder).

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