# Mobile App — Design Brief

A self-contained brief for designing the v1.0 mobile app for **gustavoai.dev**.
Synthesized from the inventory documents in this folder (`web-actions.md`,
`data-model.md`, `brand.md`, `flows.md`, `scope-decisions.md`). You do not need
the source code to use this document; everything required to design the screens
is here.

> **Status of decisions:** the six questions that were open in earlier drafts are
> now resolved. Their decisions are folded into the relevant sections below and
> recorded, with rationale, in **§8 (Resolved decisions)**.

---

## 1. Product context

gustavoai.dev is a one-on-one tutoring service run by a single tutor, **Gustavo**,
teaching AI and technical subjects through live video classes. A student signs in,
sees the tutor's real availability, books an individual class — a paid single
session (1 hour or 2 hours) or a session paid from a prepaid credit pack of 5 or 10
classes — and joins it over video at the scheduled time. (A free 15-minute trial
also exists, but it is **web-only** and is not bookable in the mobile app — see §2.)
Payment is by card through Stripe; video happens in an in-app room with chat, mute,
and camera controls; after class the student is asked for a quick star rating. The
brand is personal: this is *Gustavo's* tutoring, not a faceless marketplace — show
his name, not "your tutor."

---

## 2. Scope

### Platform

**v1.0 ships Android-only (Google Play).** iOS is deferred to a later version. This
keeps launch to a single platform and sidesteps Apple's stricter store rules for
v1.0 — but it **defers, not deletes,** the iOS-specific work: Sign in with Apple
(guideline 4.8) and the Apple in-app-purchase question return when iOS ships. See
§8, Q7. Practically, this means: **Google Pay only** (no Apple Pay) and **Play Store**
listings/metadata, not the App Store.

### In scope for MVP

User actions the v1.0 app must support:

- **Sign in with Google** and **sign out**.
- **Browse availability** — see open class slots for a chosen date.
- **Book a single session** — 1-hour or 2-hour, paid by card.
- **Book using pack credits** — spend one prepaid credit, no payment step.
- **View a booking's detail** — date, time, duration, the student's note, and the
  per-booking actions (join, cancel, reschedule, add to calendar).
- **Cancel a booking.**
- **Reschedule a booking** — move it to a new slot of the same type without paying
  again.
- **View upcoming bookings** (the home screen).
- **Buy a credit pack** — 5 or 10 sessions.
- **View credit balance.**
- **Join a video class**, including **in-session chat** and a **pre-join
  camera/microphone test**.
- **Leave a review** after a session (star rating + optional comment).

Mobile-only capabilities that are also MVP:

- **Push notification** — "your class starts in 10 minutes."
- **Push notification** — "booking confirmed."
- **Add a booking to the device's native calendar.**

### Explicitly out of scope

Considered and deliberately cut from v1.0. Knowing what was rejected matters as
much as what was kept — do not design entry points for these:

- **Free 15-minute trial booking** — kept web-first (deferred).
- **View past bookings** and **view your own reviews** — deferred.
- **View payment history / receipts** — web only.
- **Edit name** — deferred (name comes from the Google profile).
- **Delete account** — was cut as web-only in v1.0 scope; **now shipped in-app**
  (S21, entered from S18 Ajustes) because Apple 5.1.1(v) and Google Play's
  data-deletion policy require in-app deletion for apps that support account
  creation. See docs/DEVLOG.md ADR-9.
- **All admin actions** — no admin panel on mobile.
- **Later-tier mobile extras** — credit-pack-expiring push, biometric unlock,
  home-screen widget, offline view of bookings. Out for v1.0.

---

## 3. Users

**The student** is the only user in MVP scope.

- **Device & context:** a phone, used at home or on the move — checking the next
  class between or on the way to other commitments. Sessions themselves are taken
  on whatever device is handy, but planning and reminders happen on the phone.
- **Frequency:** low and bursty. A student might buy a pack, book a couple of
  classes, then not open the app for days. The home screen has to answer "when is
  my next class, and do I have credits left?" at a glance — so when the user holds
  credits, the **balance is shown clearly on the home screen.**
- **Sophistication:** adult learners who value substance — they came for a
  technical tutor, not a gamified app.

The **tutor (Gustavo)** is intentionally *not* a mobile user in v1.0: he needs a
real computer to screen-share during class, so he runs sessions from the web app.
Admins are web-only. The app is **students-only** — there are no tutor- or
admin-specific screens in v1.0.

### 3a. Navigation model

The app uses a **bottom tab bar** with **four tabs** — the small, fixed set of
destinations and the low, bursty usage suit a flat, always-visible structure better
than a drawer or a stack of nested menus:

- **Inicio (Home)** — next class, upcoming bookings, and the credit balance.
- **Reservar (Book)** — the booking flow: session type → calendar → confirm.
- **Packs** — buy a 5- or 10-session pack; see balance and expiry.
- **Perfil (Profile)** — account, **Settings**, and sign out.

Full-screen, focused experiences launch **over** the tabs rather than living as
tabs of their own: the **video class** room, the **post-class review**, and the
**re-login** screen. There is **no AI-assistant tab** in v1.0 (see §8, Q1).

---

## 4. Brand

The design system is called **Emerald Nocturne**. It is **dark-only** — no
light-mode palette exists anywhere in the current product, and mobile stays
dark-only too (see §8, Q3). All values below are exact.

**Color — emerald accent (the one bright color):**

- Primary `#4edea3` — CTAs, focus rings, active states, the user's own chat bubble.
- Primary hover/pressed `#10b981`.
- Text on emerald `#003824` (dark green, for labels sitting on a primary button).

**Color — surfaces (near-black; lighter = higher/closer layer):**

- Page background `#131315`.
- Cards, inputs, incoming chat bubbles `#201f22`.
- Popovers, tooltips, floating elements `#353437`.

**Color — text:**

- Body & headings `#e5e1e4`.
- Secondary / descriptions `#bbcabf`.
- Placeholders & hints `#86948a`.

**Color — status:**

- Error `#ffb4ab`. Warning `#fbbf24`.

**Typography:**

- **Manrope** — headlines (weights 600, 700, 800).
- **Inter** — body, UI, and labels (weights 300–600).
- **Material Symbols Outlined** — icons.
- Default body line-height is `1.65`. Section labels use an uppercase overline
  pattern (11px, letter-spacing, `#86948a`).

**Shape:**

- Corners are deliberately sharp: **2px default radius**, ~6px on buttons, 8–12px
  on cards, fully rounded for pills, avatars, and the chat button.

**Signature touches:**

- A soft emerald glow ("orb") at the top of the page.
- A very faint dot-grid texture across the background.
- A 2px emerald focus ring with offset.

**Personality (lead with these):** **Precise · Technical · Credible · Focused ·
Premium.** Monochrome dark base + a single emerald accent + sharp corners +
exact numbers signal substance over decoration. The glow and emerald keep it
modern and premium without softening the data-forward austerity.

**Voice:** semi-formal Spanish, direct address, no slang. Short punchy taglines
with a contrasting second clause; social proof as exact figures ("4.700 clases",
"4.9/5"); pack names that signal aspiration within reach ("Pack Esencial", "Pack
Intensivo").

---

## 5. Key flows

User-facing steps only. For each flow, the **states that need their own screen or
treatment** (loading, empty, error, permission) are called out — these are easy to
forget and they are where the design earns its keep.

### Flow A — Sign in with Google

1. User opens the app and taps a native **Sign in with Google** button.
2. The system Google account picker appears.
3. On success, the user lands on the home screen (upcoming bookings).

**States:** loading (during sign-in); error ("couldn't sign in, try again");
the signed-out landing screen itself.

### Flow B — Book a single session (pay per class)

1. User **chooses the session type first — 1 hour or 2 hours.** (Choosing the
   duration up front is what lets the calendar show only slots that can actually
   fit it.)
2. User picks a date.
3. App shows the open time slots for that date, in the user's timezone, **filtered
   to the chosen duration** — for a 2-hour session, slots without enough room are
   not offered, so the user can never pick a 2-hour time that won't fit.
4. User reviews the price and pays by card (Stripe payment sheet, with Google Pay
   where available).
5. On success, a confirmation screen shows the class date, time, and how to join —
   and offers **"add to calendar."**

**Decision points & states:**
- **Empty slots** — a chosen date can legitimately have *no* bookable slots:
  the tutor doesn't work that day, the day is fully booked, or every remaining
  slot is inside the 5-hour minimum-notice cutoff. Design one clear empty state
  that doesn't read as an error.
- **Loading** — fetching availability after a date tap.
- **Payment error / card declined** — return the user to the payment step so they
  can retry.
- **Slot taken while booking** — someone booked the same slot first; show "that
  time was just taken" and send the user back to slot selection.

### Flow C — Buy a credit pack

1. User chooses a **5-** or **10-session** pack.
2. User pays by card (Stripe sheet; Google Pay where available).
3. App shows a brief **"confirming your payment"** state — activation is **not
   instant**; the credits appear a moment after payment succeeds.
4. Balance updates and the app offers "book a class now."

**States:** the asynchronous confirming state in step 3 is mandatory — do not show
credits as available before they are; payment error; success with updated balance.

### Flow D — Book using pack credits

1. **No session-type step** — a pack class is always **1 hour** and spends exactly
   **one credit.** The user goes straight to picking a date.
2. App shows the open 1-hour slots for that date, in the user's timezone.
3. User confirms — **no payment step**; one credit is spent.
4. Confirmation screen as in Flow B (with "add to calendar").

**Decision point:** if the user has **zero credits or only expired credits**,
this path is unavailable — surface a cross-sell to buy a pack (Flow C) instead of
a dead end. Same empty-slots and slot-taken states as Flow B.

### Flow E — Cancel a booking

1. From the **booking detail**, the user taps **Cancel**.
2. A confirmation dialog explains the consequence and surfaces the **2-hour rule**
   (a class can only be cancelled **more than 2 hours** before it starts).
3. On confirm:
   - **Paid single session** — the booking is released; the **refund is handled
     manually by Gustavo** (the Stripe processing fee is non-refundable). Copy must
     set this expectation — the refund is **not instant or automatic.**
   - **Pack session** — the **credit is automatically returned** to the user's
     balance.

**States:** **outside the window** — if the class starts in ≤ 2 hours, the cancel
action is blocked with a clear explanation, not a silent failure; success (with the
paid-vs-pack message above); error.

### Flow F — Reschedule a booking

1. From the **booking detail**, the user taps **Reschedule**.
2. The user picks a **new slot of the same type** (a 1-hour booking moves to a
   1-hour slot; a pack credit stays a pack credit). The duration is fixed — the
   user is not re-choosing session type.
3. The user confirms. **There is no new payment** — a paid session keeps its
   original payment, and a pack credit nets out (the old slot's credit is freed and
   the new one consumed). This is the whole point of reschedule over cancel + rebook:
   the payment carries over.

**Decision points & states:**
- **Outside the window** — reschedule is only allowed **more than 2 hours** before
  the original class starts; otherwise block with an explanation.
- **Slot taken** — the new slot was claimed first; return to slot selection.
- **Empty slots** — same empty state as Flow B.

### Flow G — Join a video class

1. User opens the class from the upcoming list, the booking detail, or a push
   notification.
2. App requests **camera and microphone permission** (first time).
3. **Pre-join screen:** preview video, pick camera/mic, then tap **Enter**.
4. In the room: controls for **mute**, **camera on/off**, **chat**, and **leave**.
5. On leaving, the user is taken to the post-class review (Flow H).

**States:**
- **Permission denied** — a recovery screen explaining the class needs camera/mic
  and how to re-enable in settings.
- **Waiting for the tutor** — the student may arrive first; show a calm waiting
  state rather than an empty room.
- **Joining / connecting** loading state.

### Flow H — Review after a session

1. Immediately after leaving, the user sees a **1–5 star** rating prompt.
2. After rating, an **optional comment** field (skippable).
3. **Only if the rating is 4 or 5**, a "leave a Google review" prompt appears,
   with a clear **skip**.

**Decision points & states:** low ratings (1–3) never show the Google prompt;
every step after the first star is skippable; design the "thanks / done" end state.

### Flow I — Add a booking to the native calendar

1. The option appears in two places: on the **booking confirmation** screen and on
   the **booking detail**.
2. On first use, the app requests **calendar permission.**
3. On grant, the class (date, time, duration, join link) is written to the device
   calendar.

**States:** **permission denied** — explain why the class can't be added and point
to where calendar access can be granted (Settings); success; error.

### Flow J — Session expired (re-authentication)

A signed-in session lasts **30 days** (see §6). When it lapses, the app shows a
**re-login screen** prompting Sign in with Google again. Do **not** interrupt the
user mid-task — surface the re-login at a natural boundary, and return the user to
where they were once signed back in.

---

## 6. Constraints

Technical realities the design must respect:

- **Auth is Google Sign-In.** A native Google sign-in button must be present.
  Sessions last 30 days before the user must sign in again (see Flow J).
- **Payment is Stripe.** Use the native **Google Pay** button where supported, with
  card entry as the fallback. (Apple Pay is out for v1.0 — Android-only; see §2.)
- **Video is the Zoom Video SDK.** Camera/microphone **permission flows are
  required**. The room is created when the first person joins — the student may
  enter before the tutor, so a "waiting for tutor" state is real, not theoretical.
- **Native permissions beyond camera/mic.** Two more OS permission flows must be
  designed: **notifications** (requested when the user enables push in Settings —
  see below) and **calendar** (requested the first time the user adds a booking to
  the device calendar — Flow I). Each needs a granted path and a denied/recovery path.
- **Backend is the existing web API.** **No new endpoints are being built in this
  phase.** Design only against data the current app already returns — notably:
  past/completed bookings and review history are *not* available to mobile yet
  (which is why they're out of scope in §2). **Reschedule reuses the existing
  booking endpoint** (it is a normal booking that carries the original booking's
  token), so it needs no new backend — see Flow F.
- **Time rules that must be visible to the user, at the moment they matter:**
  - A class can only be booked **≥ 5 hours** in advance — show this where empty
    same-day slots would otherwise look like a bug.
  - A class can only be cancelled **more than 2 hours** before it starts — surface
    this at the cancel action, not buried in terms (Flow E).
  - A class can only be rescheduled **more than 2 hours** before it starts — same
    window as cancel (Flow F).
  - **Credit packs expire 180 days (6 months) after purchase** — show remaining
    time so credits don't quietly die.
- **Language: the app is bilingual (Spanish + English).** Spanish is the default;
  English content already exists on the web and is inherited rather than written
  from scratch (see §8, Q2). Do not hard-code Spanish-only strings, and remember
  the **Play Store listing needs per-language metadata.**

---

## 7. Settings

Settings lives under the **Perfil (Profile)** tab and is where the user manages
permissions and account:

- **Push notifications** — a single enable/disable toggle. When the user enables it
  and the OS permission isn't yet granted, request it then. Includes a
  **reminder lead time** for the "class starting soon" notification — **default 10
  minutes**, user-adjustable.
- **Calendar access** — the grant point for the calendar permission used by Flow I.
- **Language** — Spanish / English.
- **Sign out.**

There is intentionally **no timezone setting** — the app shows times in the device's
own timezone and the schedule is fixed on the tutor's side; the user never picks a
timezone.

---

## 8. Resolved decisions

The questions that were open in earlier drafts, with the decision taken and the
reasoning behind it.

**Q1 — Is the AI assistant in or out?** → **Out for v1.0.**
The web app has an AI chat assistant. It's a potential differentiator, but its
product value is unproven (no engagement metrics yet) and a persistent chat icon
adds UI weight to every screen. It can be added in a later release without blocking
any core flow. (Cost would have been bounded by existing rate/spend caps — not the
deciding factor.)

**Q2 — Spanish only, or also English?** → **Both, from launch.**
The web app is already fully bilingual (Spanish + English via next-intl), with
translated content maintained in both languages, so English copy is **inheritable
rather than net-new** — the earlier "all copy is Spanish literals" premise was
wrong. Shipping bilingual from day one widens the audience for little extra cost.
Note the per-language Play Store metadata requirement (§6).

**Q3 — Theme: dark, light, or both?** → **Dark only.**
The entire current design system is dark-only — there are no light-mode color
tokens, so adding light would be its own effort. Keeping mobile dark-only matches
the web exactly and keeps the two platforms consistent.

**Q4 — Who can use the app?** → **Students only.**
The tutor needs a computer to screen-share anyway, and admin tasks are infrequent
and fine on web. Adding "is this the tutor/admin?" branching would multiply the
design work for little gain.

**Q5 — Sign-up: Google only, or also email/Apple?** → **Google only.**
The user base already signs in with Google; email/password would add reset,
verification, and recovery flows. Because v1.0 is **Android-only** (Q7), Apple's
guideline **4.8 (Login Services)** does not apply at launch. **It returns when iOS
ships:** 4.8 may *require* an equivalent privacy-focused login (e.g. Sign in with
Apple) whenever a third-party login like Google is offered. So design the sign-in
screen (Flow A) so a second provider button could be added later without a redesign.

**Q6 — Reschedule on mobile?** → **Yes, in MVP.**
Rescheduling is a common need, and doing it in-app preserves the original payment
(cancel + rebook loses that). It is **feasible without new backend work**: it reuses
the existing booking endpoint, passing the original booking's token so the old slot
is released and no second charge is made (see Flow F and §6).

**Q7 — Which platforms at launch?** → **Android only for v1.0; iOS later.**
Shipping a single platform first cuts build/test/store-submission effort and avoids
Apple's stricter rules at launch (no Sign in with Apple requirement, no Apple Pay,
Play Store instead of App Store — see §2). The cost is excluding iPhone users at
launch (a non-trivial share in Spain) and **deferring** rather than removing the
iOS-specific work, which returns in a later version: Sign in with Apple (Q5) and
Apple's in-app-purchase rules. **Note this is not a free pass on payments even on
Android:** Google Play's Payments policy has its own billing requirement for in-app
digital goods, so the **credit-pack purchase (Flow C) still needs a check against
Google Play's policy** — the real-world/live-service exemption likely covers it, but
confirm before submission. (This question was not in earlier drafts — added after the
Android-first decision.)

---

## 9. Out of scope for this brief

This brief deliberately does **not** specify:

- **Specific screen layouts** — that's the design tool's job.
- **Animation specifics** — timing, easing, motion choreography.
- **Specific iconography** — default to platform/system icons unless a flow needs
  otherwise.
- **Marketing site and Play Store assets** — screenshots, store copy, promo art.
