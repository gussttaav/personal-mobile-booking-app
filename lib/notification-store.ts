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
  /** Minutes before a class to remind. One of the offered presets (default 10). */
  leadTimeMinutes: number;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: false,
  leadTimeMinutes: 10,
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
      leadTimeMinutes:
        typeof parsed.leadTimeMinutes === 'number'
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
