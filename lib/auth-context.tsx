import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  AuthError,
  exchangeGoogleToken,
  hydrateSession,
  refreshSession,
  signInWithGoogle,
  signOutGoogle,
  type AuthSession,
} from './auth';
import { registerRefreshHook } from './api-client';

// ── Auth context ────────────────────────────────────────────────────────────
// Holds the reactive session state that drives launch-time routing in the root
// layout (<Stack.Protected guard={!!session}>). The in-memory cache in lib/auth.ts
// stays the synchronous source of truth for the API client; this context mirrors
// it into React state because every mutation here goes through lib/auth.ts.
//
// - isReady: false until the persisted session has been read from secure storage.
//   The root layout keeps the native splash up while !isReady so the login screen
//   never flashes before the session is resolved on cold start.

type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  /** True when a present session lapsed beyond silent recovery (the 401 refresh
   *  hook hit NO_SAVED_CREDENTIAL). The session is kept so S02 can show the
   *  user's identity; the root layout routes to /session-expired while it's set. */
  expired: boolean;
  /** Runs the native Google flow + token exchange. Re-throws AuthError so the
   *  sign-in screen can render error / offline states. */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [expired, setExpired] = useState(false);

  // Wire the api-client's 401 refresh hook once. On a 401 it silently refreshes
  // the bearer (single-flight in lib/auth.ts) and mirrors the new session into
  // React state. The hook only ever fires for an existing (signed-in) session.
  // - NO_SAVED_CREDENTIAL: the ~30-day Google credential lapsed and silent
  //   sign-in can't recover it → route to S02 (session-expired). Keep `session`
  //   so the guard stays signed-in and S02 can show the user's identity
  //   ("Continuar como …"); set the `expired` flag to flip routing.
  //   TODO(return-to-context): no captured route to restore — re-auth lands on
  //   Inicio (the (tabs) group remounts at its initial route).
  // - Any other failure (network, backend reject): sign out + clear the session,
  //   which flips the guard to /login.
  useEffect(() => {
    registerRefreshHook(async () => {
      try {
        const next = await refreshSession();
        setSession(next);
        return true;
      } catch (e) {
        if (e instanceof AuthError && e.code === 'NO_SAVED_CREDENTIAL') {
          setExpired(true);
          return false;
        }
        await signOutGoogle();
        setSession(null);
        return false;
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    hydrateSession()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .catch(() => {
        // Secure-store read failed — treat as signed out rather than blocking launch.
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      expired,
      async signIn() {
        try {
          const idToken = await signInWithGoogle();
          const restored = await exchangeGoogleToken(idToken);
          setSession(restored);
          setExpired(false);
        } catch (e) {
          // A cancelled account picker is not an error — leave state untouched.
          if (e instanceof AuthError && e.code === 'SIGN_IN_CANCELLED') return;
          throw e;
        }
      },
      async signOut() {
        await signOutGoogle();
        setSession(null);
        setExpired(false);
      },
    }),
    [session, isReady, expired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
