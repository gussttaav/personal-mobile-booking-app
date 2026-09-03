import type { GetAccountResponse } from '../types/api';

// ── Account-deletion logic (pure) ─────────────────────────────────────────────
// No React, no expo, no network — the decisions the S21 screen makes, isolated so
// they can be tested. The effectful half lives in the screen
// (app/(tabs)/(profile)/delete-account.tsx) and in the post-deletion teardown
// (useAuth().completeAccountDeletion, lib/auth-context.tsx).

/** Which of the three deletion screens a verdict maps to. */
export type DeletionGate = 'confirm' | 'blocked_pack' | 'blocked_bookings';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * The typed confirmation must equal the account email — case-insensitive and
 * trimmed, exactly as the server compares it. An empty field never matches.
 */
export function confirmEmailMatches(typed: string, accountEmail: string): boolean {
  const a = normalizeEmail(typed);
  return a.length > 0 && a === normalizeEmail(accountEmail);
}

/**
 * Picks the screen for a verdict. Keys off `reason`, NEVER off the counts: a
 * student whose only booking is a pack class is blocked with `packCredits: 0`
 * (cancelling it would return the credit and land back on the pack rule, so the
 * server routes straight to the refund path). An ineligible verdict with an
 * unexpected `reason` falls back to the refund path — the one screen that always
 * offers a way out (email Gustavo) rather than a dead end.
 */
export function gateFor(verdict: GetAccountResponse): DeletionGate {
  if (verdict.eligible) return 'confirm';
  return verdict.reason === 'CANCELLABLE_BOOKINGS' ? 'blocked_bookings' : 'blocked_pack';
}

/** What the screen does with a failed DELETE. */
export type DeleteFailure =
  /** 404 USER_NOT_FOUND — the account is already gone; that IS what was asked for. */
  | 'already_gone'
  /** The typed email didn't match: keep the form open and mark the field. */
  | 'not_confirmed'
  /** 409 — the account changed under the student; re-fetch the verdict. */
  | 'blocked'
  /** 429 — 10/hour shared across both endpoints. Back off, don't poll. */
  | 'rate_limited'
  /** Anything else (400 INVALID_REQUEST, 401, 403, 500, network): offer a retry. */
  | 'generic';

export function classifyDeleteFailure(status: number, code: string): DeleteFailure {
  if (status === 404 && code === 'USER_NOT_FOUND') return 'already_gone';
  if (status === 400 && code === 'DELETION_NOT_CONFIRMED') return 'not_confirmed';
  if (status === 409) return 'blocked';
  if (status === 429) return 'rate_limited';
  return 'generic';
}
