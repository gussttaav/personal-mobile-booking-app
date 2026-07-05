import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { Locale, SessionType } from '@/types/api';

type TFn = (key: TranslationKey) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────
// Screen-local (matches confirm.tsx / home conventions). Kept self-contained.

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

// "Jueves 26 jun" / "Thursday 26 Jun"
function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

// "18:00 – 19:00 · 1 hora" / "17:00 – 17:15 · 15 min"
function formatTimeRange(startIso: string, endIso: string, duration: '15min' | '1h' | '2h', locale: Locale, t: TFn): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(bcp47(locale), { hour: '2-digit', minute: '2-digit', hour12: false });
  const label =
    duration === '15min' ? t('common.duration15min')
    : duration === '2h' ? t('common.duration2h')
    : t('common.duration1h');
  return `${fmt(startIso)} – ${fmt(endIso)} · ${label}`;
}

function durationFromSessionType(sessionType: string): '15min' | '1h' | '2h' {
  if (sessionType === 'free15min') return '15min';
  return sessionType === 'session2h' ? '2h' : '1h';
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingSuccessScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{
    eventId?: string;
    startIso?: string;
    endIso?: string;
    sessionType?: string;
    joinToken?: string;
    emailFailed?: string;
    remainingCredits?: string;
  }>();

  const eventId = params.eventId ?? '';
  const start = params.startIso ?? '';
  const end = params.endIso ?? '';
  const sessionType = (params.sessionType ?? 'session1h') as SessionType;
  const joinToken = params.joinToken ?? '';
  const emailFailed = params.emailFailed === 'true';
  const duration = durationFromSessionType(sessionType);
  // Credit (pack) bookings pass the post-booking balance. 0 → that was the last
  // credit of the pack; surface a gentle nudge to repurchase.
  const spentLastCredit = sessionType === 'pack' && params.remainingCredits === '0';

  // Land on Inicio without leaving the completed booking stack behind: collapse
  // it to its root first, then switch tabs. (S08 sits atop the full flow.)
  const goHome = useCallback(() => {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/(tabs)/(home)');
  }, []);

  const goJoin = useCallback(() => {
    // S14 exchanges the eventId for a Zoom join token on "Entrar". Pass the
    // timing so it can render the start-time chip before the token is fetched.
    router.push({ pathname: '/video-prejoin', params: { eventId, startsAt: start, sessionType } });
  }, [eventId, start, sessionType]);

  const goDetail = useCallback(() => {
    // S11 detalle is still a placeholder; route toward it with what we have.
    router.push({ pathname: '/(tabs)/(home)/booking-detail', params: { eventId } });
  }, [eventId]);

  const goPacks = useCallback(() => {
    router.push('/(tabs)/(packs)/packs');
  }, []);

  const addToCalendar = useCallback(() => {
    router.push({
      pathname: '/add-to-calendar',
      params: { startIso: start, endIso: end, sessionType, joinToken },
    });
  }, [start, end, sessionType, joinToken]);

  return (
    <View style={styles.screen}>
      {/* Emerald ambient top glow */}
      <LinearGradient
        colors={['rgba(78, 222, 163, 0.18)', 'rgba(19, 19, 21, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      {/* Minimal app bar — close routes back to Inicio */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing[1] }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={goHome}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.backHome')}
        >
          <MaterialCommunityIcons name="close" size={22} color={Colors.textDim} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
      >
        {/* ── Success hero ─────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <MaterialCommunityIcons name="check" size={40} color={Colors.primary} />
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{t('success.pill')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('success.title')}</Text>

          {emailFailed && (
            <View style={styles.emailNote}>
              <MaterialCommunityIcons name="information-outline" size={15} color={Colors.textDim} />
              <Text style={styles.emailNoteText}>
                {t('success.emailNote')}
              </Text>
            </View>
          )}
        </View>

        {/* ── Booking summary ──────────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryOverline}>{t('common.yourBooking')}</Text>

          <View style={styles.summaryDateRow}>
            <View style={styles.summaryCalIcon}>
              <MaterialCommunityIcons name="calendar-check" size={22} color={Colors.primary} />
            </View>
            <View style={styles.summaryDateText}>
              <Text style={styles.summaryDate}>{formatDate(start, locale)}</Text>
              <Text style={styles.summaryTime}>{formatTimeRange(start, end, duration, locale, t)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.summaryTutorRow}>
            <View style={styles.summaryAvatar}>
              <Text style={styles.summaryAvatarText}>GT</Text>
            </View>
            <View style={styles.summaryTutorInfo}>
              <Text style={styles.summaryTutorName}>{t('common.tutorName')}</Text>
              <Text style={styles.summaryTutorSub}>{t('common.tutorSubtitle')}</Text>
            </View>
            <Text style={styles.summaryTz}>{t('common.timezone')}</Text>
          </View>
        </View>

        {/* ── Last-credit nudge (pack depleted by this booking) ────────────── */}
        {spentLastCredit && (
          <View style={styles.depletedCard}>
            <View style={styles.depletedIcon}>
              <MaterialCommunityIcons name="timer-off-outline" size={20} color={Colors.warning} />
            </View>
            <View style={styles.depletedText}>
              <Text style={styles.depletedTitle}>{t('success.depleted.title')}</Text>
              <Text style={styles.depletedBody}>
                {t('success.depleted.body')}
              </Text>
              <TouchableOpacity onPress={goPacks} activeOpacity={0.7} style={styles.depletedLink}>
                <Text style={styles.depletedLinkText}>{t('common.seePacks')}</Text>
                <MaterialCommunityIcons name="arrow-right" size={15} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── How to join ──────────────────────────────────────────────────── */}
        <View style={styles.joinCard}>
          <View style={styles.joinHeader}>
            <View style={styles.joinIcon}>
              <MaterialCommunityIcons name="video-outline" size={21} color={Colors.primary} />
            </View>
            <View style={styles.joinHeaderText}>
              <Text style={styles.joinTitle}>{t('success.join.title')}</Text>
              <Text style={styles.joinBody}>
                {t('success.join.body')}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={goJoin} activeOpacity={0.8}>
            <MaterialCommunityIcons name="video" size={17} color={Colors.primary} />
            <Text style={styles.joinBtnText}>{t('success.join.cta')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Sticky action bar ──────────────────────────────────────────────── */}
      <View style={styles.stickyBar}>
        <TouchableOpacity style={styles.calBtn} onPress={addToCalendar} activeOpacity={0.85}>
          <MaterialCommunityIcons name="calendar-plus" size={18} color={Colors.onPrimary} />
          <Text style={styles.calBtnText}>{t('addToCalendar.title')}</Text>
        </TouchableOpacity>
        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goDetail} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>{t('success.seeDetail')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={goHome} activeOpacity={0.7}>
            <Text style={styles.secondaryBtnText}>{t('common.backHome')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },

  // App bar
  appBar: {
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing[2],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll body
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[1],
    gap: Spacing[4] - 2,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Spacing[3],
    paddingHorizontal: Spacing[2],
  },
  heroBadge: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    // Static emerald glow (boxShadow works on Android via New Arch).
    boxShadow: '0px 0px 38px rgba(78, 222, 163, 0.35)',
  } as any,
  heroPill: {
    marginTop: Spacing[4] + 2,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 1,
    paddingVertical: 6,
  },
  heroPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  heroTitle: {
    ...TypeScale.h2,
    fontSize: 25,
    lineHeight: 29,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing[3] + 2,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
    marginTop: Spacing[2],
  },
  emailNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing[3],
    maxWidth: 300,
  },
  emailNoteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Summary card
  summaryCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[2],
    marginTop: Spacing[2],
  },
  summaryOverline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginBottom: Spacing[3],
  },
  summaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[4] - 2,
  },
  summaryCalIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDateText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryDate: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  summaryTime: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  summaryTutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3] - 2,
    paddingVertical: Spacing[3],
  },
  summaryAvatar: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: 'rgba(78, 222, 163, 0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.textMuted,
  },
  summaryTutorInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  summaryTutorName: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryTutorSub: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 15,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  summaryTz: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Last-credit nudge
  depletedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: 14,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    padding: Spacing[4],
  },
  depletedIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depletedText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  depletedTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  depletedBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 19,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  depletedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing[2],
  },
  depletedLinkText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },

  // Join card
  joinCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing[4],
  },
  joinHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
  joinIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  joinTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  joinBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 19,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 46,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    marginTop: Spacing[3],
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },

  // Sticky action bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 19, 21, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: Spacing[3],
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    gap: Spacing[2] + 2,
  },
  calBtn: {
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    boxShadow: '0px 0px 26px rgba(78, 222, 163, 0.35)',
  } as any,
  calBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing[2] + 2,
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
