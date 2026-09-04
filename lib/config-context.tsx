import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api } from './api-client';
import { useAuth } from './auth-context';
import type { GetScheduleResponse } from '../types/api';

// ── Config context ────────────────────────────────────────────────────────────
// Holds the admin-editable booking policy that the schedule endpoint carries —
// currently the cancel/reschedule notice window (`cancelMinNoticeHours`). Many
// screens render or gate on that value, but only the booking grid ever fetched
// `/api/schedule` before; rather than have every cancel/reschedule/policy screen
// fire its own request, this provider fetches it ONCE on session-ready and
// re-fetches when the app returns to the foreground (the cadence CLAUDE.md
// prescribes for schedule — it reflects admin edits immediately).
//
// The pattern mirrors lib/auth.ts + lib/auth-context.tsx: a module-level
// synchronous cache is the source of truth, mirrored into reactive React state so
// components re-render when it arrives. `ensureSchedule()` is also the single
// fetch the booking grid reuses (see app/(tabs)/(booking)/schedule.tsx), so
// `/api/schedule` is fetched once app-wide.
//
// The value is ADVISORY on the client — every gate is re-enforced server-side
// (OUTSIDE_CANCEL_WINDOW / OUTSIDE_RESCHEDULE_WINDOW). So a default is always safe.

export const DEFAULT_CANCEL_MIN_NOTICE_HOURS = 2;

// Module-level synchronous cache + in-flight promise (shared with the grid).
let cachedSchedule: GetScheduleResponse | null = null;
let inFlight: Promise<GetScheduleResponse> | null = null;

/** Returns the cached schedule, the in-flight fetch, or starts a new one. Callers
 *  that already need the full schedule (the booking grid) reuse this so the
 *  endpoint is hit once. Force a fresh fetch with `refreshSchedule()`. */
export function ensureSchedule(): Promise<GetScheduleResponse> {
  if (cachedSchedule) return Promise.resolve(cachedSchedule);
  if (inFlight) return inFlight;
  inFlight = api
    .getSchedule()
    .then((res) => {
      cachedSchedule = res;
      return res;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

function refreshSchedule(): Promise<GetScheduleResponse> {
  cachedSchedule = null;
  return ensureSchedule();
}

type ConfigContextValue = {
  /** The full schedule once fetched; null until then. */
  schedule: GetScheduleResponse | null;
  /** Cancel/reschedule notice window in hours; falls back to the default. */
  cancelMinNoticeHours: number;
  /** True once the first fetch has resolved. */
  ready: boolean;
  /** Force a fresh fetch (e.g. after an action that could change the config). */
  refresh: () => Promise<void>;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const isSignedIn = !!session;
  const [schedule, setSchedule] = useState<GetScheduleResponse | null>(cachedSchedule);

  // Fetch once the user is signed in (the endpoint needs the bearer). A failure is
  // swallowed — the default keeps copy readable and the server enforces the gate.
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    ensureSchedule()
      .then((res) => {
        if (active) setSchedule(res);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  // Refresh on return to foreground so admin edits land without a relaunch.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refreshSchedule()
          .then(setSchedule)
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isSignedIn]);

  const value = useMemo<ConfigContextValue>(
    () => ({
      schedule,
      cancelMinNoticeHours: schedule?.cancelMinNoticeHours ?? DEFAULT_CANCEL_MIN_NOTICE_HOURS,
      ready: schedule !== null,
      async refresh() {
        try {
          setSchedule(await refreshSchedule());
        } catch {
          // keep the last good value
        }
      },
    }),
    [schedule],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within a ConfigProvider');
  return ctx;
}
