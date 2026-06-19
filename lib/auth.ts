import {
  GoogleSignin,
  isNoSavedCredentialFoundResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { API_BASE } from '../constants/config';
import { clearPersistedSession, loadPersistedSession, persistSession } from './token-store';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuthUser = {
  email: string;
  name: string;
  image: string | null;
  isAdmin: boolean;
};

export type AuthSession = {
  token: string;
  expiresIn: number;
  user: AuthUser;
};

export type AuthErrorCode =
  | 'INVALID_GOOGLE_TOKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'SIGN_IN_CANCELLED'
  | 'SIGN_IN_IN_PROGRESS'
  | 'PLAY_SERVICES_UNAVAILABLE'
  | 'NO_SAVED_CREDENTIAL'
  | 'UNKNOWN';

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── In-memory session store ───────────────────────────────────────────────────
// Synchronous source of truth for lib/api-client.ts (buildHeaders) and screens
// that read the session on render. It's backed by expo-secure-store: writes go
// through to disk via persistSession() and the cache is rehydrated on launch via
// hydrateSession(). Keep this getter synchronous so callers don't need to await.

let _session: AuthSession | null = null;

export function getStoredSession(): AuthSession | null {
  return _session;
}

export function setStoredSession(session: AuthSession | null): void {
  _session = session;
}

// ── Launch-time hydration ─────────────────────────────────────────────────────
// Loads any persisted session from secure storage into the in-memory cache.
// Call this once at launch, before the navigator renders, so getStoredSession()
// is populated. Presence-check only — the token is NOT validated against the
// server here; an expired token will surface as a 401 on the first API call
// (graceful 401 handling is the silent-refresh task, see below).

export async function hydrateSession(): Promise<AuthSession | null> {
  const session = await loadPersistedSession();
  setStoredSession(session);
  return session;
}

// ── Sign in ───────────────────────────────────────────────────────────────────
// Runs the native Google sign-in sheet and returns the raw idToken.
// Callers should pass the idToken straight to exchangeGoogleToken().

export async function signInWithGoogle(): Promise<string> {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    if (!idToken) throw new AuthError('signIn() returned no idToken', 'UNKNOWN');
    return idToken;
  } catch (e) {
    if (e instanceof AuthError) throw e;
    const code = (e as { code?: string })?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED)
      throw new AuthError('Sign-in cancelled by user', 'SIGN_IN_CANCELLED');
    if (code === statusCodes.IN_PROGRESS)
      throw new AuthError('Sign-in already in progress', 'SIGN_IN_IN_PROGRESS');
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
      throw new AuthError('Google Play Services not available', 'PLAY_SERVICES_UNAVAILABLE');
    throw new AuthError(String(e), 'UNKNOWN');
  }
}

// ── Token exchange ────────────────────────────────────────────────────────────
// POSTs the Google idToken to the backend and returns the app session.
// On success the session is cached in memory AND persisted to secure storage so
// it survives app restarts (rehydrated at launch by hydrateSession()).
// Silent refresh (refreshSession, below) re-exchanges through here on a 401.

export async function exchangeGoogleToken(idToken: string): Promise<AuthSession> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/mobile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (e) {
    throw new AuthError(`Network error: ${String(e)}`, 'NETWORK');
  }

  let body: unknown;
  try { body = await res.json(); } catch { body = {}; }

  if (!res.ok) {
    const msg = (body as { message?: string })?.message ?? `HTTP ${res.status}`;
    if (res.status === 401) throw new AuthError(msg, 'INVALID_GOOGLE_TOKEN', 401);
    if (res.status === 403) throw new AuthError(msg, 'EMAIL_NOT_VERIFIED', 403);
    if (res.status === 429) throw new AuthError(msg, 'RATE_LIMITED', 429);
    throw new AuthError(msg, 'UNKNOWN', res.status);
  }

  const session = body as AuthSession;
  setStoredSession(session);
  await persistSession(session);
  return session;
}

// ── Silent refresh ──────────────────────────────────────────────────────────
// Called by the api-client's 401 hook when the bearer has expired. Obtains a
// fresh Google idToken WITHOUT user interaction (signInSilently — the cached-
// credentials path, NOT signIn() which shows the account picker), then
// re-exchanges it for a new bearer (which writes through to the in-memory cache
// + secure storage, same as the initial exchange).
//
// SINGLE-FLIGHT: concurrent 401s (e.g. Home firing /my-bookings and /credits at
// once) must trigger EXACTLY ONE refresh. The first call starts it and stores
// the promise in _refreshInFlight; concurrent calls await that same promise.
// The ref is cleared once it settles, so a later expiry starts a fresh refresh.
//
// ANDROID LIMITATION: signInSilently() only succeeds while Google still holds a
// cached credential for this app+install. If the user revoked access, cleared
// credentials, or never completed an interactive sign-in, it resolves to
// `noSavedCredentialFound` and we throw NO_SAVED_CREDENTIAL — there is no silent
// path in that state. The api-client hook's fallback is sign-out → /login.

let _refreshInFlight: Promise<AuthSession> | null = null;

export function refreshSession(): Promise<AuthSession> {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = doRefresh().finally(() => {
    _refreshInFlight = null;
  });
  return _refreshInFlight;
}

async function doRefresh(): Promise<AuthSession> {
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signInSilently();
  if (isNoSavedCredentialFoundResponse(res)) {
    throw new AuthError('No cached Google credential for silent refresh', 'NO_SAVED_CREDENTIAL');
  }
  const idToken = res.data?.idToken;
  if (!idToken) throw new AuthError('signInSilently() returned no idToken', 'UNKNOWN');
  return exchangeGoogleToken(idToken);
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
  setStoredSession(null);
  await clearPersistedSession();
}
