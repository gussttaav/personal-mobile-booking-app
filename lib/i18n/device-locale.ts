import type { Locale } from '../../types/api';

// ── Device language (pure, dependency-free) ───────────────────────────────────
// Mirrors getDeviceTimeZone() in lib/grid-time.ts: reads the host locale straight
// from the Intl API so we add NO native module (no expo-localization). Returns a
// BCP-47 tag like "es-ES" / "en-US".

export function getDeviceLanguage(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

/** Collapse any device language tag into a supported app Locale. Spanish in any
 *  region → 'es'; everything else → 'en'. */
export function deriveLocale(language: string): Locale {
  return language.toLowerCase().startsWith('es') ? 'es' : 'en';
}
