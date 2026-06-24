/**
 * Grid time math for S05 (weekly booking grid).
 *
 * The booking grid renders in the DEVICE timezone, but the schedule frame
 * (/api/schedule weeklyHours) is expressed as minutes-since-midnight in the
 * SCHEDULE timezone (e.g. Europe/Madrid). These helpers do the DST-correct
 * conversion between the two so a student in any timezone sees the right local
 * hours.
 *
 * Everything here is pure: tz comes in as a parameter (never read from the host
 * machine), so the logic is unit-testable for any device/schedule tz pair,
 * including across DST boundaries. Built on Intl.DateTimeFormat with a
 * `timeZone` option (Hermes in Expo SDK 54 bundles full ICU).
 */

import type { AvailabilitySlot, GetScheduleResponse } from '@/types/api';

// ── tz primitives ───────────────────────────────────────────────────────────

/** The host device's IANA timezone (the only place the machine tz is read). */
export function getDeviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number; // 0–23
  minute: number;
  second: number;
}

const PART_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = PART_FORMATTERS.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    PART_FORMATTERS.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant as seen in `tz`. */
export function partsInTz(instant: Date, tz: string): ZonedParts {
  const map: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(instant)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  // Intl renders midnight as hour "24" in some engines; normalise to 0.
  if (map.hour === 24) map.hour = 0;
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

/** Minutes since local midnight (in `tz`) for an instant. */
export function minutesInTz(instant: Date, tz: string): number {
  const p = partsInTz(instant, tz);
  return p.hour * 60 + p.minute;
}

/** Offset (ms) between `tz` wall-clock and UTC at a given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const p = partsInTz(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

/**
 * Inverse of partsInTz: the UTC instant whose `tz` wall-clock is the given
 * civil date/time. Refines once to stay correct across DST transitions.
 */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute?: number },
  tz: string,
): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute ?? 0, 0);
  const offset1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - offset1;
  const offset2 = tzOffsetMs(new Date(utc), tz);
  if (offset2 !== offset1) utc = guess - offset2;
  return new Date(utc);
}

// ── civil-date helpers (pure calendar math, tz-independent) ──────────────────

export interface CivilDate {
  year: number;
  month: number; // 1–12
  day: number;
}

/** Add `n` whole days to a civil date. */
export function addDays(d: CivilDate, n: number): CivilDate {
  const t = Date.UTC(d.year, d.month - 1, d.day) + n * 86_400_000;
  const dt = new Date(t);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/** Day of week for a civil date: 0 = Sunday … 6 = Saturday. */
export function civilWeekday(d: CivilDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

/** `YYYY-MM-DD` key for a civil date. */
export function dateKey(d: CivilDate): string {
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

/** Civil date of an instant as seen in `tz`. */
export function civilDateInTz(instant: Date, tz: string): CivilDate {
  const p = partsInTz(instant, tz);
  return { year: p.year, month: p.month, day: p.day };
}

/** The Monday on/before a civil date. */
export function mondayOf(d: CivilDate): CivilDate {
  const dow = civilWeekday(d); // 0 Sun … 6 Sat
  const back = dow === 0 ? -6 : 1 - dow;
  return addDays(d, back);
}

/** The 7 civil dates (Mon→Sun) of the week `weekOffset` weeks from `today`. */
export function weekColumns(today: CivilDate, weekOffset: number): CivilDate[] {
  const start = addDays(mondayOf(today), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ── grid model ──────────────────────────────────────────────────────────────

export type CellState = 'available' | 'booked' | 'unavailable' | 'no-fit';

export interface GridCell {
  minute: number; // device-local minutes since midnight (30-min boundary, e.g. 540=09:00, 570=09:30)
  state: CellState;
  slot: AvailabilitySlot | null; // the 30-min slot when state is available or no-fit
}

export interface GridColumn {
  date: CivilDate;
  key: string; // YYYY-MM-DD (device-local)
  weekday: number; // 0 Sun … 6 Sat (device-local)
  cells: GridCell[]; // aligned to `slotMinutes`
}

export interface GridModel {
  slotMinutes: number[]; // sorted device-local minutes at 30-min boundaries
  columns: GridColumn[];
  hasAnyBookable: boolean; // any cell selectable for the chosen session length
}

export interface BuildGridArgs {
  columns: CivilDate[]; // 7 device-local civil dates
  deviceTz: string;
  schedule: GetScheduleResponse;
  /** device-local YYYY-MM-DD → that day's 30-min availability slots */
  availabilityByDate: Record<string, AvailabilitySlot[]>;
  now: Date;
  /** Session length: determines N cells per block (1h→2, 2h→4). Grid step is always 30 min. */
  duration: '1h' | '2h';
}

/** True if a 30-min cell starting at `startMinute` (schedule-tz) is fully inside any block. */
function inWorkingHours(weekday: number, startMinute: number, schedule: GetScheduleResponse): boolean {
  const blocks = schedule.weeklyHours[String(weekday)] ?? [];
  const endMinute = startMinute + 30;
  return blocks.some((b) => b.startMinute <= startMinute && b.endMinute >= endMinute);
}

/**
 * Compose the schedule frame (which 30-min cells exist) with live availability
 * (each cell's state) into a renderable grid.
 *
 * Two-pass approach:
 *   Pass 1: classify each working-hour cell as unavailable/free/booked.
 *   Pass 2: for free cells, check N-cell forward and backward blocks to decide
 *           available vs no-fit (free but can't anchor any valid block).
 *
 * Key: Pass 2 checks raw 'free' state, not the final 'available' state, so a
 * no-fit cell can still be a mid-cell in another cell's forward block.
 */
export function buildGridModel(args: BuildGridArgs): GridModel {
  const { columns, deviceTz, schedule, availabilityByDate, now, duration } = args;
  const N = duration === '2h' ? 4 : 2;
  const minNoticeCutoff = now.getTime() + schedule.minNoticeHours * 3_600_000;

  type RawState = 'unavailable' | 'free' | 'booked';
  type RawCell = { minute: number; instant: Date; raw: RawState; slot: AvailabilitySlot | null };

  type DayData = {
    date: CivilDate;
    key: string;
    weekday: number;
    rawCells: RawCell[];
  };

  // ── Pass 1: build raw cells per column ──────────────────────────────────────

  const days: DayData[] = columns.map((date) => {
    const key = dateKey(date);

    // Map API slots to device-local minutes
    const availByMinute = new Map<number, AvailabilitySlot>();
    for (const s of availabilityByDate[key] ?? []) {
      const m = minutesInTz(new Date(s.start), deviceTz);
      if (!availByMinute.has(m)) availByMinute.set(m, s);
    }

    const rawCells: RawCell[] = [];

    for (let m = 0; m < 1440; m += 30) {
      const instant = zonedTimeToUtc({ ...date, hour: Math.floor(m / 60), minute: m % 60 }, deviceTz);
      const sp = partsInTz(instant, schedule.timezone);
      const schedMinute = sp.hour * 60 + sp.minute;
      const schedDow = civilWeekday({ year: sp.year, month: sp.month, day: sp.day });

      if (!inWorkingHours(schedDow, schedMinute, schedule)) continue;

      if (instant.getTime() < minNoticeCutoff) {
        rawCells.push({ minute: m, instant, raw: 'unavailable', slot: null });
      } else {
        const hit = availByMinute.get(m) ?? null;
        rawCells.push({ minute: m, instant, raw: hit ? 'free' : 'booked', slot: hit });
      }
    }

    return { date, key, weekday: civilWeekday(date), rawCells };
  });

  // ── slotMinutes: contiguous range from earliest to latest working minute ────
  // Filling in gaps (e.g. a lunch break from 13:30–15:30) ensures the grid
  // shows those in-between rows as unavailable rather than hiding them, so the
  // user can see the full time context without a visual jump.

  const minuteSet = new Set<number>();
  for (const d of days) for (const rc of d.rawCells) minuteSet.add(rc.minute);
  const boundaryMinutes = Array.from(minuteSet).sort((a, b) => a - b);
  const slotMinutes: number[] = [];
  if (boundaryMinutes.length > 0) {
    for (let m = boundaryMinutes[0]; m <= boundaryMinutes[boundaryMinutes.length - 1]; m += 30) {
      slotMinutes.push(m);
    }
  }

  // ── Pass 2 + final grid columns ─────────────────────────────────────────────

  let hasAnyBookable = false;

  const gridColumns: GridColumn[] = days.map((d) => {
    // Index raw cells by minute for O(1) lookup
    const rawByMinute = new Map<number, RawCell>();
    for (const rc of d.rawCells) rawByMinute.set(rc.minute, rc);

    // Classify free cells: available or no-fit (N-cell block check)
    const finalState = new Map<number, CellState>();
    const freeCells = d.rawCells.filter((rc) => rc.raw === 'free');

    for (let i = 0; i < freeCells.length; i++) {
      const base = freeCells[i].minute;

      // Forward block: N consecutive free cells starting at i
      let forwardOk = i + N <= freeCells.length;
      if (forwardOk) {
        for (let k = 1; k < N; k++) {
          if (freeCells[i + k].minute !== base + k * 30) { forwardOk = false; break; }
        }
      }

      // Backward block: N consecutive free cells ending at i
      let backwardOk = i >= N - 1;
      if (backwardOk) {
        const blockStart = freeCells[i - (N - 1)].minute;
        for (let k = 0; k < N; k++) {
          if (freeCells[i - (N - 1) + k].minute !== blockStart + k * 30) { backwardOk = false; break; }
        }
      }

      finalState.set(base, forwardOk || backwardOk ? 'available' : 'no-fit');
    }

    const cells: GridCell[] = slotMinutes.map((minute) => {
      const rc = rawByMinute.get(minute);
      if (!rc) return { minute, state: 'unavailable', slot: null };

      switch (rc.raw) {
        case 'unavailable': return { minute, state: 'unavailable', slot: null };
        case 'booked':      return { minute, state: 'booked', slot: null };
        case 'free': {
          const state = finalState.get(minute) ?? 'no-fit';
          if (state === 'available') hasAnyBookable = true;
          return { minute, state, slot: rc.slot };
        }
      }
    });

    return { date: d.date, key: d.key, weekday: d.weekday, cells };
  });

  return { slotMinutes, columns: gridColumns, hasAnyBookable };
}
