import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { api } from './api-client';
import { formatTime, leadTimeLabel } from './format';
import { translate } from './i18n/strings';
import { loadPersistedLocale } from './i18n/locale-store';
import { deriveLocale, getDeviceLanguage } from './i18n/device-locale';
import { loadNotificationPrefs } from './notification-store';
import {
  REMINDER_KIND,
  computeDesiredReminders,
  reconcileReminders,
  type DesiredReminder,
  type ScheduledReminder,
} from './class-reminders';
import type { Booking, Locale } from '../types/api';

// Effectful half of local class reminders — the ONLY module that talks to
// expo-notifications. Kept thin and out of unit tests (native side effects); all
// decision logic lives in the pure, tested lib/class-reminders.ts.
//
// expo-notifications is already compiled into the dev client; every call here is a
// JS runtime call into the linked module (no config plugin / rebuild needed).

/** Android notification channel for reminders (required on Android 8+/minSdk 28). */
export const REMINDER_CHANNEL_ID = 'class-reminders';

/** Resolve the active locale off-React: persisted choice wins, else device language. */
async function resolveLocale(): Promise<Locale> {
  return (await loadPersistedLocale()) ?? deriveLocale(getDeviceLanguage());
}

/** Create/refresh the Android channel. Idempotent no-op elsewhere. */
async function ensureAndroidChannel(locale: Locale): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: translate(locale, 'notifications.reminder.channelName'),
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** The reminders WE scheduled, read back from content.data. We carry fireAtMs in
 *  data because the trigger doesn't reliably surface the fire date cross-platform. */
async function listScheduledReminders(): Promise<ScheduledReminder[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ours: ScheduledReminder[] = [];
  for (const req of all) {
    const data = req.content.data as Record<string, unknown> | null | undefined;
    if (!data || data.kind !== REMINDER_KIND) continue;
    if (typeof data.eventId !== 'string' || typeof data.fireAtMs !== 'number') continue;
    ours.push({ identifier: req.identifier, eventId: data.eventId, fireAtMs: data.fireAtMs });
  }
  return ours;
}

async function scheduleOne(r: DesiredReminder, title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { kind: REMINDER_KIND, eventId: r.eventId, fireAtMs: r.fireAtMs },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: r.fireAtMs,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

async function cancelByIds(ids: string[]): Promise<void> {
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

/** Cancel every reminder WE scheduled (scoped — never touches other notifications). */
export async function cancelAllReminders(): Promise<void> {
  try {
    const ours = await listScheduledReminders();
    await cancelByIds(ours.map((r) => r.identifier));
  } catch {
    // best-effort; never throws
  }
}

// The list→reconcile→apply sequence isn't atomic, and Home-focus + session-ready can
// fire it concurrently. A simple in-flight guard prevents overlapping runs.
let syncing = false;

/**
 * Reconcile the OS-scheduled reminders with the current bookings + prefs.
 * Fire-and-forget: never throws. Pass an already-fetched booking list (Home has one)
 * to skip the network; otherwise it self-fetches.
 */
export async function syncClassReminders(bookings?: Booking[]): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const [prefs, perm] = await Promise.all([
      loadNotificationPrefs(),
      Notifications.getPermissionsAsync(),
    ]);

    // Disabled or permission not granted → the desired set is empty; clear ours.
    if (!prefs.enabled || perm.status !== 'granted') {
      await cancelAllReminders();
      return;
    }

    const locale = await resolveLocale();
    await ensureAndroidChannel(locale);

    // A fetch failure must NOT wipe valid reminders — bail without cancelling.
    let list: Booking[];
    if (bookings) {
      list = bookings;
    } else {
      try {
        list = (await api.getMyBookings()).bookings;
      } catch {
        return;
      }
    }

    const desired = computeDesiredReminders(list, prefs);
    const scheduled = await listScheduledReminders();
    const { toCancelIds, toSchedule } = reconcileReminders(desired, scheduled);

    await cancelByIds(toCancelIds);

    const title = translate(locale, 'notifications.reminder.title');
    const bodyTemplate = translate(locale, 'notifications.reminder.body');
    for (const r of toSchedule) {
      const body = bodyTemplate
        .replace('{lead}', leadTimeLabel(r.leadTimeMinutes))
        .replace('{time}', formatTime(new Date(r.startsAtMs).toISOString()));
      await scheduleOne(r, title, body);
    }
  } catch {
    // Reminders are a convenience; never let a scheduling error surface.
  } finally {
    syncing = false;
  }
}
