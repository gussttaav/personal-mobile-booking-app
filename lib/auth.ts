import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { API_BASE } from '../constants/config';

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
// TODO (A3 secure-storage): back this with expo-secure-store so the session
//   survives app restarts (matching the existing TODO in exchangeGoogleToken).

let _session: AuthSession | null = null;

export function getStoredSession(): AuthSession | null {
  return _session;
}

export function setStoredSession(session: AuthSession | null): void {
  _session = session;
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
// On success the caller holds a bearer token in AuthSession.token.
//
// TODO (secure storage): after a successful exchange, persist AuthSession
//   to expo-secure-store so the session survives app restarts. Load it on
//   startup and skip sign-in if a valid (non-expired) session is found.
//
// TODO (silent refresh): when a protected API call returns 401, call
//   signInWithGoogle() silently (GoogleSignin.signInSilently()) to get a
//   fresh idToken, then call exchangeGoogleToken() again and retry the
//   original request with the new bearer token.

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

  setStoredSession(body as AuthSession);
  return body as AuthSession;
}

// ── Sign out ──────────────────────────────────────────────────────────────────

export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
  setStoredSession(null);
  // TODO (secure storage): clear the persisted AuthSession from expo-secure-store here.
}
