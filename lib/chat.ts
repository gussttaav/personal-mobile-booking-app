// In-session chat message reconciliation (S15 Pass B).
//
// This module is the pure core — no React, no Supabase. Chat messages arrive from two
// sources that overlap: the handshake backlog (GET /api/chat-session/channel →
// initialMessages) and the live Supabase broadcast. A single message can appear in
// BOTH (it was already persisted when we fetched the backlog AND it re-broadcasts), or
// arrive in the gap between snapshot and subscribe. `mergeMessages` is the dedup +
// ordering core: union by `id`, sorted by the message index so backlog and live render
// exactly once, in order, regardless of arrival timing. Mirrors the payment-confirmation
// "pure, testable" discipline and is unit-tested alongside it.

import type { ChatMessage } from '../types/api';

// Message ids are shaped "<eventId>:<index>". The index is a monotonic per-session
// counter (the source-of-truth order). Parse the trailing integer; anything malformed
// sorts last (Number.MAX_SAFE_INTEGER) so a live message with a well-formed index still
// orders correctly ahead of it.
export function parseMessageIndex(id: string): number {
  const colon = id.lastIndexOf(':');
  if (colon === -1) return Number.MAX_SAFE_INTEGER;
  const n = Number(id.slice(colon + 1));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

// Union `current` + `incoming`, deduped by `id` (last write wins on a collision), sorted
// by message index (fallback: sentAt) ascending. Pure — returns a new array, mutates
// nothing. Safe to call with the same message twice (dedup) and with out-of-order arrivals
// (re-sorted), which is exactly what the backlog-vs-live and reconnect paths need.
export function mergeMessages(
  current: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);

  return Array.from(byId.values()).sort((a, b) => {
    const ai = parseMessageIndex(a.id);
    const bi = parseMessageIndex(b.id);
    if (ai !== bi) return ai - bi;
    // Same/unknown index — fall back to timestamp for a stable order.
    return a.sentAt.localeCompare(b.sentAt);
  });
}
