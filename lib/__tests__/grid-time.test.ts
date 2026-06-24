import type { AvailabilitySlot, GetScheduleResponse } from '../../types/api';
import {
  addDays,
  buildGridModel,
  civilWeekday,
  dateKey,
  minutesInTz,
  mondayOf,
  partsInTz,
  weekColumns,
  zonedTimeToUtc,
} from '../grid-time';

// ── tz primitives ─────────────────────────────────────────────────────────────

describe('partsInTz / minutesInTz', () => {
  it('renders the same instant in different zones', () => {
    const instant = new Date('2026-06-24T07:00:00.000Z');
    expect(partsInTz(instant, 'America/New_York').hour).toBe(3); // EDT, UTC-4
    expect(partsInTz(instant, 'Europe/Madrid').hour).toBe(9); // CEST, UTC+2
  });

  it('computes minutes since local midnight', () => {
    const instant = new Date('2026-06-24T07:30:00.000Z');
    expect(minutesInTz(instant, 'Europe/Madrid')).toBe(9 * 60 + 30);
  });
});

describe('zonedTimeToUtc', () => {
  it('inverts partsInTz', () => {
    const utc = zonedTimeToUtc({ year: 2026, month: 6, day: 24, hour: 3 }, 'America/New_York');
    expect(utc.toISOString()).toBe('2026-06-24T07:00:00.000Z');
  });

  it('is correct across a DST gap (US spring-forward 2026-03-08 02:00→03:00)', () => {
    // 02:30 local does not exist; the helper still returns a sane instant.
    const utc = zonedTimeToUtc({ year: 2026, month: 3, day: 8, hour: 3 }, 'America/New_York');
    expect(partsInTz(utc, 'America/New_York').hour).toBe(3);
  });
});

// ── civil-date helpers ──────────────────────────────────────────────────────

describe('civil-date helpers', () => {
  it('adds days across a month boundary', () => {
    expect(addDays({ year: 2026, month: 6, day: 30 }, 1)).toEqual({ year: 2026, month: 7, day: 1 });
  });

  it('finds the Monday of a week', () => {
    // 2026-06-24 is a Wednesday → Monday is 2026-06-22.
    expect(civilWeekday({ year: 2026, month: 6, day: 24 })).toBe(3);
    expect(mondayOf({ year: 2026, month: 6, day: 24 })).toEqual({ year: 2026, month: 6, day: 22 });
  });

  it('builds 7 Mon→Sun columns for a week offset', () => {
    const cols = weekColumns({ year: 2026, month: 6, day: 24 }, 0);
    expect(cols).toHaveLength(7);
    expect(dateKey(cols[0])).toBe('2026-06-22'); // Mon
    expect(dateKey(cols[6])).toBe('2026-06-28'); // Sun
    expect(dateKey(weekColumns({ year: 2026, month: 6, day: 24 }, 1)[0])).toBe('2026-06-29');
  });
});

// ── buildGridModel ──────────────────────────────────────────────────────────

// Schedule: Madrid, 09:00–13:00 every weekday (same block on all 7 keys so the
// test does not depend on which weekday a date falls on).
function madridSchedule(overrides: Partial<GetScheduleResponse> = {}): GetScheduleResponse {
  const block = [{ startMinute: 540, endMinute: 780 }]; // 09:00–13:00
  return {
    weeklyHours: { '0': block, '1': block, '2': block, '3': block, '4': block, '5': block, '6': block },
    timezone: 'Europe/Madrid',
    minNoticeHours: 5,
    bookingWindowWeeks: 8,
    ...overrides,
  };
}

function slot(startIso: string): AvailabilitySlot {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 3_600_000);
  return { start: start.toISOString(), end: end.toISOString(), label: '', localLabel: '' };
}

describe('buildGridModel — device-timezone framing', () => {
  const farFuture = new Date('2026-06-20T00:00:00.000Z'); // well before the cells → min-notice satisfied

  it('maps a Madrid block to the right device rows (New York, summer DST)', () => {
    // Madrid 09:00–13:00 = New York 03:00–07:00 in June (Madrid UTC+2, NY UTC-4).
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {},
      now: farFuture,
      duration: '1h',
    });
    expect(model.hourRows).toEqual([3, 4, 5, 6]);
  });

  it('shifts rows when device/schedule DST schedules differ (mid-March: NY on DST, Madrid not)', () => {
    // 2026-03-16: NY already DST (UTC-4), Madrid still standard (UTC+1) → 5h gap.
    // Madrid 09:00–13:00 = NY 04:00–08:00 → rows 4–7 (vs 3–6 in June). Proves DST correctness.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 3, day: 16 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {},
      now: new Date('2026-03-10T00:00:00.000Z'),
      duration: '1h',
    });
    expect(model.hourRows).toEqual([4, 5, 6, 7]);
  });

  it('classifies available / booked / unavailable cells from availability (NY device)', () => {
    // Rows 3–6 (NY). Slots at NY 03:00 (UTC 07:00) and NY 05:00 (UTC 09:00).
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [slot('2026-06-24T07:00:00.000Z'), slot('2026-06-24T09:00:00.000Z')],
      },
      now: farFuture,
      duration: '1h',
    });
    const byHour = Object.fromEntries(model.columns[0].cells.map((c) => [c.hour, c.state]));
    expect(byHour[3]).toBe('available'); // has slot
    expect(byHour[4]).toBe('booked'); // working hour, after notice, no slot
    expect(byHour[5]).toBe('available');
    expect(byHour[6]).toBe('booked');
    expect(model.hasAnyBookable).toBe(true);
  });

  it('marks cells inside the min-notice window as unavailable, not booked', () => {
    // now = UTC 03:00; cutoff = +5h = UTC 08:00. Row 3 (UTC 07:00) is inside notice.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [slot('2026-06-24T07:00:00.000Z'), slot('2026-06-24T09:00:00.000Z')],
      },
      now: new Date('2026-06-24T03:00:00.000Z'),
      duration: '1h',
    });
    const byHour = Object.fromEntries(model.columns[0].cells.map((c) => [c.hour, c.state]));
    expect(byHour[3]).toBe('unavailable'); // inside 5h notice (no slot from backend either)
    expect(byHour[5]).toBe('available'); // UTC 09:00 ≥ cutoff
  });

  it('computes the "Libre · no cabe 2h" state structurally for 2h duration', () => {
    // Slots at NY 03:00 and 05:00 only (gaps at 04:00, 06:00). For 2h, each free
    // hour whose next hour is not free becomes no-fit-2h → nothing bookable.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [slot('2026-06-24T07:00:00.000Z'), slot('2026-06-24T09:00:00.000Z')],
      },
      now: farFuture,
      duration: '2h',
    });
    const byHour = Object.fromEntries(model.columns[0].cells.map((c) => [c.hour, c.state]));
    expect(byHour[3]).toBe('no-fit-2h');
    expect(byHour[5]).toBe('no-fit-2h');
    expect(model.hasAnyBookable).toBe(false);
  });

  it('keeps a free hour available for 2h when the next hour is also free', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [slot('2026-06-24T07:00:00.000Z'), slot('2026-06-24T08:00:00.000Z')],
      },
      now: farFuture,
      duration: '2h',
    });
    const byHour = Object.fromEntries(model.columns[0].cells.map((c) => [c.hour, c.state]));
    expect(byHour[3]).toBe('available'); // next hour (4) is free
    expect(byHour[4]).toBe('no-fit-2h'); // free but next hour (5) not free
    expect(model.hasAnyBookable).toBe(true);
  });

  it('reports an empty week (no working hours) as no rows / nothing bookable', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule({ weeklyHours: { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] } }),
      availabilityByDate: {},
      now: farFuture,
      duration: '1h',
    });
    expect(model.hourRows).toEqual([]);
    expect(model.hasAnyBookable).toBe(false);
  });
});
