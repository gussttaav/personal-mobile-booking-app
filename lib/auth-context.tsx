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
  /** Runs the native Google flow + token exchange. Re-throws AuthError so the
   *  sign-in screen can render error / offline states. */
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Wire the api-client's 401 refresh hook once. On a 401 it silently refreshes
  // the bearer (single-flight in lib/auth.ts) and mirrors the new session into
  // React state. If the refresh can't proceed (no cached Google credential,
  // network error, backend reject), sign out + clear the session — that flips
  // the <Stack.Protected> guard and routes to /login. (S02 session-expired is a
  // future hook point: route there instead of /login once that screen is built.)
  useEffect(() => {
    registerRefreshHook(async () => {
      try {
        const next = await refreshSession();
        setSession(next);
        return true;
      } catch {
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
      async signIn() {
        try {
          const idToken = await signInWithGoogle();
          const restored = await exchangeGoogleToken(idToken);
          setSession(restored);
        } catch (e) {
          // A cancelled account picker is not an error — leave state untouched.
          if (e instanceof AuthError && e.code === 'SIGN_IN_CANCELLED') return;
          throw e;
        }
      },
      async signOut() {
        await signOutGoogle();
        setSession(null);
      },
    }),
    [session, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
