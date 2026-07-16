import { bcp47, capitalize } from './format';
import type {
  BookingStatus,
  GetMyBookingsHistoryParams,
  GetMyBookingsHistoryResponse,
  HistoryBooking,
  Locale,
} from '../types/api';

// Pure logic behind S20 (Historial de reservas). No React, no timers — `now` is
// injectable and the page fetcher is a parameter, so all of this is testable
// without a network.

/** Page size. The endpoint caps `limit` at 50. */
const PAGE_SIZE = 50;

/** Hard ceiling so a server that never returns `nextCursor: null` can't spin forever. */
const MAX_PAGES = 20;

type PageFetcher = (params: GetMyBookingsHistoryParams) => Promise<GetMyBookingsHistoryResponse>;

/**
 * Walks the keyset cursor to the last page and returns the whole history, newest
 * first. S20's header count and summary stats are totals over ALL history, so a
 * partial list would misreport them.
 */
export async function fetchAllHistory(fetchPage: PageFetcher): Promise<HistoryBooking[]> {
  const all: HistoryBooking[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchPage({ limit: PAGE_SIZE, cursor });
    all.push(...res.bookings);
    if (res.nextCursor == null) break;
    cursor = res.nextCursor;
  }

  return all;
}

/**
 * `completed`/`no_show` are settled by a DAILY cron, so a class that ended hours
 * ago can still read `confirmed`. Render that as finished rather than as an
 * unknown state. (api-contract.md — "Settlement lag".)
 */
export function effectiveStatus(booking: HistoryBooking, now: number = Date.now()): BookingStatus {
  if (booking.status === 'confirmed' && new Date(booking.endsAt).getTime() < now) {
    return 'completed';
  }
  return booking.status;
}

export interface MonthGroup {
  /** Sort/render key, e.g. "2026-06". */
  key: string;
  /** Localized heading, e.g. "Junio 2026". */
  label: string;
  items: HistoryBooking[];
}

/** Groups into month buckets, preserving the API's newest-first ordering. */
export function groupByMonth(bookings: HistoryBooking[], locale: Locale): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();

  for (const b of bookings) {
    const d = new Date(b.startsAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let group = byKey.get(key);
    if (!group) {
      const label = capitalize(d.toLocaleDateString(bcp47(locale), { month: 'long', year: 'numeric' }));
      group = { key, label, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(b);
  }

  return groups;
}

export interface HistoryStats {
  total: number;
  completed: number;
  /** Mean of the ratings the student gave. null when nothing has been reviewed. */
  avgRating: number | null;
}

export function historyStats(bookings: HistoryBooking[], now: number = Date.now()): HistoryStats {
  let completed = 0;
  let ratingSum = 0;
  let ratingCount = 0;

  for (const b of bookings) {
    if (effectiveStatus(b, now) === 'completed') completed++;
    if (b.review != null) {
      ratingSum += b.review.rating;
      ratingCount++;
    }
  }

  return {
    total: bookings.length,
    completed,
    avgRating: ratingCount === 0 ? null : Math.round((ratingSum / ratingCount) * 10) / 10,
  };
}
