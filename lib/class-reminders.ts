import type { Booking, SessionType } from '../types/api';
import type { NotificationPreferences } from './notification-store';

// Pure logic behind local class reminders. No React, no timers, no expo — `now`
// is injectable, so all of this is testable without a device (mirrors lib/history.ts
// and lib/payment-confirmation.ts). The effectful half lives in lib/notifications-native.ts.

/** Marker stashed in a notification's `content.data.kind` so we only ever touch
 *  reminders WE scheduled — never anything else the OS holds. */
export const REMINDER_KIND = 'class-reminder';

/** iOS caps pending local notifications at 64. Stay under it with headroom; the
 *  soonest reminders win when a user has more upcoming classes than this. */
export const MAX_SCHEDULED_REMINDERS = 60;

/** A reminder we WANT scheduled, derived from a booking + the user's prefs. */
export interface DesiredReminder {
  /** Stable booking identity (Booking.eventId). */
  eventId: string;
  /** When the reminder should fire, epoch ms — part of the identity. */
  fireAtMs: number;
  /** Class start, epoch ms — feeds the "{time}" copy token. */
  startsAtMs: number;
  sessionType: SessionType;
  /** The lead used to compute fireAtMs — feeds the "{lead}" copy token. */
  leadTimeMinutes: number;
}

/** A reminder currently scheduled with the OS (as read back from content.data). */
export interface ScheduledReminder {
  /** OS notification identifier, used to cancel. */
  identifier: string;
  eventId: string;
  fireAtMs: number;
}

export interface ReminderReconciliation {
  /** OS identifiers to cancel (stale / removed / re-timed / duplicate). */
  toCancelIds: string[];
  /** Reminders not yet scheduled that should be. */
  toSchedule: DesiredReminder[];
}

/** Composite identity: two reminders are "the same" iff same booking AND same fire
 *  time. A reschedule or a lead-time change moves fireAtMs → a different key, so the
 *  old one is cancelled and a fresh one scheduled. */
export function reminderKey(eventId: string, fireAtMs: number): string {
  return `${eventId}@${fireAtMs}`;
}

/**
 * The set of reminders we want given the current bookings and prefs. Pure.
 * Returns [] when notifications are disabled. Drops any whose fire time is not
 * strictly in the future (past classes, and classes already started). Sorts
 * soonest-first, de-dupes by key, and caps at MAX_SCHEDULED_REMINDERS.
 */
export function computeDesiredReminders(
  bookings: Booking[],
  prefs: NotificationPreferences,
  now: number = Date.now(),
): DesiredReminder[] {
  if (!prefs.enabled) return [];

  const leadMs = prefs.leadTimeMinutes * 60_000;
  const seen = new Set<string>();
  const desired: DesiredReminder[] = [];

  for (const b of bookings) {
    const startsAtMs = new Date(b.startsAt).getTime();
    const fireAtMs = startsAtMs - leadMs;
    if (fireAtMs <= now) continue; // strictly future — also drops started/past classes

    const key = reminderKey(b.eventId, fireAtMs);
    if (seen.has(key)) continue;
    seen.add(key);

    desired.push({
      eventId: b.eventId,
      fireAtMs,
      startsAtMs,
      sessionType: b.sessionType,
      leadTimeMinutes: prefs.leadTimeMinutes,
    });
  }

  desired.sort((a, b) => a.fireAtMs - b.fireAtMs);
  return desired.slice(0, MAX_SCHEDULED_REMINDERS);
}

/**
 * Diff the desired set against what's currently scheduled, keyed by reminderKey.
 * Reminders present in both are left untouched (idempotent no-op). Everything
 * scheduled but no longer desired is cancelled — this covers cancelled bookings,
 * lead-time changes, reschedules that moved the start, reminders now in the past,
 * and any duplicate entries sharing a key.
 */
export function reconcileReminders(
  desired: DesiredReminder[],
  scheduled: ScheduledReminder[],
): ReminderReconciliation {
  const desiredKeys = new Set(desired.map((d) => reminderKey(d.eventId, d.fireAtMs)));

  const keptKeys = new Set<string>();
  const toCancelIds: string[] = [];
  for (const s of scheduled) {
    const key = reminderKey(s.eventId, s.fireAtMs);
    // Cancel if no longer desired, or a duplicate of one we've already kept.
    if (!desiredKeys.has(key) || keptKeys.has(key)) {
      toCancelIds.push(s.identifier);
    } else {
      keptKeys.add(key);
    }
  }

  const toSchedule = desired.filter((d) => !keptKeys.has(reminderKey(d.eventId, d.fireAtMs)));

  return { toCancelIds, toSchedule };
}
