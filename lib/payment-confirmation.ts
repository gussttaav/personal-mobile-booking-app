// Single-session booking confirmation poller (S06 Pass B).
//
// The backend (SINGLE-SESSION-CONFIRM-01) treats the channel endpoint's `status`
// as TOTAL and AUTHORITATIVE: confirmed (booking row written), slot_taken (refund
// recorded), failed (dead-letter), else pending. Normal confirmation lands in
// 3-6s; we poll until a terminal status or a 30s ceiling.
//
// This module is the pure core — no React, no timers baked in. `pollPaymentConfirmation`
// resolves EXACTLY ONCE with a terminal outcome, so idempotency is structural:
// the caller awaits a single promise and dispatches its one result. Transient
// fetch failures are swallowed and retried (a dropped request must not surface an
// error before the timeout). `now`/`sleep` are injectable for deterministic tests.

import { api } from './api-client';
import type { ConfirmedBooking } from '../types/api';

export type ConfirmationOutcome =
  | { kind: 'confirmed'; booking: ConfirmedBooking }
  | { kind: 'slot_taken' }
  | { kind: 'failed' }
  | { kind: 'timeout' };

export class PollAbortedError extends Error {
  constructor() {
    super('payment confirmation poll aborted');
    this.name = 'PollAbortedError';
  }
}

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_TIMEOUT_MS = 30_000;

function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new PollAbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new PollAbortedError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface PollPaymentConfirmationOptions {
  paymentIntentId: string;
  signal: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}

/**
 * Polls the payment-confirmation channel endpoint until a terminal status or the
 * timeout ceiling. Resolves once. Throws {@link PollAbortedError} if `signal`
 * aborts (the caller — unmounted screen — ignores it).
 */
export async function pollPaymentConfirmation(
  opts: PollPaymentConfirmationOptions,
): Promise<ConfirmationOutcome> {
  const {
    paymentIntentId,
    signal,
    intervalMs = DEFAULT_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    now = Date.now,
    sleep = defaultSleep,
  } = opts;

  const start = now();

  // First iteration runs immediately: covers the webhook-before-poll race, where
  // the status is already terminal before we ever subscribe/poll a second time.
  for (;;) {
    if (signal.aborted) throw new PollAbortedError();

    try {
      const res = await api.getPaymentConfirmationChannel({
        payment_intent_id: paymentIntentId,
      });

      // Only the single-session branch carries `status`; ignore the pack shape.
      if ('status' in res) {
        if (res.status === 'confirmed' && res.booking) {
          return { kind: 'confirmed', booking: res.booking };
        }
        if (res.status === 'slot_taken') return { kind: 'slot_taken' };
        if (res.status === 'failed') return { kind: 'failed' };
        // 'pending' (or 'confirmed' without a booking yet) → keep polling.
      }
    } catch (err) {
      if (err instanceof PollAbortedError) throw err;
      // Transient failure (network blip, 5xx, refresh churn): swallow and retry.
    }

    if (now() - start >= timeoutMs) return { kind: 'timeout' };

    await sleep(intervalMs, signal);
  }
}
