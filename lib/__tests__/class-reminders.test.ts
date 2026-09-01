import {
  MAX_SCHEDULED_REMINDERS,
  computeDesiredReminders,
  reconcileReminders,
  reminderKey,
  type DesiredReminder,
  type ScheduledReminder,
} from '../class-reminders';
import type { Booking } from '../../types/api';
import type { NotificationPreferences } from '../notification-store';

// Compact booking factory. Defaults to a future 1h class.
function booking(over: Partial<Booking> = {}): Booking {
  return {
    token: 'tok_1',
    joinToken: 'join_1',
    eventId: 'evt_1',
    sessionType: 'session1h',
    startsAt: '2026-07-13T15:00:00.000Z',
    endsAt: '2026-07-13T16:00:00.000Z',
    ...over,
  };
}

const NOW = new Date('2026-07-13T12:00:00.000Z').getTime();
const ON: NotificationPreferences = { enabled: true, leadTimeMinutes: 10 };

const MIN = 60_000;

describe('reminderKey', () => {
  it('composes eventId + fireAtMs and distinguishes differing values', () => {
    expect(reminderKey('evt_1', 100)).toBe('evt_1@100');
    expect(reminderKey('evt_1', 100)).not.toBe(reminderKey('evt_1', 200));
    expect(reminderKey('evt_1', 100)).not.toBe(reminderKey('evt_2', 100));
  });
});

describe('computeDesiredReminders', () => {
  it('returns [] when notifications are disabled', () => {
    const prefs: NotificationPreferences = { enabled: false, leadTimeMinutes: 10 };
    expect(computeDesiredReminders([booking()], prefs, NOW)).toEqual([]);
  });

  it('keeps a future class with fireAtMs = start − lead', () => {
    const start = new Date('2026-07-13T15:00:00.000Z').getTime();
    const desired = computeDesiredReminders([booking()], ON, NOW);
    expect(desired).toHaveLength(1);
    expect(desired[0].fireAtMs).toBe(start - 10 * MIN);
    expect(desired[0].startsAtMs).toBe(start);
    expect(desired[0].leadTimeMinutes).toBe(10);
    expect(desired[0].eventId).toBe('evt_1');
  });

  it('drops a reminder whose fire time is already in the past', () => {
    // starts in 5 min but lead is 10 → fireAt = 5 min ago
    const soon = new Date(NOW + 5 * MIN).toISOString();
    expect(computeDesiredReminders([booking({ startsAt: soon })], ON, NOW)).toEqual([]);
  });

  it('drops a class that has already started', () => {
    const started = booking({
      startsAt: new Date(NOW - 30 * MIN).toISOString(),
      endsAt: new Date(NOW + 30 * MIN).toISOString(),
    });
    expect(computeDesiredReminders([started], ON, NOW)).toEqual([]);
  });

  it('treats fireAtMs === now as not strictly future (dropped)', () => {
    // start exactly lead minutes from now → fireAt === now
    const start = new Date(NOW + 10 * MIN).toISOString();
    expect(computeDesiredReminders([booking({ startsAt: start })], ON, NOW)).toEqual([]);
  });

  it('re-times when the lead changes', () => {
    const start = new Date('2026-07-13T15:00:00.000Z').getTime();
    const at10 = computeDesiredReminders([booking()], { enabled: true, leadTimeMinutes: 10 }, NOW);
    const at30 = computeDesiredReminders([booking()], { enabled: true, leadTimeMinutes: 30 }, NOW);
    expect(at10[0].fireAtMs).toBe(start - 10 * MIN);
    expect(at30[0].fireAtMs).toBe(start - 30 * MIN);
  });

  it('sorts soonest-first', () => {
    const bookings = [
      booking({ eventId: 'late', startsAt: '2026-07-13T18:00:00.000Z' }),
      booking({ eventId: 'soon', startsAt: '2026-07-13T14:00:00.000Z' }),
      booking({ eventId: 'mid', startsAt: '2026-07-13T16:00:00.000Z' }),
    ];
    const desired = computeDesiredReminders(bookings, ON, NOW);
    expect(desired.map((d) => d.eventId)).toEqual(['soon', 'mid', 'late']);
  });

  it('caps at MAX_SCHEDULED_REMINDERS, keeping the soonest', () => {
    const bookings: Booking[] = [];
    // 80 future classes, one per hour starting 2h out
    for (let i = 0; i < 80; i++) {
      const start = new Date(NOW + (2 + i) * 60 * MIN).toISOString();
      bookings.push(booking({ eventId: `evt_${i}`, startsAt: start }));
    }
    const desired = computeDesiredReminders(bookings, ON, NOW);
    expect(desired).toHaveLength(MAX_SCHEDULED_REMINDERS);
    expect(desired[0].eventId).toBe('evt_0'); // soonest kept
    expect(desired[desired.length - 1].eventId).toBe(`evt_${MAX_SCHEDULED_REMINDERS - 1}`);
  });

  it('de-dupes bookings that resolve to the same key', () => {
    const dupe = booking();
    expect(computeDesiredReminders([dupe, { ...dupe }], ON, NOW)).toHaveLength(1);
  });
});

describe('reconcileReminders', () => {
  function desired(eventId: string, fireAtMs: number): DesiredReminder {
    return { eventId, fireAtMs, startsAtMs: fireAtMs + 10 * MIN, sessionType: 'session1h', leadTimeMinutes: 10 };
  }
  function scheduled(identifier: string, eventId: string, fireAtMs: number): ScheduledReminder {
    return { identifier, eventId, fireAtMs };
  }

  it('schedules a desired reminder that is not yet scheduled', () => {
    const { toSchedule, toCancelIds } = reconcileReminders([desired('evt_1', 1000)], []);
    expect(toCancelIds).toEqual([]);
    expect(toSchedule.map((d) => d.eventId)).toEqual(['evt_1']);
  });

  it('cancels a scheduled reminder no longer desired', () => {
    const { toSchedule, toCancelIds } = reconcileReminders([], [scheduled('id_1', 'evt_1', 1000)]);
    expect(toSchedule).toEqual([]);
    expect(toCancelIds).toEqual(['id_1']);
  });

  it('is a no-op when desired and scheduled match (idempotent)', () => {
    const { toSchedule, toCancelIds } = reconcileReminders(
      [desired('evt_1', 1000)],
      [scheduled('id_1', 'evt_1', 1000)],
    );
    expect(toSchedule).toEqual([]);
    expect(toCancelIds).toEqual([]);
  });

  it('cancels the old and schedules the new when a fire time moves (reschedule / lead change)', () => {
    const { toSchedule, toCancelIds } = reconcileReminders(
      [desired('evt_1', 2000)],
      [scheduled('id_old', 'evt_1', 1000)],
    );
    expect(toCancelIds).toEqual(['id_old']);
    expect(toSchedule.map((d) => d.fireAtMs)).toEqual([2000]);
  });

  it('cancels everything when disabled (empty desired, non-empty scheduled)', () => {
    const { toSchedule, toCancelIds } = reconcileReminders(
      [],
      [scheduled('id_1', 'evt_1', 1000), scheduled('id_2', 'evt_2', 2000)],
    );
    expect(toSchedule).toEqual([]);
    expect(toCancelIds).toEqual(['id_1', 'id_2']);
  });

  it('cancels a duplicate scheduled entry sharing a key', () => {
    const { toSchedule, toCancelIds } = reconcileReminders(
      [desired('evt_1', 1000)],
      [scheduled('id_a', 'evt_1', 1000), scheduled('id_b', 'evt_1', 1000)],
    );
    expect(toSchedule).toEqual([]); // one already covers it
    expect(toCancelIds).toEqual(['id_b']); // the extra is cancelled
  });
});
