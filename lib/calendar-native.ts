import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

import { api } from './api-client';
import { API_BASE } from '../constants/config';
import { getDeviceTimeZone } from './grid-time';
import { translate, type TranslationKey } from './i18n/strings';
import { resolveActiveLocale } from './i18n/locale-store';
import {
  CALENDAR_LOOKAHEAD_MS,
  computeDesiredCalendarEvents,
  parseJoinToken,
  reconcileCalendarEvents,
  type DesiredCalendarEvent,
  type ExistingCalendarEvent,
} from './calendar-events';
import type { Booking, Locale } from '../types/api';

// Effectful half of the device-calendar mirror — the ONLY module that reads or
// writes calendar events (S18 only touches the permission API). Kept thin and out
// of unit tests (native side effects); all decision logic lives in the pure,
// tested lib/calendar-events.ts.
//
// expo-calendar is already compiled into the dev client (plugin `calendarPermission`,
// READ/WRITE_CALENDAR in the manifest); every call here is a JS runtime call into
// the linked module — no config change, no rebuild.

/** The calendar we write NEW events into. iOS: the system default. Android: prefer a
 *  local writable calendar, else the first writable one. (Reads span every writable
 *  calendar, so an event created under an earlier pick is still found.) */
async function pickWritableCalendarId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal.id;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const found =
    cals.find((c) => c.allowsModifications && c.source?.type === 'local') ??
    cals.find((c) => c.allowsModifications);
  if (!found) throw new Error('No writable calendar found');
  return found.id;
}

/** OUR events in the reconcile window, read back across every writable calendar
 *  and identified by the join token in their location/notes. */
async function listOurCalendarEvents(now: number): Promise<ExistingCalendarEvent[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = cals.filter((c) => c.allowsModifications).map((c) => c.id);
  if (ids.length === 0) return [];

  const events = await Calendar.getEventsAsync(
    ids,
    new Date(now),
    new Date(now + CALENDAR_LOOKAHEAD_MS),
  );
  const ours: ExistingCalendarEvent[] = [];
  for (const ev of events) {
    const joinToken = parseJoinToken(ev.location, ev.notes);
    if (!joinToken) continue;
    ours.push({
      id: ev.id,
      joinToken,
      startsAtMs: new Date(ev.startDate).getTime(),
      endsAtMs: new Date(ev.endDate).getTime(),
    });
  }
  return ours;
}

function eventTitleKey(sessionType: string): TranslationKey {
  if (sessionType === 'session2h') return 'calendar.eventTitle2h';
  if (sessionType === 'free15min') return 'calendar.eventTitle15';
  return 'calendar.eventTitle1h'; // session1h + pack
}

/** The full event body for a create. The join URL goes in BOTH location and notes:
 *  it is the identity the reconcile parses back (see lib/calendar-events.ts). */
function eventDetails(d: DesiredCalendarEvent, locale: Locale) {
  const joinUrl = `${API_BASE}/${locale}/sesion/${d.joinToken}`;
  return {
    title: translate(locale, eventTitleKey(d.sessionType)),
    startDate: new Date(d.startsAtMs),
    endDate: new Date(d.endsAtMs),
    timeZone: getDeviceTimeZone(),
    notes: `${translate(locale, 'calendar.joinLine')}\n${joinUrl}`,
    location: joinUrl,
  };
}

// The list→reconcile→apply sequence isn't atomic, and Home-focus + a post-mutation
// sync can fire it concurrently. A simple in-flight guard prevents overlapping runs.
let syncing = false;

/**
 * Reconcile the device calendar with the current bookings. Fire-and-forget: never
 * throws. No-op unless calendar access is granted. Pass an already-fetched booking
 * list (Home has one) to skip the network; otherwise it self-fetches.
 */
export async function syncCalendarEvents(bookings?: Booking[]): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    // Not connected → nothing to do (and nothing we could touch anyway).
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (perm.status !== 'granted') return;

    // A fetch failure must NOT wipe valid events — bail without deleting.
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

    const now = Date.now();
    const desired = computeDesiredCalendarEvents(list, now);
    const existing = await listOurCalendarEvents(now);
    const { toDeleteIds, toUpdate, toCreate } = reconcileCalendarEvents(desired, existing);

    for (const id of toDeleteIds) {
      await Calendar.deleteEventAsync(id);
    }
    for (const { id, desired: d } of toUpdate) {
      await Calendar.updateEventAsync(id, {
        startDate: new Date(d.startsAtMs),
        endDate: new Date(d.endsAtMs),
      });
    }
    if (toCreate.length > 0) {
      const locale = await resolveActiveLocale();
      const calendarId = await pickWritableCalendarId();
      for (const d of toCreate) {
        await Calendar.createEventAsync(calendarId, eventDetails(d, locale));
      }
    }
  } catch {
    // The calendar mirror is a convenience; never let a native error surface.
  } finally {
    syncing = false;
  }
}
