import { mergeMessages, parseMessageIndex } from '../chat';
import type { ChatMessage } from '../../types/api';

// Compact message factory. Index encoded in the id ("<eventId>:<index>"); sentAt derived
// from the index so timestamp order matches index order unless a test overrides it.
function msg(index: number, over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `evt_1:${index}`,
    senderEmail: 'stu@example.com',
    senderName: 'Lucía',
    text: `m${index}`,
    sentAt: `2026-07-01T18:0${index}:00.000Z`,
    ...over,
  };
}

const ids = (ms: ChatMessage[]) => ms.map((m) => m.id);

describe('parseMessageIndex', () => {
  it('parses the trailing index of "<eventId>:<index>"', () => {
    expect(parseMessageIndex('evt_1:0')).toBe(0);
    expect(parseMessageIndex('evt_1:42')).toBe(42);
  });

  it('handles event ids that themselves contain colons (uses the LAST colon)', () => {
    expect(parseMessageIndex('room:abc:7')).toBe(7);
  });

  it('sorts malformed ids last', () => {
    expect(parseMessageIndex('no-index')).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseMessageIndex('evt_1:notanumber')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('mergeMessages', () => {
  it('returns backlog sorted by index', () => {
    expect(ids(mergeMessages([], [msg(2), msg(0), msg(1)]))).toEqual([
      'evt_1:0',
      'evt_1:1',
      'evt_1:2',
    ]);
  });

  it('dedups a message present in BOTH backlog and a live broadcast (renders once)', () => {
    const backlog = [msg(0), msg(1)];
    const live = msg(1); // same id as backlog[1] — the overlap case
    const merged = mergeMessages(backlog, [live]);
    expect(ids(merged)).toEqual(['evt_1:0', 'evt_1:1']);
    expect(merged).toHaveLength(2);
  });

  it('appends a genuinely new live message after the backlog', () => {
    const merged = mergeMessages([msg(0), msg(1)], [msg(2)]);
    expect(ids(merged)).toEqual(['evt_1:0', 'evt_1:1', 'evt_1:2']);
  });

  it('re-sorts an out-of-order arrival by index (not arrival order)', () => {
    // A message with a lower index arrives after a higher one (reconnect / race).
    const merged = mergeMessages([msg(2)], [msg(0), msg(1)]);
    expect(ids(merged)).toEqual(['evt_1:0', 'evt_1:1', 'evt_1:2']);
  });

  it('recovers a subscribe-gap message when the backlog is re-merged (reconcile-on-SUBSCRIBED)', () => {
    // Live got msg 2 during the gap; a later backlog re-fetch includes 0,1,2 — no dupe, no loss.
    const afterLive = mergeMessages([], [msg(2)]);
    const reconciled = mergeMessages(afterLive, [msg(0), msg(1), msg(2)]);
    expect(ids(reconciled)).toEqual(['evt_1:0', 'evt_1:1', 'evt_1:2']);
    expect(reconciled).toHaveLength(3);
  });

  it('is pure — does not mutate its inputs', () => {
    const current = [msg(1)];
    const incoming = [msg(0)];
    mergeMessages(current, incoming);
    expect(ids(current)).toEqual(['evt_1:1']);
    expect(ids(incoming)).toEqual(['evt_1:0']);
  });

  it('falls back to sentAt when indices are equal/unknown', () => {
    const a: ChatMessage = msg(0, { id: 'bad', sentAt: '2026-07-01T18:05:00.000Z' });
    const b: ChatMessage = msg(0, { id: 'worse', sentAt: '2026-07-01T18:01:00.000Z' });
    // Both parse to MAX_SAFE_INTEGER → ordered by sentAt ascending.
    expect(ids(mergeMessages([], [a, b]))).toEqual(['worse', 'bad']);
  });

  it('handles empty inputs', () => {
    expect(mergeMessages([], [])).toEqual([]);
  });
});
