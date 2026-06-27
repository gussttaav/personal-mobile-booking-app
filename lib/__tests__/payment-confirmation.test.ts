// Mock the api-client surface the poller touches.
jest.mock('../api-client', () => ({
  api: { getPaymentConfirmationChannel: jest.fn() },
}));

import { api } from '../api-client';
import {
  pollPaymentConfirmation,
  pollPackConfirmation,
  PollAbortedError,
} from '../payment-confirmation';
import type { ConfirmedBooking } from '../../types/api';

const channelMock = api.getPaymentConfirmationChannel as jest.Mock;

const BOOKING: ConfirmedBooking = {
  eventId: 'evt_1',
  startIso: '2026-06-26T16:00:00.000Z',
  endIso: '2026-06-26T17:00:00.000Z',
  sessionType: 'session1h',
  joinToken: 'jt_abc',
};

function single(status: string, booking?: ConfirmedBooking) {
  return { checkoutType: 'single', channelName: 'pay:deadbeef', status, booking };
}

function pack(confirmed: boolean, credits: number | null, packSize: number | null) {
  return { channelName: 'pay:cafe', confirmed, credits, name: 'Lucía', packSize };
}

// A `now`/`sleep` pair where sleep advances virtual time — no real timers.
function virtualClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: jest.fn(async (ms: number) => {
      t += ms;
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('pollPaymentConfirmation', () => {
  it('resolves confirmed on the first poll (webhook-before-poll race) without sleeping', async () => {
    channelMock.mockResolvedValue(single('confirmed', BOOKING));
    const clock = virtualClock();
    const ctrl = new AbortController();

    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: ctrl.signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', booking: BOOKING });
    expect(channelMock).toHaveBeenCalledTimes(1);
    expect(channelMock).toHaveBeenCalledWith({ payment_intent_id: 'pi_1' });
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('resolves slot_taken immediately', async () => {
    channelMock.mockResolvedValue(single('slot_taken'));
    const clock = virtualClock();
    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });
    expect(outcome).toEqual({ kind: 'slot_taken' });
    expect(channelMock).toHaveBeenCalledTimes(1);
  });

  it('resolves failed immediately', async () => {
    channelMock.mockResolvedValue(single('failed'));
    const clock = virtualClock();
    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });
    expect(outcome).toEqual({ kind: 'failed' });
  });

  it('keeps polling while pending, then resolves confirmed (and stops)', async () => {
    channelMock
      .mockResolvedValueOnce(single('pending'))
      .mockResolvedValueOnce(single('pending'))
      .mockResolvedValueOnce(single('confirmed', BOOKING));
    const clock = virtualClock();

    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', booking: BOOKING });
    expect(channelMock).toHaveBeenCalledTimes(3); // exits after confirmed — no extra poll
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it('treats confirmed-without-booking as not-yet-terminal and keeps polling', async () => {
    channelMock
      .mockResolvedValueOnce(single('confirmed', undefined))
      .mockResolvedValueOnce(single('confirmed', BOOKING));
    const clock = virtualClock();

    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', booking: BOOKING });
    expect(channelMock).toHaveBeenCalledTimes(2);
  });

  it('swallows a transient fetch error and recovers on a later poll', async () => {
    channelMock
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(single('pending'))
      .mockResolvedValueOnce(single('confirmed', BOOKING));
    const clock = virtualClock();

    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', booking: BOOKING });
    expect(channelMock).toHaveBeenCalledTimes(3);
  });

  it('resolves timeout when status never leaves pending', async () => {
    channelMock.mockResolvedValue(single('pending'));
    const clock = virtualClock();

    const outcome = await pollPaymentConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      intervalMs: 1000,
      timeoutMs: 5000,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'timeout' });
    // start=0; polls at 0,1000,2000,3000,4000 then now=5000 >= 5000 → timeout.
    expect(channelMock).toHaveBeenCalledTimes(6);
  });

  it('throws PollAbortedError without polling when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const clock = virtualClock();

    await expect(
      pollPaymentConfirmation({ paymentIntentId: 'pi_1', signal: ctrl.signal, ...clock }),
    ).rejects.toBeInstanceOf(PollAbortedError);
    expect(channelMock).not.toHaveBeenCalled();
  });

  it('stops the loop when aborted mid-flight', async () => {
    const ctrl = new AbortController();
    channelMock.mockResolvedValue(single('pending'));
    // Abort during the first sleep; an aborting sleep rejects like the real one.
    const sleep = jest.fn(async () => {
      ctrl.abort();
      throw new PollAbortedError();
    });

    await expect(
      pollPaymentConfirmation({
        paymentIntentId: 'pi_1',
        signal: ctrl.signal,
        now: () => 0,
        sleep,
      }),
    ).rejects.toBeInstanceOf(PollAbortedError);
    expect(channelMock).toHaveBeenCalledTimes(1);
  });
});

describe('pollPackConfirmation', () => {
  it('resolves confirmed on the first poll (webhook-before-poll race) without sleeping', async () => {
    channelMock.mockResolvedValue(pack(true, 15, 10));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', credits: 15, packSize: 10, name: 'Lucía' });
    expect(channelMock).toHaveBeenCalledTimes(1);
    expect(channelMock).toHaveBeenCalledWith({ payment_intent_id: 'pi_1' });
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('keeps polling while not yet confirmed, then resolves confirmed (and stops)', async () => {
    channelMock
      .mockResolvedValueOnce(pack(false, null, null))
      .mockResolvedValueOnce(pack(false, null, null))
      .mockResolvedValueOnce(pack(true, 10, 10));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', credits: 10, packSize: 10, name: 'Lucía' });
    expect(channelMock).toHaveBeenCalledTimes(3);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it('treats confirmed-without-credits as not-yet-terminal and keeps polling', async () => {
    channelMock
      .mockResolvedValueOnce(pack(true, null, null))
      .mockResolvedValueOnce(pack(true, 5, 5));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', credits: 5, packSize: 5, name: 'Lucía' });
    expect(channelMock).toHaveBeenCalledTimes(2);
  });

  it('swallows a transient fetch error and recovers on a later poll', async () => {
    channelMock
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(pack(false, null, null))
      .mockResolvedValueOnce(pack(true, 10, 10));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'confirmed', credits: 10, packSize: 10, name: 'Lucía' });
    expect(channelMock).toHaveBeenCalledTimes(3);
  });

  it('fails loud (error) when the channel returns the single-session shape', async () => {
    channelMock.mockResolvedValue(single('pending'));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'error' });
    expect(channelMock).toHaveBeenCalledTimes(1);
  });

  it('resolves timeout when credits never activate', async () => {
    channelMock.mockResolvedValue(pack(false, null, null));
    const clock = virtualClock();

    const outcome = await pollPackConfirmation({
      paymentIntentId: 'pi_1',
      signal: new AbortController().signal,
      intervalMs: 1000,
      timeoutMs: 5000,
      ...clock,
    });

    expect(outcome).toEqual({ kind: 'timeout' });
    expect(channelMock).toHaveBeenCalledTimes(6);
  });

  it('throws PollAbortedError without polling when the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const clock = virtualClock();

    await expect(
      pollPackConfirmation({ paymentIntentId: 'pi_1', signal: ctrl.signal, ...clock }),
    ).rejects.toBeInstanceOf(PollAbortedError);
    expect(channelMock).not.toHaveBeenCalled();
  });
});
