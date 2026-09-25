import {
  CALENDAR_LOOKAHEAD_MS,
  computeDesiredCalendarEvents,
  parseJoinToken,
  reconcileCalendarEvents,
  type DesiredCalendarEvent,
  type ExistingCalendarEvent,
} from '../calendar-events';
import type { Booking } from '../../types/api';

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
const START = new Date('2026-07-13T15:00:00.000Z').getTime();
const END = new Date('2026-07-13T16:00:00.000Z').getTime();
const HOUR = 3_600_000;

function desired(over: Partial<DesiredCalendarEvent> = {}): DesiredCalendarEvent {
  return { joinToken: 'join_1', startsAtMs: START, endsAtMs: END, sessionType: 'session1h', ...over };
}

function existing(over: Partial<ExistingCalendarEvent> = {}): ExistingCalendarEvent {
  return { id: 'cal_1', joinToken: 'join_1', startsAtMs: START, endsAtMs: END, ...over };
}

describe('parseJoinToken', () => {
  it('reads the token out of a join URL in location', () => {
    expect(parseJoinToken('https://gustavoai.dev/es/sesion/abc-123_XYZ', null)).toBe('abc-123_XYZ');
  });

  it('is locale-independent (the URL prefix may be /es/ or /en/)', () => {
    expect(parseJoinToken('https://gustavoai.dev/en/sesion/abc', null)).toBe('abc');
  });

  it('falls back to the notes when location carries no URL', () => {
    const notes = 'Únete a tu clase:\nhttps://gustavoai.dev/es/sesion/from_notes';
    expect(parseJoinToken('', notes)).toBe('from_notes');
    expect(parseJoinToken(null, notes)).toBe('from_notes');
  });

  it('prefers location over notes', () => {
    expect(
      parseJoinToken('https://x/es/sesion/loc', 'https://x/es/sesion/note'),
    ).toBe('loc');
  });

  it('stops at query / fragment / whitespace', () => {
    expect(parseJoinToken('https://x/es/sesion/tok?utm=1', null)).toBe('tok');
    expect(parseJoinToken('https://x/es/sesion/tok#top', null)).toBe('tok');
    expect(parseJoinToken(null, 'see https://x/es/sesion/tok now')).toBe('tok');
  });

  it('returns null for an event that is not ours', () => {
    expect(parseJoinToken('Room 4', 'Dentist')).toBeNull();
    expect(parseJoinToken(null, undefined)).toBeNull();
    expect(parseJoinToken('https://x/es/sesion/', null)).toBeNull();
  });
});

describe('computeDesiredCalendarEvents', () => {
  it('maps a future booking to a desired event', () => {
    expect(computeDesiredCalendarEvents([booking()], NOW)).toEqual([
      { joinToken: 'join_1', startsAtMs: START, endsAtMs: END, sessionType: 'session1h' },
    ]);
  });

  it('keeps a class that is in progress (ends in the future)', () => {
    const b = booking({
      startsAt: new Date(NOW - 20 * 60_000).toISOString(),
      endsAt: new Date(NOW + 40 * 60_000).toISOString(),
    });
    expect(computeDesiredCalendarEvents([b], NOW)).toHaveLength(1);
  });

  it('drops a class that has already ended — past events are left as history', () => {
    const b = booking({
      startsAt: new Date(NOW - 2 * HOUR).toISOString(),
      endsAt: new Date(NOW - HOUR).toISOString(),
    });
    expect(computeDesiredCalendarEvents([b], NOW)).toEqual([]);
  });

  it('drops a booking without a join token (nothing to key on)', () => {
    expect(computeDesiredCalendarEvents([booking({ joinToken: '' })], NOW)).toEqual([]);
  });

  it('drops a booking with an unparseable date', () => {
    expect(computeDesiredCalendarEvents([booking({ startsAt: 'nope' })], NOW)).toEqual([]);
  });

  it('de-dupes by join token and sorts by start', () => {
    const later = booking({
      joinToken: 'join_2',
      startsAt: new Date(START + 24 * HOUR).toISOString(),
      endsAt: new Date(END + 24 * HOUR).toISOString(),
    });
    const out = computeDesiredCalendarEvents([later, booking(), booking()], NOW);
    expect(out.map((d) => d.joinToken)).toEqual(['join_1', 'join_2']);
  });

  it('exposes a lookahead window of one year', () => {
    expect(CALENDAR_LOOKAHEAD_MS).toBe(365 * 24 * HOUR);
  });
});

describe('reconcileCalendarEvents', () => {
  it('is a no-op when the calendar already matches', () => {
    expect(reconcileCalendarEvents([desired()], [existing()])).toEqual({
      toDeleteIds: [],
      toUpdate: [],
      toCreate: [],
    });
  });

  it('creates an event for a new booking', () => {
    const out = reconcileCalendarEvents([desired()], []);
    expect(out.toCreate).toEqual([desired()]);
    expect(out.toDeleteIds).toEqual([]);
    expect(out.toUpdate).toEqual([]);
  });

  it('deletes an event whose booking is gone (cancelled anywhere)', () => {
    const out = reconcileCalendarEvents([], [existing()]);
    expect(out.toDeleteIds).toEqual(['cal_1']);
    expect(out.toCreate).toEqual([]);
  });

  it('updates in place when the same booking moved (reschedule keeping the token)', () => {
    const moved = desired({ startsAtMs: START + HOUR, endsAtMs: END + HOUR });
    const out = reconcileCalendarEvents([moved], [existing()]);
    expect(out.toUpdate).toEqual([{ id: 'cal_1', desired: moved }]);
    expect(out.toDeleteIds).toEqual([]);
    expect(out.toCreate).toEqual([]);
  });

  it('deletes the old and creates the new when a reschedule issued a new token', () => {
    const fresh = desired({ joinToken: 'join_2', startsAtMs: START + HOUR, endsAtMs: END + HOUR });
    const out = reconcileCalendarEvents([fresh], [existing()]);
    expect(out.toDeleteIds).toEqual(['cal_1']);
    expect(out.toCreate).toEqual([fresh]);
    expect(out.toUpdate).toEqual([]);
  });

  it('keeps the first of duplicate events for one token and deletes the rest', () => {
    const dup = existing({ id: 'cal_dup' });
    const out = reconcileCalendarEvents([desired()], [existing(), dup]);
    expect(out.toDeleteIds).toEqual(['cal_dup']);
    expect(out.toCreate).toEqual([]);
  });

  it('still updates the kept duplicate when it drifted', () => {
    const moved = desired({ startsAtMs: START + HOUR, endsAtMs: END + HOUR });
    const out = reconcileCalendarEvents([moved], [existing(), existing({ id: 'cal_dup' })]);
    expect(out.toUpdate).toEqual([{ id: 'cal_1', desired: moved }]);
    expect(out.toDeleteIds).toEqual(['cal_dup']);
  });

  it('handles a mixed set in one pass', () => {
    const keep = desired();
    const moved = desired({ joinToken: 'join_m', startsAtMs: START + HOUR, endsAtMs: END + HOUR });
    const fresh = desired({ joinToken: 'join_new' });
    const out = reconcileCalendarEvents(
      [keep, moved, fresh],
      [
        existing(),
        existing({ id: 'cal_m', joinToken: 'join_m' }),
        existing({ id: 'cal_gone', joinToken: 'join_gone' }),
      ],
    );
    expect(out.toDeleteIds).toEqual(['cal_gone']);
    expect(out.toUpdate).toEqual([{ id: 'cal_m', desired: moved }]);
    expect(out.toCreate).toEqual([fresh]);
  });
});
