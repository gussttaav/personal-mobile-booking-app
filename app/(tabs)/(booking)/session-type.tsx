import { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api-client';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useT } from '@/lib/i18n/locale-context';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetPricingResponse } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Cents → "€16" / "€37,50" (es-ES grouping; drop decimals when round).
function formatEur(cents: number): string {
  const value = (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `€${value}`;
}

function findCents(pricing: GetPricingResponse, productKey: 'session1h' | 'session2h'): number | null {
  return pricing.sessions.find((s) => s.productKey === productKey)?.amountCents ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Duration = '1h' | '2h';
type ScreenState = 'loading' | 'ready' | 'error';

interface Prices {
  oneHourCents: number;
  twoHourCents: number;
}

// ── Top glow ──────────────────────────────────────────────────────────────────
// Ambient emerald halo at the top of the screen (matches Home).

function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.16)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  const t = useT();
  return (
    <View style={styles.header}>
      <Text style={styles.overline}>{t('common.book')}</Text>
      <Text style={styles.title}>{t('sessionType.headerTitle')}</Text>
      <Text style={styles.subtitle}>
        {t('sessionType.headerSubtitle')}
      </Text>
    </View>
  );
}

// ── Duration card ─────────────────────────────────────────────────────────────

interface DurationCardProps {
  title: string;
  subtitle: string;
  price: string;
  priceCaption: string;
  badge?: string;
  onPress: () => void;
}

function DurationCard({ title, subtitle, price, priceCaption, badge, onPress }: DurationCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardIcon}>
        <MaterialCommunityIcons name="clock-outline" size={23} color={Colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.cardPriceCol}>
        <Text style={styles.cardPrice}>{price}</Text>
        <Text style={styles.cardPriceCaption}>{priceCaption}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textDim} />
    </TouchableOpacity>
  );
}

// ── Footer note ───────────────────────────────────────────────────────────────

function FooterNote() {
  const t = useT();
  return (
    <View style={styles.footerNote}>
      <MaterialCommunityIcons name="information-outline" size={14} color={Colors.textDim} />
      <Text style={styles.footerNoteText}>{t('sessionType.footerNote')}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SessionTypeScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [state, setState] = useState<ScreenState>('loading');
  const [prices, setPrices] = useState<Prices | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const pricing = await api.getPricing();
      const oneHourCents = findCents(pricing, 'session1h');
      const twoHourCents = findCents(pricing, 'session2h');
      if (oneHourCents == null || twoHourCents == null) {
        setState('error');
        return;
      }
      setPrices({ oneHourCents, twoHourCents });
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectDuration = useCallback((duration: Duration) => {
    router.push({
      pathname: '/(tabs)/(booking)/schedule',
      params: { duration },
    });
  }, []);

  return (
    <View style={styles.screen}>
      <TopGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[2] }]}
        scrollEnabled={state !== 'loading'}
      >
        <Header />

        {state === 'loading' && (
          <View style={styles.cardList}>
            <SkeletonBlock width="100%" height={80} borderRadius={Radius['2xl']} />
            <SkeletonBlock width="100%" height={80} borderRadius={Radius['2xl']} />
          </View>
        )}

        {state === 'error' && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
            <Text style={styles.errorText}>
              {t('errors.loadFailed').replace('{what}', t('sessionType.pricesWord'))}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
              <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
              <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === 'ready' && prices != null && (
          <View style={styles.cardList}>
            <DurationCard
              title={t('common.duration1h')}
              subtitle={t('sessionType.card1hSubtitle')}
              price={formatEur(prices.oneHourCents)}
              priceCaption={t('sessionType.card1hPrice')}
              onPress={() => selectDuration('1h')}
            />
            <DurationCard
              title={t('common.duration2h')}
              subtitle={t('sessionType.card2hSubtitle')}
              price={formatEur(prices.twoHourCents)}
              priceCaption={t('sessionType.perHour').replace('{eur}', formatEur(prices.twoHourCents / 2))}
              badge={
                2 * prices.oneHourCents - prices.twoHourCents > 0
                  ? t('sessionType.savings').replace('{eur}', formatEur(2 * prices.oneHourCents - prices.twoHourCents))
                  : undefined
              }
              onPress={() => selectDuration('2h')}
            />
          </View>
        )}

        {state !== 'error' && <FooterNote />}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  content: {
    padding: Spacing[4],
    paddingBottom: Spacing[10],
    gap: Spacing[5],
  },

  // Header
  header: {
    gap: Spacing[2],
  },
  overline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.46,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  subtitle: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Card list
  cardList: {
    gap: Spacing[3],
  },

  // Duration card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3] + 2,
    backgroundColor: Colors.surfaceLow,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[4],
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  cardTitle: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  cardSubtitle: {
    ...TypeScale.caption,
    fontSize: 12.5,
    fontFamily: FontFamily.body,
    fontWeight: '500',
    color: Colors.textDim,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    ...TypeScale.badge,
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardPriceCol: {
    alignItems: 'flex-end',
    gap: 5,
  },
  cardPrice: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.19,
    lineHeight: 19,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },
  cardPriceCaption: {
    fontSize: 10.5,
    lineHeight: 11,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[2],
  },
  footerNoteText: {
    ...TypeScale.caption,
    fontSize: 11.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Error
  errorCard: {
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
    color: Colors.primary,
    fontWeight: '600',
  },
});
