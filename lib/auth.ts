import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
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
//
// TODO (silent refresh): when a protected API call returns 401, call
//   signInWithGoogle() silently (GoogleSignin.signInSilently()) to get a
//   fresh idToken, then call exchangeGoogleToken() again and retry the
//   original request with the new bearer token. Wire via registerRefreshHook()
//   in lib/api-client.ts.

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

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
  setStoredSession(null);
  await clearPersistedSession();
}
