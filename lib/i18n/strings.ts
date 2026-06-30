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
  addToCalendar: {
    title: 'Añadir al calendario',
    eventTitle1h: 'Sesión de 1 hora con Gustavo Torres',
    eventTitle2h: 'Sesión de 2 horas con Gustavo Torres',
    eventTitle15: 'Sesión gratuita de 15 min con Gustavo Torres',
    joinLine: 'Únete a tu clase:',
    checking: 'Comprobando acceso…',
    requestTitle: 'Acceso al calendario',
    requestDesc: 'Necesitamos acceder a tu calendario para guardar la clase.',
    requestBtn: 'Conceder acceso',
    adding: 'Añadiendo al calendario…',
    successTitle: 'Añadido al calendario',
    successDesc: 'Tu clase se ha guardado en tu calendario.',
    done: 'Listo',
    deniedTitle: 'Acceso denegado',
    deniedDesc: 'Para añadir clases, activa el permiso de calendario en los ajustes del sistema.',
    openSettings: 'Abrir ajustes',
    dismiss: 'Cerrar',
    errorTitle: 'Error al añadir',
    errorDesc: 'No se pudo guardar la clase en el calendario.',
    retry: 'Reintentar',
  },
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
  sessionExpired: {
    badge: 'Sesión caducada',
    title: 'Tu sesión ha caducado',
    description:
      'Por seguridad cerramos tu sesión tras un tiempo. Vuelve a entrar para continuar.',
    continueAsLabel: 'Continuar como',
    googleSignIn: 'Iniciar sesión con Google',
    signingIn: 'Iniciando sesión…',
    appleComingSoon: 'Próximamente en iOS',
    errorMessage: 'No pudimos volver a iniciar sesión. Inténtalo de nuevo.',
    offlineMessage: 'Sin conexión. Comprueba tu red e inténtalo de nuevo.',
  },
};

// `es` is canonical; leaves widen to `string` (no `as const`) so `en` may hold
// different copy while TS still enforces an identical key tree across languages.
type Dictionary = typeof es;

const en: Dictionary = {
  addToCalendar: {
    title: 'Add to calendar',
    eventTitle1h: '1-hour session with Gustavo Torres',
    eventTitle2h: '2-hour session with Gustavo Torres',
    eventTitle15: 'Free 15-min session with Gustavo Torres',
    joinLine: 'Join your class:',
    checking: 'Checking access…',
    requestTitle: 'Calendar access',
    requestDesc: 'We need calendar access to save the class.',
    requestBtn: 'Grant access',
    adding: 'Adding to calendar…',
    successTitle: 'Added to calendar',
    successDesc: 'Your class has been saved to your calendar.',
    done: 'Done',
    deniedTitle: 'Access denied',
    deniedDesc: 'To add classes, enable the calendar permission in your system settings.',
    openSettings: 'Open settings',
    dismiss: 'Close',
    errorTitle: 'Failed to add',
    errorDesc: "The class couldn't be saved to your calendar.",
    retry: 'Retry',
  },
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
  sessionExpired: {
    badge: 'Session expired',
    title: 'Your session has expired',
    description:
      'For your security we signed you out after a while. Sign back in to continue.',
    continueAsLabel: 'Continue as',
    googleSignIn: 'Sign in with Google',
    signingIn: 'Signing in…',
    appleComingSoon: 'Coming soon on iOS',
    errorMessage: "We couldn't sign you back in. Try again.",
    offlineMessage: 'No connection. Check your network and try again.',
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
