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
    notifications: {
      title: 'Notificaciones',
      pushLabel: 'Notificaciones push',
      pushDesc: 'Avisos de tus próximas clases',
      leadLabel: 'Antelación del recordatorio',
      leadDesc: 'Cuánto antes te avisamos',
      waiting: 'Esperando permiso…',
      blockedTitle: 'Notificaciones bloqueadas',
      blockedDesc:
        'Están bloqueadas en el sistema. Actívalas para recibir avisos de tus clases.',
      openSystemSettings: 'Abrir ajustes del sistema',
    },
    calendar: {
      title: 'Calendario',
      label: 'Acceso al calendario',
      notConnected: 'No conectado · Google Calendar',
      connected: 'Conectado',
      connect: 'Conectar',
      blocked: 'Bloqueado · ábrelo en ajustes',
      helper: 'Añade automáticamente tus clases reservadas a tu calendario.',
    },
    language: {
      title: 'Idioma',
      label: 'Idioma de la app',
      es: 'Español',
      en: 'English',
    },
    signOut: 'Cerrar sesión',
  },
  profile: {
    title: 'Perfil',
    settingsRow: 'Ajustes',
    settingsRowDesc: 'Notificaciones, idioma y privacidad',
    googleLinked: 'Cuenta vinculada con Google',
    creditsOverline: 'Saldo de créditos',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
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
    notifications: {
      title: 'Notifications',
      pushLabel: 'Push notifications',
      pushDesc: 'Reminders for your upcoming classes',
      leadLabel: 'Reminder lead time',
      leadDesc: 'How far ahead we remind you',
      waiting: 'Waiting for permission…',
      blockedTitle: 'Notifications blocked',
      blockedDesc:
        'They are blocked in your system settings. Turn them on to get class reminders.',
      openSystemSettings: 'Open system settings',
    },
    calendar: {
      title: 'Calendar',
      label: 'Calendar access',
      notConnected: 'Not connected · Google Calendar',
      connected: 'Connected',
      connect: 'Connect',
      blocked: 'Blocked · open in settings',
      helper: 'Automatically add your booked classes to your calendar.',
    },
    language: {
      title: 'Language',
      label: 'App language',
      es: 'Español',
      en: 'English',
    },
    signOut: 'Sign out',
  },
  profile: {
    title: 'Profile',
    settingsRow: 'Settings',
    settingsRowDesc: 'Notifications, language and privacy',
    googleLinked: 'Account linked with Google',
    creditsOverline: 'Credit balance',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
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
