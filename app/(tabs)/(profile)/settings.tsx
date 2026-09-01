import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/i18n/locale-context';
import { leadTimeLabel } from '@/lib/format';
import { syncClassReminders } from '@/lib/notifications-native';
import {
  DEFAULT_NOTIFICATION_PREFS,
  loadNotificationPrefs,
  persistNotificationPrefs,
  type NotificationPreferences,
} from '@/lib/notification-store';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { Locale } from '@/types/api';

// S18 · Ajustes — settings list: notification preference (toggle + reminder lead
// time), calendar permission, language (ES/EN) and sign-out.
//
// Changing the preference or lead time re-syncs the scheduled class reminders via
// syncClassReminders() (lib/notifications-native.ts) — enabling schedules them,
// disabling cancels them, a new lead time re-times them.

type PermStatus = 'granted' | 'denied' | 'undetermined';

const LANGUAGE_OPTIONS: { value: Locale; labelKey: 'settings.language.es' | 'settings.language.en' }[] = [
  { value: 'es', labelKey: 'settings.language.es' },
  { value: 'en', labelKey: 'settings.language.en' },
];

const LEAD_TIMES = [5, 10, 15, 30, 60];

export default function SettingsScreen() {
  const { locale, setLocale, t } = useLocale();
  const { signOut } = useAuth();

  // ── Notifications ──
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [notifPerm, setNotifPerm] = useState<PermStatus>('undetermined');
  const [requestingNotif, setRequestingNotif] = useState(false);

  // ── Calendar ──
  const [calPerm, setCalPerm] = useState<PermStatus>('undetermined');

  // ── Language ──
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  // ── Sign out ──
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [stored, notif, cal] = await Promise.all([
        loadNotificationPrefs(),
        Notifications.getPermissionsAsync(),
        Calendar.getCalendarPermissionsAsync(),
      ]);
      if (!active) return;
      setPrefs(stored);
      setNotifPerm(notif.status as PermStatus);
      setCalPerm(cal.status as PermStatus);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The toggle is ON only when the user wants it AND the OS still grants it —
  // never show "on" without permission.
  const notifOn = prefs.enabled && notifPerm === 'granted';
  const notifBlocked = notifPerm === 'denied';

  async function onToggleNotif(next: boolean) {
    if (!next) {
      const updated = { ...prefs, enabled: false };
      setPrefs(updated);
      await persistNotificationPrefs(updated);
      void syncClassReminders(); // disabled → cancels all scheduled reminders
      return;
    }
    // Enabling: request OS permission first.
    setRequestingNotif(true);
    try {
      const res = await Notifications.requestPermissionsAsync();
      setNotifPerm(res.status as PermStatus);
      const enabled = res.status === 'granted';
      const updated = { ...prefs, enabled };
      setPrefs(updated);
      await persistNotificationPrefs(updated);
      void syncClassReminders(); // granted → schedules reminders for upcoming classes
    } finally {
      setRequestingNotif(false);
    }
  }

  async function chooseLeadTime(minutes: number) {
    const updated = { ...prefs, leadTimeMinutes: minutes };
    setPrefs(updated);
    await persistNotificationPrefs(updated);
    void syncClassReminders(); // new lead time → re-times existing reminders
  }

  async function onConnectCalendar() {
    const res = await Calendar.requestCalendarPermissionsAsync();
    setCalPerm(res.status as PermStatus);
    // No second prompt available → recover via the system settings app.
    if (res.status !== 'granted' && !res.canAskAgain) {
      Linking.openSettings();
    }
  }

  async function chooseLocale(next: Locale) {
    if (next === locale || pendingLocale) return;
    setPendingLocale(next);
    try {
      await setLocale(next);
    } catch {
      // setLocale already switched the UI + persisted locally; only the backend
      // sync failed. Leave the new language in place — the next sign-in reconciles.
    } finally {
      setPendingLocale(null);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(); // clears the token + flips the guard → routes to login
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('settings.title'),
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── NOTIFICACIONES ── */}
        <Text style={styles.sectionTitle}>{t('settings.notifications.title')}</Text>

        {notifBlocked && (
          <View style={styles.banner}>
            <MaterialCommunityIcons name="alert-outline" size={19} color={Colors.error} style={styles.bannerIcon} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>{t('settings.notifications.blockedTitle')}</Text>
              <Text style={styles.bannerDesc}>{t('settings.notifications.blockedDesc')}</Text>
              <Pressable style={styles.bannerBtn} onPress={() => Linking.openSettings()}>
                <MaterialCommunityIcons name="open-in-new" size={15} color={Colors.error} />
                <Text style={styles.bannerBtnText}>{t('settings.notifications.openSystemSettings')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, styles.rowIconAccent]}>
              <MaterialCommunityIcons name="bell-outline" size={19} color={Colors.primary} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{t('settings.notifications.pushLabel')}</Text>
              <Text style={styles.rowSubtitle}>
                {requestingNotif ? t('settings.notifications.waiting') : t('settings.notifications.pushDesc')}
              </Text>
            </View>
            <Switch
              value={notifOn}
              onValueChange={onToggleNotif}
              disabled={requestingNotif}
              trackColor={{ false: Colors.surfaceHigh, true: Colors.primary }}
              thumbColor={notifOn ? Colors.onPrimary : '#4a4a4d'}
            />
          </View>

          <View style={styles.divider} />

          <View style={[styles.leadSection, !notifOn && styles.disabled]} pointerEvents={notifOn ? 'auto' : 'none'}>
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name="clock-outline" size={19} color={Colors.textMuted} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>{t('settings.notifications.leadLabel')}</Text>
                <Text style={styles.rowSubtitle}>{t('settings.notifications.leadDesc')}</Text>
              </View>
            </View>
            <View style={styles.pillRow}>
              {LEAD_TIMES.map((m) => {
                const active = prefs.leadTimeMinutes === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => chooseLeadTime(m)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{leadTimeLabel(m)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── CALENDARIO ── */}
        <Text style={styles.sectionTitle}>{t('settings.calendar.title')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, calPerm === 'granted' && styles.rowIconAccent]}>
              <MaterialCommunityIcons
                name={calPerm === 'granted' ? 'calendar-check' : 'calendar-outline'}
                size={19}
                color={calPerm === 'granted' ? Colors.primary : Colors.textMuted}
              />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{t('settings.calendar.label')}</Text>
              {calPerm === 'granted' ? (
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusConnected}>{t('settings.calendar.connected')}</Text>
                </View>
              ) : (
                <Text style={styles.rowSubtitle}>
                  {calPerm === 'denied' ? t('settings.calendar.blocked') : t('settings.calendar.notConnected')}
                </Text>
              )}
            </View>
            {calPerm !== 'granted' && (
              <Pressable
                style={styles.connectBtn}
                onPress={calPerm === 'denied' ? () => Linking.openSettings() : onConnectCalendar}
              >
                <Text style={styles.connectBtnText}>
                  {calPerm === 'denied'
                    ? t('settings.notifications.openSystemSettings')
                    : t('settings.calendar.connect')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.helper}>{t('settings.calendar.helper')}</Text>

        {/* ── IDIOMA ── */}
        <Text style={styles.sectionTitle}>{t('settings.language.title')}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="web" size={19} color={Colors.textMuted} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{t('settings.language.label')}</Text>
              <Text style={styles.rowSubtitle}>{t(`settings.language.${locale}`)}</Text>
            </View>
          </View>
          <View style={styles.segment}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = opt.value === locale;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => chooseLocale(opt.value)}
                  disabled={pendingLocale != null}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {t(opt.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── SIGN OUT ── */}
        <Pressable
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <MaterialCommunityIcons name="logout" size={18} color={Colors.error} />
          <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
        </Pressable>

        <Text style={styles.footer}>gustavoai.dev · {t('common.version')} 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[8],
  },
  sectionTitle: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginTop: Spacing[5],
    marginBottom: Spacing[3],
    marginLeft: 2,
  },
  card: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  banner: {
    flexDirection: 'row',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
    padding: Spacing[3] + 1,
    marginBottom: Spacing[3],
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerBody: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    fontSize: 13,
    color: Colors.error,
  },
  bannerDesc: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: 3,
  },
  bannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing[1] + 2,
    height: 36,
    paddingHorizontal: Spacing[3] + 2,
    marginTop: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
  },
  bannerBtnText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconAccent: {
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  rowSubtitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing[4],
  },
  leadSection: {
    paddingBottom: Spacing[4],
  },
  disabled: {
    opacity: 0.45,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  pill: {
    paddingHorizontal: Spacing[3] + 2,
    paddingVertical: Spacing[2] + 1,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainer,
  },
  pillActive: {
    backgroundColor: 'rgba(78, 222, 163, 0.14)',
    borderColor: Colors.successBorder,
  },
  pillText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  pillTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1] + 2,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  statusConnected: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '500',
    color: Colors.primary,
  },
  connectBtn: {
    height: 36,
    paddingHorizontal: Spacing[4],
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.primaryDim,
  },
  connectBtnText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  helper: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: Spacing[2],
    marginLeft: 2,
  },
  segment: {
    flexDirection: 'row',
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[4],
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[1],
    gap: Spacing[1],
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing[3] - 2,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: Colors.primary,
  },
  segmentLabel: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  segmentLabelActive: {
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 50,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
    marginTop: Spacing[6],
  },
  signOutText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },
  footer: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: Spacing[6],
  },
});
