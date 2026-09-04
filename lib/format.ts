import type { TranslationKey } from './i18n/strings';
import type { Locale, SessionType } from '../types/api';

type TFn = (key: TranslationKey) => string;

export type Duration = '15min' | '1h' | '2h';

// Spanish uses day-before-month; en-GB keeps that ordering in English.
export function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

/**
 * Euro amounts stay es-ES regardless of the UI language — the product is priced
 * in euros for a Spanish business. (See CLAUDE.md, i18n known limitations.)
 */
export function formatEur(cents: number): string {
  const value = (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `€${value}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Reminder lead time as a short label: "10 min" / "1 h" (matches the S18 pills). */
export function leadTimeLabel(minutes: number): string {
  return minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`;
}

// Pack validity comes from the backend in DAYS (`packValidityDays`). The backend
// models a "month" as 30 days (its 180-day default = 6 months), so we show months
// only when the day count divides evenly into 30-day months, else the exact days.

/** Compact badge form: "6 m" (whole 30-day months) or "180 d". Unit symbols stay
 *  untranslated, matching `leadTimeLabel`. */
export function formatValidityCompact(days: number): string {
  return days > 0 && days % 30 === 0 ? `${days / 30} m` : `${days} d`;
}

/** Full pluralized phrase for sentences: "6 meses" / "1 mes" / "180 días" / "1 día"
 *  (and the EN equivalents), via the common.duration* keys. */
export function formatValidity(days: number, t: TFn): string {
  if (days > 0 && days % 30 === 0) {
    const months = days / 30;
    const key = months === 1 ? 'common.durationMonthsOne' : 'common.durationMonthsOther';
    return t(key).replace('{n}', String(months));
  }
  const key = days === 1 ? 'common.durationDaysOne' : 'common.durationDaysOther';
  return t(key).replace('{n}', String(days));
}

export function durationFromSessionType(sessionType: SessionType): Duration {
  if (sessionType === 'free15min') return '15min';
  return sessionType === 'session2h' ? '2h' : '1h';
}

export function durationLabel(duration: Duration, t: TFn): string {
  if (duration === '15min') return t('common.duration15min');
  return duration === '2h' ? t('common.duration2h') : t('common.duration1h');
}

/** "17:00 – 18:00 · 1 hora" */
export function formatTimeRange(startIso: string, endIso: string, duration: Duration, t: TFn): string {
  return `${formatTime(startIso)} – ${formatTime(endIso)} · ${durationLabel(duration, t)}`;
}

/** "Martes 17 jun" */
export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${capitalize(weekday)} ${day} ${month}`;
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}
