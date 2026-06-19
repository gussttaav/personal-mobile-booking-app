import * as SecureStore from 'expo-secure-store';
import type { AuthSession } from './auth';

// ── Secure session persistence ──────────────────────────────────────────────
// Thin wrapper over expo-secure-store. The whole AuthSession (token + expiresIn
// + user) is stored as a single JSON blob under one key so the in-memory cache
// — and the Home screen's getStoredSession()?.user.name fallback — can be
// rehydrated on cold start.
//
// Note: SecureStore warns above ~2 KB per value on Android. A JWT bearer plus
// the small AuthUser object stays well under that; revisit if the session grows.

const SESSION_KEY = 'auth.session';

export async function loadPersistedSession(): Promise<AuthSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    // Corrupted/legacy value — treat as no session rather than crashing launch.
    return null;
  }
}

export async function persistSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function clearPersistedSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
