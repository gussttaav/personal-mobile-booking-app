import * as SecureStore from 'expo-secure-store';

// ── Persisted notification preferences ────────────────────────────────────────
// Local-only: there is NO backend for notification prefs (confirmed). Thin wrapper
// over expo-secure-store (mirrors lib/locale-store.ts / lib/token-store.ts) — the
// only storage module compiled into the dev client, so no new native dep / rebuild.
//
// This captures the PREFERENCE only. Actual scheduling (syncing reminders with the
// booking lifecycle) is a separate follow-on task — see settings.tsx.

export interface NotificationPreferences {
  /** Whether the user wants class reminders. Only meaningful with OS permission. */
  enabled: boolean;
  /** Minutes before a class to remind. Always one of LEAD_TIME_OPTIONS. */
  leadTimeMinutes: number;
}

/** The lead times offered in S18, in minutes: 30 min / 1 h / 1 day.
 *
 *  The 30-minute floor is deliberate. Android delivers these reminders on an
 *  INEXACT alarm — expo-notifications falls back to `setAndAllowWhileIdle` when
 *  `canScheduleExactAlarms()` is false, which it is without SCHEDULE_EXACT_ALARM
 *  — so Doze can defer a reminder by many minutes. Short leads made that drift
 *  land AFTER the class had started; a longer lead keeps it harmless. */
export const LEAD_TIME_OPTIONS: readonly number[] = [30, 60, 1440];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  leadTimeMinutes: 30,
};

const NOTIFICATION_PREFS_KEY = 'app.notification-prefs';

/** Load persisted prefs, falling back to defaults when unset or corrupt. */
export async function loadNotificationPrefs(): Promise<NotificationPreferences> {
  const raw = await SecureStore.getItemAsync(NOTIFICATION_PREFS_KEY);
  if (!raw) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_NOTIFICATION_PREFS.enabled,
      // Coerce a value that is no longer offered (the 5/10/15-minute presets
      // this build dropped) back to the default, so S18 never renders with no
      // pill selected and no reminder is left on a too-short lead.
      leadTimeMinutes:
        typeof parsed.leadTimeMinutes === 'number' &&
        LEAD_TIME_OPTIONS.includes(parsed.leadTimeMinutes)
          ? parsed.leadTimeMinutes
          : DEFAULT_NOTIFICATION_PREFS.leadTimeMinutes,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export async function persistNotificationPrefs(prefs: NotificationPreferences): Promise<void> {
  await SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}
