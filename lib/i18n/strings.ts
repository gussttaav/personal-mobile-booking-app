import type { Locale } from '../../types/api';

// ── Translation dictionaries ──────────────────────────────────────────────────
// Keyed, nested ES/EN strings. `es` is the canonical shape; `en` is typed against
// it so TypeScript enforces that both languages cover the exact same keys (a
// missing or extra English key is a compile error). Screens read strings via
// useT()/t('home.empty.title') — see lib/i18n/locale-context.tsx.
//
// This task seeds only the proof strings (4 tab labels + Home empty-state).
// Add keys here as screens are localized incrementally.

const es = {
  tabs: {
    home: 'Inicio',
    booking: 'Reservar',
    packs: 'Packs',
    profile: 'Perfil',
  },
  home: {
    empty: {
      title: 'Aún no tienes clases',
      subtitle:
        'Reserva tu primera tutoría 1:1 con Gustavo y empieza a avanzar en lo que más te cuesta.',
    },
  },
  settings: {
    title: 'Ajustes',
    language: {
      title: 'Idioma',
      es: 'Español',
      en: 'English',
    },
  },
  profile: {
    settingsRow: 'Ajustes',
  },
};

// `es` is canonical; leaves widen to `string` (no `as const`) so `en` may hold
// different copy while TS still enforces an identical key tree across languages.
type Dictionary = typeof es;

const en: Dictionary = {
  tabs: {
    home: 'Home',
    booking: 'Book',
    packs: 'Packs',
    profile: 'Profile',
  },
  home: {
    empty: {
      title: "You don't have any classes yet",
      subtitle:
        'Book your first 1:1 tutoring session with Gustavo and start making progress where it matters most.',
    },
  },
  settings: {
    title: 'Settings',
    language: {
      title: 'Language',
      es: 'Español',
      en: 'English',
    },
  },
  profile: {
    settingsRow: 'Settings',
  },
};

export const dictionaries: Record<Locale, Dictionary> = { es, en };

// ── Dotted-key types ──────────────────────────────────────────────────────────
// Recursively flatten the dictionary into a union of dotted paths
// ('tabs.home' | 'home.empty.title' | …) so t() gets autocomplete + typo safety.

type DottedKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DottedKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = DottedKeys<Dictionary>;

/** Resolve a dotted key against the locale's dictionary. Returns the key string
 *  itself if the path is missing (dev-visible, never crashes a render). */
export function translate(locale: Locale, key: TranslationKey): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionaries[locale]);
  return typeof value === 'string' ? value : key;
}
