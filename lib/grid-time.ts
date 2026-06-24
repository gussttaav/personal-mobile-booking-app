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

export type CellState = 'available' | 'booked' | 'unavailable' | 'no-fit-2h';

export interface GridCell {
  hour: number; // device-local hour row
  state: CellState;
  slot: AvailabilitySlot | null; // the 1h slot when available / no-fit-2h
}

export interface GridColumn {
  date: CivilDate;
  key: string; // YYYY-MM-DD (device-local)
  weekday: number; // 0 Sun … 6 Sat (device-local)
  cells: GridCell[]; // aligned to `hourRows`
}

export interface GridModel {
  hourRows: number[]; // contiguous device-local hours, min…max
  columns: GridColumn[];
  hasAnyBookable: boolean; // any cell selectable for the chosen duration
}

export interface BuildGridArgs {
  columns: CivilDate[]; // 7 device-local civil dates
  deviceTz: string;
  schedule: GetScheduleResponse;
  /** device-local YYYY-MM-DD → that day's 1h availability slots */
  availabilityByDate: Record<string, AvailabilitySlot[]>;
  now: Date;
  duration: '1h' | '2h';
}

/** True if a 60-min cell starting at `startMinute` (schedule-tz) is fully inside any block. */
function inWorkingHours(weekday: number, startMinute: number, schedule: GetScheduleResponse): boolean {
  const blocks = schedule.weeklyHours[String(weekday)] ?? [];
  const endMinute = startMinute + 60;
  return blocks.some((b) => b.startMinute <= startMinute && b.endMinute >= endMinute);
}

/**
 * Compose the schedule frame (which cells exist) with live availability (each
 * existing cell's state) into a renderable grid. Frame from /api/schedule;
 * state from /api/availability — never inferred from schedule alone.
 */
export function buildGridModel(args: BuildGridArgs): GridModel {
  const { columns, deviceTz, schedule, availabilityByDate, now, duration } = args;
  const minNoticeCutoff = now.getTime() + schedule.minNoticeHours * 3_600_000;

  // Per column: cell instants + working-hours membership + availability-by-hour.
  type DayCompute = {
    date: CivilDate;
    key: string;
    weekday: number;
    instants: Date[]; // index = hour 0..23
    working: boolean[]; // index = hour
    availByHour: Map<number, AvailabilitySlot>;
  };

  const days: DayCompute[] = columns.map((date) => {
    const key = dateKey(date);
    const instants: Date[] = [];
    const working: boolean[] = [];
    for (let h = 0; h < 24; h++) {
      const instant = zonedTimeToUtc({ ...date, hour: h }, deviceTz);
      instants.push(instant);
      const schedWeekday = partsInTz(instant, schedule.timezone);
      const schedMinute = schedWeekday.hour * 60 + schedWeekday.minute;
      const schedDow = civilWeekday({ year: schedWeekday.year, month: schedWeekday.month, day: schedWeekday.day });
      working.push(inWorkingHours(schedDow, schedMinute, schedule));
    }
    const availByHour = new Map<number, AvailabilitySlot>();
    for (const slot of availabilityByDate[key] ?? []) {
      const h = partsInTz(new Date(slot.start), deviceTz).hour;
      if (!availByHour.has(h)) availByHour.set(h, slot);
    }
    return { date, key, weekday: civilWeekday(date), instants, working, availByHour };
  });

  // Hour-row range = contiguous min…max of device-local hours in working hours.
  let minHour = Infinity;
  let maxHour = -Infinity;
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
      if (d.working[h]) {
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
    }
  }
  const hourRows: number[] =
    minHour === Infinity ? [] : Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);

  let hasAnyBookable = false;

  const gridColumns: GridColumn[] = days.map((d) => {
    const cells: GridCell[] = hourRows.map((hour) => {
      let state: CellState;
      let slot: AvailabilitySlot | null = null;

      if (!d.working[hour]) {
        state = 'unavailable';
      } else if (d.instants[hour].getTime() < minNoticeCutoff) {
        state = 'unavailable';
      } else {
        const hit = d.availByHour.get(hour) ?? null;
        if (hit) {
          slot = hit;
          if (duration === '2h') {
            const next = d.availByHour.get(hour + 1);
            state = next ? 'available' : 'no-fit-2h';
          } else {
            state = 'available';
          }
        } else {
          state = 'booked';
        }
      }

      if (state === 'available') hasAnyBookable = true;
      return { hour, state, slot };
    });
    return { date: d.date, key: d.key, weekday: d.weekday, cells };
  });

  return { hourRows, columns: gridColumns, hasAnyBookable };
}
