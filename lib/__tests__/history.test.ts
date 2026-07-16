import { effectiveStatus, fetchAllHistory, groupByMonth, historyStats } from '../history';
import type { GetMyBookingsHistoryResponse, HistoryBooking } from '../../types/api';

// Compact booking factory. Defaults to a completed, unreviewed 1h paid class.
function booking(over: Partial<HistoryBooking> = {}): HistoryBooking {
  return {
    id: 'b1',
    eventId: 'evt_1',
    sessionType: 'session1h',
    status: 'completed',
    startsAt: '2026-06-20T15:00:00.000Z',
    endsAt: '2026-06-20T16:00:00.000Z',
    note: null,
    amountCents: 1600,
    currency: 'eur',
    review: null,
    ...over,
  };
}

const NOW = new Date('2026-07-13T12:00:00.000Z').getTime();

describe('effectiveStatus', () => {
  it('reports a still-"confirmed" past class as completed (daily-cron settlement lag)', () => {
    const b = booking({ status: 'confirmed', endsAt: '2026-07-13T10:00:00.000Z' });
    expect(effectiveStatus(b, NOW)).toBe('completed');
  });

  it('leaves a confirmed FUTURE class alone', () => {
    const b = booking({ status: 'confirmed', endsAt: '2026-07-20T10:00:00.000Z' });
    expect(effectiveStatus(b, NOW)).toBe('confirmed');
  });

  it('passes through the terminal statuses untouched', () => {
    expect(effectiveStatus(booking({ status: 'cancelled' }), NOW)).toBe('cancelled');
    expect(effectiveStatus(booking({ status: 'no_show' }), NOW)).toBe('no_show');
    expect(effectiveStatus(booking({ status: 'completed' }), NOW)).toBe('completed');
  });
});

describe('groupByMonth', () => {
  it('buckets by month, preserving the API newest-first order', () => {
    const groups = groupByMonth(
      [
        booking({ id: 'a', startsAt: '2026-06-20T15:00:00.000Z' }),
        booking({ id: 'b', startsAt: '2026-06-12T15:00:00.000Z' }),
        booking({ id: 'c', startsAt: '2026-05-28T15:00:00.000Z' }),
      ],
      'es',
    );

    expect(groups.map((g) => g.key)).toEqual(['2026-06', '2026-05']);
    expect(groups[0].items.map((b) => b.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((b) => b.id)).toEqual(['c']);
  });

  it('keeps the same month in different YEARS in separate groups', () => {
    const groups = groupByMonth(
      [
        booking({ id: 'a', startsAt: '2026-01-10T15:00:00.000Z' }),
        booking({ id: 'b', startsAt: '2025-01-10T15:00:00.000Z' }),
      ],
      'es',
    );

    expect(groups.map((g) => g.key)).toEqual(['2026-01', '2025-01']);
  });

  it('capitalizes the localized month label', () => {
    const [group] = groupByMonth([booking({ startsAt: '2026-06-20T15:00:00.000Z' })], 'es');
    expect(group.label.charAt(0)).toBe(group.label.charAt(0).toUpperCase());
    expect(group.label).toContain('2026');
  });

  it('returns no groups for an empty history', () => {
    expect(groupByMonth([], 'es')).toEqual([]);
  });

  // A cancelled class is still part of your history — the list is "todo lo pasado".
  it('keeps every status, including cancelled and no_show', () => {
    const [group] = groupByMonth(
      [
        booking({ id: 'done', status: 'completed' }),
        booking({ id: 'cancel', status: 'cancelled' }),
        booking({ id: 'missed', status: 'no_show' }),
      ],
      'es',
    );

    expect(group.items.map((b) => b.id)).toEqual(['done', 'cancel', 'missed']);
  });
});

describe('historyStats', () => {
  it('counts completed (including settlement-lagged) and averages the ratings given', () => {
    const stats = historyStats(
      [
        booking({ review: { rating: 5, comment: null } }),
        booking({ review: { rating: 4, comment: 'ok' } }),
        booking({ status: 'confirmed', endsAt: '2026-07-13T10:00:00.000Z' }), // lagged → completed
        booking({ status: 'cancelled' }),
      ],
      NOW,
    );

    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(3);
    expect(stats.avgRating).toBe(4.5);
  });

  it('rounds the average to one decimal', () => {
    const stats = historyStats(
      [
        booking({ review: { rating: 5, comment: null } }),
        booking({ review: { rating: 5, comment: null } }),
        booking({ review: { rating: 4, comment: null } }),
      ],
      NOW,
    );
    expect(stats.avgRating).toBe(4.7); // 14/3 = 4.666…
  });

  it('reports avgRating null when nothing has been reviewed (so the tile can be hidden)', () => {
    const stats = historyStats([booking(), booking()], NOW);
    expect(stats.avgRating).toBeNull();
    expect(stats.completed).toBe(2);
  });

  it('is all-zero / null on an empty history', () => {
    expect(historyStats([], NOW)).toEqual({ total: 0, completed: 0, avgRating: null });
  });
});

describe('fetchAllHistory', () => {
  it('follows nextCursor across pages and stops on null', async () => {
    const pages: GetMyBookingsHistoryResponse[] = [
      { bookings: [booking({ id: 'a' })], nextCursor: 'cur1' },
      { bookings: [booking({ id: 'b' })], nextCursor: 'cur2' },
      { bookings: [booking({ id: 'c' })], nextCursor: null },
    ];
    const seen: (string | undefined)[] = [];
    const fetchPage = jest.fn(async ({ cursor }: { cursor?: string }) => {
      seen.push(cursor);
      return pages[seen.length - 1];
    });

    const all = await fetchAllHistory(fetchPage);

    expect(all.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(seen).toEqual([undefined, 'cur1', 'cur2']); // first page sends no cursor
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('requests the max page size', async () => {
    const fetchPage = jest.fn(async () => ({ bookings: [], nextCursor: null }));
    await fetchAllHistory(fetchPage);
    expect(fetchPage).toHaveBeenCalledWith({ limit: 50, cursor: undefined });
  });

  it('stops at the page ceiling if the server never returns a null cursor', async () => {
    const fetchPage = jest.fn(async () => ({ bookings: [booking()], nextCursor: 'always' }));
    const all = await fetchAllHistory(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(20);
    expect(all).toHaveLength(20);
  });

  it('propagates a fetch failure rather than returning a partial list', async () => {
    const fetchPage = jest.fn(async () => {
      throw new Error('boom');
    });
    await expect(fetchAllHistory(fetchPage)).rejects.toThrow('boom');
  });
});
