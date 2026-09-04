import type { AvailabilitySlot, GetScheduleResponse } from '../../types/api';
import {
  addDays,
  buildGridModel,
  civilWeekday,
  dateKey,
  gridUnitsFor,
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

// Schedule: Madrid, 09:00–13:00 every day (block on all 7 keys so tests don't
// depend on which weekday the test date falls on).
function madridSchedule(overrides: Partial<GetScheduleResponse> = {}): GetScheduleResponse {
  const block = [{ startMinute: 540, endMinute: 780 }]; // 09:00–13:00
  return {
    weeklyHours: { '0': block, '1': block, '2': block, '3': block, '4': block, '5': block, '6': block },
    timezone: 'Europe/Madrid',
    minNoticeHours: 5,
    cancelMinNoticeHours: 2,
    bookingWindowWeeks: 8,
    ...overrides,
  };
}

// 30-min slot helper
function slot(startIso: string): AvailabilitySlot {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 1_800_000); // 30 min
  return { start: start.toISOString(), end: end.toISOString(), label: '', localLabel: '' };
}

const farFuture = new Date('2026-06-20T00:00:00.000Z'); // well before any test cell

describe('buildGridModel — device-timezone framing', () => {
  it('maps a Madrid block to the right device rows (New York, summer DST)', () => {
    // Madrid 09:00–13:00 CEST (UTC+2) = New York 03:00–07:00 EDT (UTC-4), 6h gap.
    // 8 thirty-min slots in device-local minutes: 180 (03:00) … 390 (06:30).
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {},
      now: farFuture,
      duration: '1h',
    });
    expect(model.slotMinutes).toEqual([180, 210, 240, 270, 300, 330, 360, 390]);
  });

  it('shifts rows when device/schedule DST schedules differ (mid-March: NY on DST, Madrid not)', () => {
    // 2026-03-16: NY already DST (UTC-4), Madrid still standard (UTC+1) → 5h gap.
    // Madrid 09:00–13:00 = NY 04:00–08:00 → device-local minutes 240…450.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 3, day: 16 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {},
      now: new Date('2026-03-10T00:00:00.000Z'),
      duration: '1h',
    });
    expect(model.slotMinutes).toEqual([240, 270, 300, 330, 360, 390, 420, 450]);
  });

  it('classifies available/booked/unavailable from availability (NY device, N=2)', () => {
    // Slots at 07:00 UTC (NY 03:00 = 180 min) and 07:30 UTC (NY 03:30 = 210 min).
    // Both consecutive → both available for 1h (N=2).
    // 08:00 UTC (240 min) is in working hours but has no slot → booked.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T07:30:00.000Z'),
        ],
      },
      now: farFuture,
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('available'); // has slot, forward [180,210] both free
    expect(byMinute[210]).toBe('available'); // has slot, backward [180,210] both free
    expect(byMinute[240]).toBe('booked');    // working hour, past notice, no slot
    expect(model.hasAnyBookable).toBe(true);
  });

  it('marks cells inside the min-notice window as unavailable, not booked', () => {
    // now = UTC 03:00; cutoff = +5h = UTC 08:00. Cell at 07:00 UTC (NY 03:00) is inside notice.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T09:00:00.000Z'),
          slot('2026-06-24T09:30:00.000Z'),
        ],
      },
      now: new Date('2026-06-24T03:00:00.000Z'),
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('unavailable'); // 07:00 UTC inside 5h notice window
    expect(byMinute[300]).toBe('available');   // 09:00 UTC (NY 05:00) past cutoff, consecutive pair
    expect(byMinute[330]).toBe('available');   // 09:30 UTC (NY 05:30) past cutoff, backward pair
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
    expect(model.slotMinutes).toEqual([]);
    expect(model.hasAnyBookable).toBe(false);
  });
});

// ── N-cell block classification ────────────────────────────────────────────────

describe('buildGridModel — N-cell block classification', () => {
  // Convenience: Madrid schedule, NY device, far future (no notice constraint).
  // Slots are expressed as UTC ISO strings; Madrid UTC+2 summer → NY UTC-4:
  //   07:00Z = NY 03:00 = 180 min
  //   07:30Z = NY 03:30 = 210 min
  //   08:00Z = NY 04:00 = 240 min
  //   08:30Z = NY 04:30 = 270 min

  it('N=2: isolated free slot → no-fit (no adjacent free cell)', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: { '2026-06-24': [slot('2026-06-24T07:00:00.000Z')] },
      now: farFuture,
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('no-fit');
    expect(model.hasAnyBookable).toBe(false);
  });

  it('N=2: two consecutive free slots → both available', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [slot('2026-06-24T07:00:00.000Z'), slot('2026-06-24T07:30:00.000Z')],
      },
      now: farFuture,
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('available'); // forward [180,210]
    expect(byMinute[210]).toBe('available'); // backward [180,210]
    expect(model.hasAnyBookable).toBe(true);
  });

  it('N=4: three consecutive free slots → all no-fit (need 4 for a valid block)', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T07:30:00.000Z'),
          slot('2026-06-24T08:00:00.000Z'),
        ],
      },
      now: farFuture,
      duration: '2h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('no-fit');
    expect(byMinute[210]).toBe('no-fit');
    expect(byMinute[240]).toBe('no-fit');
    expect(model.hasAnyBookable).toBe(false);
  });

  it('N=4: four consecutive → first available (forward), middle two no-fit, last available (backward)', () => {
    // Slots at 07:00, 07:30, 08:00, 08:30 UTC → NY minutes 180, 210, 240, 270.
    // - 180: forward [180,210,240,270] all free → available
    // - 210: forward needs 300 (missing); backward [180,210,240,270]? No: backward for
    //        idx=1 needs idx-3=-2, invalid → no-fit
    // - 240: forward needs 300,330 (missing); backward idx=2 needs idx-3=-1, invalid → no-fit
    // - 270: forward needs 300 (missing); backward [180,210,240,270] → available
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T07:30:00.000Z'),
          slot('2026-06-24T08:00:00.000Z'),
          slot('2026-06-24T08:30:00.000Z'),
        ],
      },
      now: farFuture,
      duration: '2h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('available');
    expect(byMinute[210]).toBe('no-fit');
    expect(byMinute[240]).toBe('no-fit');
    expect(byMinute[270]).toBe('available');
    expect(model.hasAnyBookable).toBe(true);
  });

  it('N=2: backward fallback at working-hours boundary (last two slots of the day)', () => {
    // Slots only at 08:00 and 08:30 UTC → NY 240 and 270.
    // 270 is the last cell of the Madrid 09:00-13:00 window (12:30 Madrid = 06:30 NY).
    // - 240: forward [240,270] → available
    // - 270: forward would need 300, outside working hours → fail; backward [240,270] → available
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T08:00:00.000Z'),
          slot('2026-06-24T08:30:00.000Z'),
        ],
      },
      now: farFuture,
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[240]).toBe('available');
    expect(byMinute[270]).toBe('available');
    expect(model.hasAnyBookable).toBe(true);
  });

  it('N=2: unavailable cell inside notice cutoff breaks a consecutive-free run', () => {
    // now = UTC 02:30 → cutoff = UTC 07:30. Cell at 07:00Z (NY 180) is inside notice.
    // Slots at 07:00, 07:30, 08:00 UTC. Cell at 180 → unavailable (inside notice).
    // Free cells at 210 and 240 (07:30 and 08:00 UTC, past cutoff).
    // - 210: forward [210,240] → available; 240: backward [210,240] → available.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T07:30:00.000Z'),
          slot('2026-06-24T08:00:00.000Z'),
        ],
      },
      now: new Date('2026-06-24T02:30:00.000Z'),
      duration: '1h',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('unavailable'); // inside notice
    expect(byMinute[210]).toBe('available');
    expect(byMinute[240]).toBe('available');
    expect(model.hasAnyBookable).toBe(true);
  });

  it('N=4: no-fit mid-cell still has a slot (slot !== null) for block membership', () => {
    // 270 is no-fit (can't anchor any block alone) but slot is present.
    // This verifies that Pass 2 does NOT clear the slot field for no-fit cells.
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot('2026-06-24T07:00:00.000Z'),
          slot('2026-06-24T07:30:00.000Z'),
          slot('2026-06-24T08:00:00.000Z'),
          slot('2026-06-24T08:30:00.000Z'),
        ],
      },
      now: farFuture,
      duration: '2h',
    });
    const cell210 = model.columns[0].cells.find((c) => c.minute === 210)!;
    expect(cell210.state).toBe('no-fit');
    expect(cell210.slot).not.toBeNull(); // slot present for mid-block membership in other cells' blocks
  });
});

// ── gridUnitsFor + the free 15-min grid (step 15, N=1) ──────────────────────────

describe('gridUnitsFor', () => {
  it('maps each session length to its grid step and block count', () => {
    expect(gridUnitsFor('15min')).toEqual({ stepMinutes: 15, blockCount: 1 });
    expect(gridUnitsFor('1h')).toEqual({ stepMinutes: 30, blockCount: 2 });
    expect(gridUnitsFor('2h')).toEqual({ stepMinutes: 30, blockCount: 4 });
  });
});

describe("buildGridModel — free 15-min grid (duration '15min')", () => {
  // 15-min slot helper (availability fetched at duration:15 for the free flow).
  function slot15(startIso: string): AvailabilitySlot {
    const start = new Date(startIso);
    const end = new Date(start.getTime() + 900_000); // 15 min
    return { start: start.toISOString(), end: end.toISOString(), label: '', localLabel: '' };
  }

  it('rows step by 15 min across the working block', () => {
    // Madrid 09:00–13:00 CEST = NY 03:00–07:00 EDT. Cells fully inside the block
    // start every 15 min from 03:00 (180) to 12:45 Madrid = NY 06:45 (405).
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {},
      now: farFuture,
      duration: '15min',
    });
    expect(model.slotMinutes).toEqual([
      180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, 375, 390, 405,
    ]);
  });

  it('every free 15-min cell is available (N=1), gaps are booked', () => {
    const model = buildGridModel({
      columns: [{ year: 2026, month: 6, day: 24 }],
      deviceTz: 'America/New_York',
      schedule: madridSchedule(),
      availabilityByDate: {
        '2026-06-24': [
          slot15('2026-06-24T07:00:00.000Z'), // NY 03:00 = 180
          slot15('2026-06-24T07:15:00.000Z'), // NY 03:15 = 195
        ],
      },
      now: farFuture,
      duration: '15min',
    });
    const byMinute = Object.fromEntries(model.columns[0].cells.map((c) => [c.minute, c.state]));
    expect(byMinute[180]).toBe('available'); // has a slot → bookable on its own (N=1)
    expect(byMinute[195]).toBe('available');
    expect(byMinute[210]).toBe('booked');    // working hour, no slot
    expect(model.hasAnyBookable).toBe(true);
  });
});
