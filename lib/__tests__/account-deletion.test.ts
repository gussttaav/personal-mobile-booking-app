import {
  classifyDeleteFailure,
  confirmEmailMatches,
  gateFor,
  normalizeEmail,
} from '../account-deletion';
import type { GetAccountResponse } from '../../types/api';

function verdict(over: Partial<GetAccountResponse> = {}): GetAccountResponse {
  return {
    eligible: true,
    reason: null,
    packCredits: 0,
    cancellableBookings: 0,
    imminentBookings: 0,
    ...over,
  };
}

describe('confirmEmailMatches', () => {
  it('accepts the account email case-insensitively and trimmed', () => {
    expect(confirmEmailMatches('  Student@Example.COM ', 'student@example.com')).toBe(true);
  });

  it('rejects a different address', () => {
    expect(confirmEmailMatches('other@example.com', 'student@example.com')).toBe(false);
  });

  it('never matches on an empty field', () => {
    expect(confirmEmailMatches('', 'student@example.com')).toBe(false);
    expect(confirmEmailMatches('   ', 'student@example.com')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  A@B.C \n')).toBe('a@b.c');
  });
});

describe('gateFor', () => {
  it('sends an eligible account to the confirmation', () => {
    expect(gateFor(verdict({ eligible: true, imminentBookings: 1 }))).toBe('confirm');
  });

  it('routes ACTIVE_PACK_CREDITS to the refund path', () => {
    expect(gateFor(verdict({ eligible: false, reason: 'ACTIVE_PACK_CREDITS', packCredits: 4 })))
      .toBe('blocked_pack');
  });

  it('keys off `reason`, not the counts (pack-class booking blocks with packCredits 0)', () => {
    const v = verdict({
      eligible: false,
      reason: 'ACTIVE_PACK_CREDITS',
      packCredits: 0,
      cancellableBookings: 1,
    });
    expect(gateFor(v)).toBe('blocked_pack');
  });

  it('routes CANCELLABLE_BOOKINGS to the cancel-your-classes screen', () => {
    expect(gateFor(verdict({ eligible: false, reason: 'CANCELLABLE_BOOKINGS', cancellableBookings: 1 })))
      .toBe('blocked_bookings');
  });

  it('falls back to the refund path for an ineligible verdict with no reason', () => {
    expect(gateFor(verdict({ eligible: false, reason: null }))).toBe('blocked_pack');
  });
});

describe('classifyDeleteFailure', () => {
  it('treats an already-deleted account as done', () => {
    expect(classifyDeleteFailure(404, 'USER_NOT_FOUND')).toBe('already_gone');
  });

  it('marks a mistyped confirmation', () => {
    expect(classifyDeleteFailure(400, 'DELETION_NOT_CONFIRMED')).toBe('not_confirmed');
  });

  it('maps both 409 codes to a verdict re-fetch', () => {
    expect(classifyDeleteFailure(409, 'DELETION_BLOCKED_ACTIVE_PACK')).toBe('blocked');
    expect(classifyDeleteFailure(409, 'DELETION_BLOCKED_CANCELLABLE_BOOKINGS')).toBe('blocked');
  });

  it('surfaces the shared hourly rate limit', () => {
    expect(classifyDeleteFailure(429, 'Demasiadas peticiones')).toBe('rate_limited');
  });

  it('falls back to a retryable generic failure', () => {
    expect(classifyDeleteFailure(400, 'INVALID_REQUEST')).toBe('generic');
    expect(classifyDeleteFailure(500, 'INTERNAL_ERROR')).toBe('generic');
    expect(classifyDeleteFailure(401, 'Unauthorized')).toBe('generic');
  });
});
