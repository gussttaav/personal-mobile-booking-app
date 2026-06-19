import { API_BASE } from '../../constants/config';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Native Google SDK: mock only the surface refreshSession() touches. signInSilently
// is driven per-test. isNoSavedCredentialFoundResponse mirrors the real guard.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signInSilently: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
    configure: jest.fn(),
  },
  isNoSavedCredentialFoundResponse: (r: { type?: string } | null) =>
    r?.type === 'noSavedCredentialFound',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

// Secure store: keep refresh logic off disk. persistSession is a no-op spy.
jest.mock('../token-store', () => ({
  loadPersistedSession: jest.fn().mockResolvedValue(null),
  persistSession: jest.fn().mockResolvedValue(undefined),
  clearPersistedSession: jest.fn().mockResolvedValue(undefined),
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthError, getStoredSession, refreshSession, setStoredSession, type AuthSession } from '../auth';
import { api, ApiError, registerRefreshHook } from '../api-client';

const silentMock = GoogleSignin.signInSilently as jest.Mock;

// ── Helpers ─────────────────────────────────────────────────────────────────
function jsonRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeSession(token: string): AuthSession {
  return {
    token,
    expiresIn: 3600,
    user: { email: 'a@b.com', name: 'A', image: null, isAdmin: false },
  };
}

function silentSuccess(idToken: string) {
  return { type: 'success', data: { idToken } };
}

const NO_CREDENTIAL = { type: 'noSavedCredentialFound', data: null };

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  setStoredSession(null);
  // A hook that is never expected to fire by default; overridden per-test.
  registerRefreshHook(jest.fn(async () => false));
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

// ── refreshSession: single-flight ─────────────────────────────────────────────
describe('refreshSession single-flight', () => {
  it('collapses concurrent calls into exactly one silent sign-in + one exchange', async () => {
    // Defer signInSilently so both refreshSession() calls overlap in flight.
    // The deferred is created up front so its resolver exists synchronously.
    let resolveSilent!: (v: unknown) => void;
    const silentPromise = new Promise((r) => { resolveSilent = r; });
    silentMock.mockReturnValue(silentPromise);
    fetchMock.mockResolvedValue(jsonRes(200, makeSession('fresh-token')));

    const p1 = refreshSession();
    const p2 = refreshSession();

    resolveSilent(silentSuccess('fresh-id'));
    const [s1, s2] = await Promise.all([p1, p2]);

    // EXACTLY ONE refresh: one silent sign-in, one token exchange.
    expect(silentMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/auth/mobile`,
      expect.objectContaining({ method: 'POST' }),
    );
    // Both waiters resolve to the same new session, written through to the cache.
    expect(s1).toBe(s2);
    expect(s1.token).toBe('fresh-token');
    expect(getStoredSession()?.token).toBe('fresh-token');
  });

  it('clears the in-flight ref so a later expiry starts a fresh refresh', async () => {
    silentMock.mockResolvedValue(silentSuccess('id'));
    fetchMock.mockResolvedValue(jsonRes(200, makeSession('t')));

    await refreshSession();
    await refreshSession();

    expect(silentMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws NO_SAVED_CREDENTIAL and leaves the cache untouched when no credential is cached', async () => {
    const existing = makeSession('stale');
    setStoredSession(existing);
    silentMock.mockResolvedValue(NO_CREDENTIAL);

    await expect(refreshSession()).rejects.toMatchObject({
      name: 'AuthError',
      code: 'NO_SAVED_CREDENTIAL',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getStoredSession()).toBe(existing);
  });
});

// ── api-client: 401 retry discipline ──────────────────────────────────────────
describe('api-client 401 handling', () => {
  it('refreshes once and retries the original request transparently', async () => {
    setStoredSession(makeSession('expired'));
    silentMock.mockResolvedValue(silentSuccess('fresh-id'));

    let refreshed = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/mobile')) {
        refreshed = true;
        return jsonRes(200, makeSession('fresh-token'));
      }
      return refreshed
        ? jsonRes(200, { bookings: [] })
        : jsonRes(401, { error: 'expired' });
    });

    registerRefreshHook(async () => {
      await refreshSession();
      return true;
    });

    const result = await api.getMyBookings();
    expect(result).toEqual({ bookings: [] });
    // Original 401 + one exchange + one retry = 3 fetches; exactly one refresh.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(silentMock).toHaveBeenCalledTimes(1);
  });

  it('triggers exactly one refresh for two concurrent 401s', async () => {
    setStoredSession(makeSession('expired'));
    silentMock.mockResolvedValue(silentSuccess('fresh-id'));

    let refreshed = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/auth/mobile')) {
        refreshed = true;
        return jsonRes(200, makeSession('fresh-token'));
      }
      return refreshed ? jsonRes(200, { ok: true }) : jsonRes(401, { error: 'expired' });
    });

    registerRefreshHook(async () => {
      await refreshSession();
      return true;
    });

    await Promise.all([api.getMyBookings(), api.getCredits()]);

    // Thundering-herd guard: two 401s, but a single silent sign-in + exchange.
    expect(silentMock).toHaveBeenCalledTimes(1);
    const exchangeCalls = fetchMock.mock.calls.filter(
      ([url]: [string]) => url.includes('/api/auth/mobile'),
    );
    expect(exchangeCalls).toHaveLength(1);
  });

  it('does NOT refresh on non-401 errors', async () => {
    const hook = jest.fn(async () => true);
    registerRefreshHook(hook);
    fetchMock.mockResolvedValue(jsonRes(403, { error: 'forbidden' }));

    await expect(api.getMyBookings()).rejects.toBeInstanceOf(ApiError);
    expect(hook).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not loop when refresh fails — surfaces the 401 once', async () => {
    const hook = jest.fn(async () => false); // refresh gave up
    registerRefreshHook(hook);
    fetchMock.mockResolvedValue(jsonRes(401, { error: 'expired' }));

    await expect(api.getMyBookings()).rejects.toMatchObject({ status: 401 });
    expect(hook).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // original only; no retry
  });

  it('gives up after one retry if the refreshed token still 401s (revoked server-side)', async () => {
    setStoredSession(makeSession('expired'));
    silentMock.mockResolvedValue(silentSuccess('fresh-id'));
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/auth/mobile')
        ? jsonRes(200, makeSession('fresh-token'))
        : jsonRes(401, { error: 'revoked' }),
    );

    registerRefreshHook(async () => {
      await refreshSession();
      return true;
    });

    await expect(api.getMyBookings()).rejects.toMatchObject({ status: 401 });
    // request 401 → refresh (exchange) → retry 401 → throw. One refresh, no loop.
    expect(silentMock).toHaveBeenCalledTimes(1);
  });
});
