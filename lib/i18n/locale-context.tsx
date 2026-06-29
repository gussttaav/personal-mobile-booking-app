import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '../api-client';
import { onAuthExchange } from '../auth';
import type { Locale } from '../../types/api';
import { deriveLocale, getDeviceLanguage } from './device-locale';
import { loadPersistedLocale, persistLocale } from './locale-store';
import { translate, type TranslationKey } from './strings';

// ── Locale context ────────────────────────────────────────────────────────────
// Holds the reactive UI language and exposes setLocale (S18) + a t() resolver.
//
// Sources, by precedence:
//   1. On a real sign-in (onAuthExchange — interactive OR silent refresh), the
//      backend's user.locale is AUTHORITATIVE. Non-null wins, even over device
//      language. Null = new user the backend never seeded → derive from device
//      and POST /api/locale once to seed the DB (booking/cancel EMAILS default to
//      'es' until this lands, so seed early, not lazily).
//   2. On a normal (persisted) launch, the device-stored choice is used as-is —
//      we never re-derive from device language and never override a saved choice.
//   3. First-ever launch with nothing stored: derive from device for the UI only
//      (no POST — the seed happens through the sign-in reconcile above).

type LocaleContextValue = {
  locale: Locale;
  /** Switch the UI language, persist to device, AND sync to the backend
   *  (POST /api/locale) so DB-driven emails stay in the same language. Awaitable
   *  so the settings screen can surface a failed sync. */
  setLocale: (locale: Locale) => Promise<void>;
  /** Resolve a dotted translation key in the current language. */
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Seed synchronously from device language so the first render is localized;
  // refined by the persisted value / sign-in reconcile below.
  const [locale, setLocaleState] = useState<Locale>(() => deriveLocale(getDeviceLanguage()));

  // State + device persistence, no backend write. Used when adopting a value the
  // backend already knows, and as the inner step of setLocale.
  const applyLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void persistLocale(next);
  }, []);

  // Launch hydration: trust the device-stored choice; only fall back to device
  // language (UI-only) when nothing is stored yet.
  useEffect(() => {
    let active = true;
    loadPersistedLocale()
      .then((stored) => {
        if (active && stored) setLocaleState(stored);
      })
      .catch(() => {
        /* unreadable store — keep the device-derived default */
      });
    return () => {
      active = false;
    };
  }, []);

  // Sign-in reconcile policy (see header). Runs ONLY on a fresh token exchange.
  useEffect(() => {
    return onAuthExchange((session) => {
      const backendLocale = session.user.locale;
      if (backendLocale != null) {
        applyLocale(backendLocale); // stored preference wins — no POST
        return;
      }
      const derived = deriveLocale(getDeviceLanguage());
      applyLocale(derived);
      // Best-effort seed; if it fails the backend stays null and the next
      // exchange retries. We do NOT await — sign-in shouldn't block on it.
      api.postLocale({ locale: derived }).catch(() => {});
    });
  }, [applyLocale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      applyLocale(next);
      await api.postLocale({ locale: next });
    },
    [applyLocale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t: (key) => translate(locale, key) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}

/** Convenience hook for components that only need the resolver. */
export function useT(): (key: TranslationKey) => string {
  return useLocale().t;
}
