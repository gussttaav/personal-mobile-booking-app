import type { Booking, SessionType } from '../types/api';

// Pure logic behind the automatic device-calendar mirror of the user's bookings.
// No React, no expo — `now` is injectable, so all of this is testable without a
// device (mirrors lib/class-reminders.ts). The effectful half — the ONLY module
// that reads/writes calendar events — lives in lib/calendar-native.ts.
//
// IDENTITY: a calendar event is "ours" iff it carries a class join URL
// (`…/sesion/<joinToken>`) in its location or notes — the same URL every event we
// write already holds, so no local id map and no extra visible marker is needed.
// `joinToken` (not `eventId`) is the key because it is always present on a
// booking, whereas `eventId` may be '' when no backend calendar event was created.

/** The window we read back from the calendar: only future events are ever
 *  reconciled, so a past class stays in the user's calendar as history. */
export const CALENDAR_LOOKAHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const JOIN_TOKEN_RE = /\/sesion\/([^\s/?#]+)/;

/** Pull the join token out of an event's location (preferred) or notes. `null`
 *  when neither carries a join URL — i.e. the event is not one of ours. */
export function parseJoinToken(
  location: string | null | undefined,
  notes: string | null | undefined,
): string | null {
  for (const text of [location, notes]) {
    if (!text) continue;
    const m = JOIN_TOKEN_RE.exec(text);
    if (m) return m[1];
  }
  return null;
}

/** A calendar event we WANT, derived from a booking. */
export interface DesiredCalendarEvent {
  /** Stable booking identity (Booking.joinToken). */
  joinToken: string;
  startsAtMs: number;
  endsAtMs: number;
  sessionType: SessionType;
}

/** One of OUR events currently in the device calendar (join token parsed back). */
export interface ExistingCalendarEvent {
  /** Device calendar event id, used to update / delete. */
  id: string;
  joinToken: string;
  startsAtMs: number;
  endsAtMs: number;
}

export interface CalendarReconciliation {
  /** Device event ids to delete (booking gone / cancelled, or a duplicate). */
  toDeleteIds: string[];
  /** Existing events whose start/end drifted from the booking — move in place. */
  toUpdate: { id: string; desired: DesiredCalendarEvent }[];
  /** Bookings with no event yet. */
  toCreate: DesiredCalendarEvent[];
}

/**
 * The set of events we want given the current bookings. Pure. Keeps only classes
 * that have not ended yet (in-progress included — it still overlaps the read
 * window), drops bookings without a join token (nothing to key on), and de-dupes
 * by token. Order is by start time.
 */
export function computeDesiredCalendarEvents(
  bookings: Booking[],
  now: number = Date.now(),
): DesiredCalendarEvent[] {
  const seen = new Set<string>();
  const desired: DesiredCalendarEvent[] = [];

  for (const b of bookings) {
    if (!b.joinToken) continue;
    const startsAtMs = new Date(b.startsAt).getTime();
    const endsAtMs = new Date(b.endsAt).getTime();
    if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) continue;
    if (endsAtMs <= now) continue;
    if (seen.has(b.joinToken)) continue;
    seen.add(b.joinToken);
    desired.push({ joinToken: b.joinToken, startsAtMs, endsAtMs, sessionType: b.sessionType });
  }

  desired.sort((a, b) => a.startsAtMs - b.startsAtMs);
  return desired;
}

/**
 * Diff the desired set against OUR events read back from the calendar, keyed by
 * join token. Same token + same times → untouched (idempotent no-op). Same token
 * but moved times → update in place (a backend that reschedules the same booking).
 * Token no longer desired → delete (cancelled anywhere, incl. on the web; or a
 * reschedule that issued a new booking — whose new token lands in toCreate). A
 * second event sharing a token is a duplicate → delete.
 */
export function reconcileCalendarEvents(
  desired: DesiredCalendarEvent[],
  existing: ExistingCalendarEvent[],
): CalendarReconciliation {
  const desiredByToken = new Map(desired.map((d) => [d.joinToken, d]));

  const kept = new Set<string>();
  const toDeleteIds: string[] = [];
  const toUpdate: CalendarReconciliation['toUpdate'] = [];
  for (const e of existing) {
    const want = desiredByToken.get(e.joinToken);
    if (!want || kept.has(e.joinToken)) {
      toDeleteIds.push(e.id);
      continue;
    }
    kept.add(e.joinToken);
    if (want.startsAtMs !== e.startsAtMs || want.endsAtMs !== e.endsAtMs) {
      toUpdate.push({ id: e.id, desired: want });
    }
  }

  const toCreate = desired.filter((d) => !kept.has(d.joinToken));

  return { toDeleteIds, toUpdate, toCreate };
}
