import * as SecureStore from 'expo-secure-store';
import type { Locale } from '../../types/api';

// ── Persisted locale choice ───────────────────────────────────────────────────
// Thin wrapper over expo-secure-store (mirrors lib/token-store.ts). The locale is
// not sensitive, but secure-store is the only storage module compiled into the
// dev client — AsyncStorage would be a new native dep / rebuild. So we reuse it.
// This is the device-side persistence that survives restarts; the backend
// (POST /api/locale) stays the authoritative source on sign-in.

const LOCALE_KEY = 'app.locale';

export async function loadPersistedLocale(): Promise<Locale | null> {
  const raw = await SecureStore.getItemAsync(LOCALE_KEY);
  return raw === 'es' || raw === 'en' ? raw : null;
}

export async function persistLocale(locale: Locale): Promise<void> {
  await SecureStore.setItemAsync(LOCALE_KEY, locale);
}
