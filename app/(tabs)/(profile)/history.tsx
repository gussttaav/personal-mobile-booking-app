import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HistoryRow } from '@/components/HistoryRow';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { api, ApiError } from '@/lib/api-client';
import { fetchAllHistory, groupByMonth, historyStats } from '@/lib/history';
import { useLocale } from '@/lib/i18n/locale-context';
import type { HistoryBooking } from '@/types/api';

type ScreenState = 'loading' | 'load_error' | 'ready';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();

  const [state, setState] = useState<ScreenState>('loading');
  const [bookings, setBookings] = useState<HistoryBooking[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Only skeleton the first load; a return from the review flow refreshes silently.
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (showSkeleton: boolean) => {
      if (showSkeleton) setState('loading');
      try {
        const all = await fetchAllHistory((params) => api.getMyBookingsHistory(params));
        setBookings(all);
        setState('ready');
        hasLoadedRef.current = true;
      } catch (err) {
        setErrorMsg(loadErrorMessage(err, t));
        // A failed silent refresh must not wipe a list we are already showing.
        if (!hasLoadedRef.current) setState('load_error');
      }
    },
    [t],
  );

  useFocusEffect(
    useCallback(() => {
      load(!hasLoadedRef.current);
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }, [load]);

  const groups = useMemo(() => groupByMonth(bookings, locale), [bookings, locale]);
  const stats = useMemo(() => historyStats(bookings), [bookings]);
  const oldestMonthLabel = groups.length > 0 ? groups[groups.length - 1].label : '';

  const openDetail = useCallback((b: HistoryBooking) => {
    router.push({
      pathname: '/(tabs)/(profile)/history-detail',
      params: {
        id: b.id,
        eventId: b.eventId,
        sessionType: b.sessionType,
        status: b.status,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        packSize: b.packSize != null ? String(b.packSize) : undefined,
        note: b.note ?? undefined,
        amountCents: b.amountCents != null ? String(b.amountCents) : undefined,
        rating: b.review != null ? String(b.review.rating) : undefined,
        comment: b.review?.comment ?? undefined,
      },
    });
  }, []);

  const isEmpty = state === 'ready' && bookings.length === 0;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['rgba(78, 222, 163, 0.13)', 'rgba(19, 19, 21, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      {/* ── App bar ─────────────────────────────────────────────────────────── */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing[1] }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{t('history.title')}</Text>
        {state === 'ready' && bookings.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {stats.total === 1
                ? t('history.classCountOne')
                : t('history.classCount').replace('{n}', String(stats.total))}
            </Text>
          </View>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <View style={styles.skeletonBody}>
          <SkeletonBlock width="100%" height={62} borderRadius={12} />
          <SkeletonBlock width={120} height={14} borderRadius={Radius.sm} />
          <SkeletonBlock width="100%" height={70} borderRadius={13} />
          <SkeletonBlock width="100%" height={70} borderRadius={13} />
          <SkeletonBlock width="100%" height={70} borderRadius={13} />
        </View>
      )}

      {/* ── Load error ──────────────────────────────────────────────────────── */}
      {state === 'load_error' && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load(true)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Empty ───────────────────────────────────────────────────────────── */}
      {isEmpty && (
        <View style={styles.emptyBody}>
          <View style={styles.emptyIconTile}>
            <MaterialCommunityIcons name="history" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('history.emptyBody')}</Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => router.push('/(tabs)/(booking)/session-type')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="calendar-plus" size={18} color={Colors.onPrimary} />
            <Text style={styles.emptyCtaText}>{t('history.emptyCta')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────────── */}
      {state === 'ready' && bookings.length > 0 && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing[6] },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Summary strip */}
          <View style={styles.statStrip}>
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={styles.statLabel}>{t('history.statCompleted')}</Text>
            </View>
            {stats.avgRating != null && (
              <View style={styles.statTile}>
                <View style={styles.statValueRow}>
                  <Text style={[styles.statValue, styles.statValueAccent]}>
                    {stats.avgRating.toFixed(1)}
                  </Text>
                  <MaterialCommunityIcons name="star" size={14} color={Colors.primary} />
                </View>
                <Text style={styles.statLabel}>{t('history.statAvgRating')}</Text>
              </View>
            )}
          </View>

          {/* Month groups */}
          {groups.map((group) => (
            <View key={group.key} style={styles.monthSection}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthLabel}>{group.label}</Text>
                <View style={styles.monthRule} />
              </View>
              <View style={styles.monthRows}>
                {group.items.map((b) => (
                  <HistoryRow key={b.id} booking={b} onPress={() => openDetail(b)} />
                ))}
              </View>
            </View>
          ))}

          <Text style={styles.endOfHistory}>
            {t('history.endOfHistory').replace('{month}', oldestMonthLabel)}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function loadErrorMessage(err: unknown, t: (key: 'errors.tooManyAttempts' | 'errors.loadFailed' | 'history.loadWhat') => string): string {
  if (err instanceof ApiError && err.status === 429) return t('errors.tooManyAttempts');
  return t('errors.loadFailed').replace('{what}', t('history.loadWhat'));
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
    height: 220,
  },

  // App bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingBottom: Spacing[2],
    gap: Spacing[1],
    zIndex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.16,
  },
  countPill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
  },
  countPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
  },

  // Summary strip
  statStrip: {
    flexDirection: 'row',
    gap: Spacing[2] + 2,
    marginBottom: Spacing[5] - 2,
  },
  statTile: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: Spacing[3] + 1,
    paddingHorizontal: Spacing[3] + 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.44,
  },
  statValueAccent: {
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 5,
  },

  // Month sections
  monthSection: {
    marginBottom: Spacing[5] + 2,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] + 2,
    marginBottom: Spacing[3] - 1,
    paddingHorizontal: 2,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  monthRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  monthRows: {
    gap: Spacing[2] + 2,
  },

  endOfHistory: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    paddingBottom: Spacing[2],
  },

  // Loading
  skeletonBody: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    gap: Spacing[3],
  },

  // Error
  errorCard: {
    margin: Spacing[5] - 2,
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[5],
  },
  errorText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.primaryDim,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[5],
  },
  retryBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Empty
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    paddingBottom: Spacing[12],
  },
  emptyIconTile: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 12px 34px rgba(0, 0, 0, 0.6)',
  } as any,
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: Spacing[5] + 2,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing[3] - 1,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2] + 1,
    height: 50,
    paddingHorizontal: Spacing[6] + 2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    marginTop: Spacing[6] + 2,
  },
  emptyCtaText: {
    fontSize: 14.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
});
