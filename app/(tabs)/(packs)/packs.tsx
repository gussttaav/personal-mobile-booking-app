import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api-client';
import { useLocale } from '@/lib/i18n/locale-context';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetCreditsResponse, GetPricingResponse, PricingPack } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(cents: number): string {
  const value = (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `€${value}`;
}

// pack10 → 10, pack5 → 5. The numeric size is what S10's checkout expects.
function packSizeOf(pack: PricingPack): 5 | 10 {
  return pack.productKey === 'pack10' ? 10 : 5;
}

const PACK_NAME: Record<number, string> = { 5: 'Pack Esencial', 10: 'Pack Intensivo' };

// Intensivo (10) is the featured, recommended offer — render it first.
function sortPacks(packs: PricingPack[]): PricingPack[] {
  return [...packs].sort((a, b) => packSizeOf(b) - packSizeOf(a));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'load_error' | 'ready';

// ── PackCard ──────────────────────────────────────────────────────────────────

function PackCard({ pack, onPress }: { pack: PricingPack; onPress: () => void }) {
  const { t } = useLocale();
  const size = packSizeOf(pack);
  const featured = size === 10;
  const savings = pack.savingsCents != null && pack.savingsCents > 0 ? pack.savingsCents : null;

  return (
    <TouchableOpacity
      style={[styles.packCard, featured && styles.packCardFeatured]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('packs.card.buyA11y').replace('{pack}', PACK_NAME[size])}
    >
      {featured && (
        <View style={styles.recommendBadge}>
          <Text style={styles.recommendBadgeText}>{t('packs.card.recommended')}</Text>
        </View>
      )}

      <View style={styles.packTopRow}>
        <View style={styles.packTopLeft}>
          <View style={[styles.packIcon, featured ? styles.packIconFeatured : styles.packIconPlain]}>
            <MaterialCommunityIcons
              name="gift-outline"
              size={23}
              color={featured ? Colors.primary : Colors.textMuted}
            />
          </View>
          <View style={styles.packTitleWrap}>
            <Text style={styles.packName}>{PACK_NAME[size]}</Text>
            <Text style={styles.packSub}>{t('packs.card.classesEach').replace('{size}', String(size))}</Text>
          </View>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={featured ? Colors.primary : Colors.textDim}
        />
      </View>

      <View style={[styles.packDivider, featured && styles.packDividerFeatured]} />

      <View style={styles.packPriceRow}>
        <View style={styles.packPriceLeft}>
          <Text style={[styles.packPrice, featured && styles.packPriceFeatured]}>
            {formatEur(pack.amountCents)}
          </Text>
          <Text style={styles.packPerClass}>{t('packs.card.perClass').replace('{eur}', formatEur(pack.perClassCents))}</Text>
        </View>
        {savings != null && (
          <View style={[styles.savingsPill, featured ? styles.savingsPillFeatured : styles.savingsPillPlain]}>
            <Text style={[styles.savingsPillText, featured ? styles.savingsPillTextFeatured : styles.savingsPillTextPlain]}>
              {t('packs.card.save').replace('{eur}', formatEur(savings))}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── BalanceCard (con pack activo) ─────────────────────────────────────────────

function BalanceCard({ credits, packSize }: { credits: number; packSize: number }) {
  const { t } = useLocale();
  const packName = PACK_NAME[packSize] ?? `Pack ×${packSize}`;
  const ratio = packSize > 0 ? Math.max(0, Math.min(1, credits / packSize)) : 0;

  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceOverline}>{t('packs.balance.overline')}</Text>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipText}>{packName}</Text>
        </View>
      </View>

      <View style={styles.balanceStatRow}>
        <Text style={styles.balanceStat}>{credits}</Text>
        <Text style={styles.balanceStatLabel}>{t('packs.balance.remaining')}</Text>
      </View>

      <View style={styles.trackOuter}>
        <View style={[styles.trackFill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
      <Text style={styles.balanceMeta}>
        {t('packs.balance.available').replace('{credits}', String(credits)).replace('{packSize}', String(packSize))}
      </Text>
      {/* TODO: show expiry (días restantes) once GET /api/credits exposes it. */}
    </View>
  );
}

// ── ValueProps (sin pack) ─────────────────────────────────────────────────────

function ValueProps() {
  const { t } = useLocale();
  const items = [
    { value: '−15%', label: t('packs.valueProps.saveLabel'), accent: true },
    { value: '12 m', label: t('packs.valueProps.monthsLabel'), accent: false },
    { value: '1 tap', label: t('packs.valueProps.tapLabel'), accent: false },
  ];
  return (
    <View style={styles.valueProps}>
      {items.map((it) => (
        <View key={it.label} style={styles.valuePropCard}>
          <Text style={[styles.valuePropValue, it.accent && styles.valuePropValueAccent]}>{it.value}</Text>
          <Text style={styles.valuePropLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── SectionDivider ────────────────────────────────────────────────────────────

function SectionDivider({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <View style={styles.sectionDivider}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
      {trailing && <Text style={styles.sectionTrailing}>{trailing}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PacksScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [state, setState] = useState<ScreenState>('loading');
  const [pricing, setPricing] = useState<GetPricingResponse | null>(null);
  const [credits, setCredits] = useState<GetCreditsResponse | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const load = useCallback(async () => {
    setState('loading');
    try {
      // Pricing is required (the catalog can't render without it). Credits is
      // best-effort — a failure there just means we show the "sin pack" state.
      const [pricingRes, creditsRes] = await Promise.all([
        api.getPricing(),
        api.getCredits().catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setPricing(pricingRes);
      setCredits(creditsRes);
      setState('ready');
    } catch {
      if (!mountedRef.current) return;
      setState('load_error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goToPay = useCallback((pack: PricingPack) => {
    router.push({
      pathname: '/(tabs)/(packs)/pay',
      params: { packSize: String(packSizeOf(pack)) },
    });
  }, []);

  const hasActivePack = credits != null && credits.packSize != null && credits.credits > 0;
  const packs = pricing ? sortPacks(pricing.packs) : [];

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={['rgba(78, 222, 163, 0.15)', 'rgba(19, 19, 21, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing[3] }]}>
        <Text style={styles.headerOverline}>{t('packs.header.overline')}</Text>
        <Text style={styles.headerTitle}>
          {hasActivePack ? t('packs.header.titleActive') : t('packs.header.titleInactive')}
        </Text>
        <Text style={styles.headerSubtitle}>
          {hasActivePack
            ? t('packs.header.subtitleActive')
            : t('packs.header.subtitleInactive')}
        </Text>
      </View>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <View style={styles.skeletonBody}>
          <SkeletonBlock width="100%" height={120} borderRadius={Radius['4xl']} />
          <SkeletonBlock width="100%" height={132} borderRadius={Radius['3xl']} />
          <SkeletonBlock width="100%" height={120} borderRadius={Radius['3xl']} />
        </View>
      )}

      {/* ── Load error ──────────────────────────────────────────────────────── */}
      {state === 'load_error' && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
          <Text style={styles.errorText}>
            {t('packs.loadError')}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Ready ───────────────────────────────────────────────────────────── */}
      {state === 'ready' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing[8] }]}
          showsVerticalScrollIndicator={false}
        >
          {hasActivePack && credits?.packSize != null ? (
            <>
              <BalanceCard credits={credits.credits} packSize={credits.packSize} />
              <SectionDivider title={t('packs.section.renewTitle')} trailing={t('packs.section.renewTrailing')} />
            </>
          ) : (
            <>
              <ValueProps />
              <SectionDivider title={t('packs.section.chooseTitle')} />
            </>
          )}

          {packs.map((pack) => (
            <PackCard key={pack.productKey} pack={pack} onPress={() => goToPay(pack)} />
          ))}

          <View style={styles.footerNote}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={Colors.textDim} />
            <Text style={styles.footerNoteText}>
              {t('packs.footer')}
            </Text>
          </View>
        </ScrollView>
      )}
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
    height: 240,
  },

  // Header
  header: {
    paddingHorizontal: Spacing[5] - 2,
    paddingBottom: Spacing[2],
    gap: 6,
  },
  headerOverline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  headerTitle: {
    ...TypeScale.h2,
    fontSize: 23,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    marginTop: 1,
  },
  headerSubtitle: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Skeleton / error
  skeletonBody: {
    paddingHorizontal: Spacing[5] - 2,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },
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
    color: Colors.primary,
    fontWeight: '600',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[5] - 2,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },

  // Balance card (con pack activo)
  balanceCard: {
    borderRadius: Radius['4xl'],
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    padding: Spacing[5] - 2,
    boxShadow: [
      { offsetX: 0, offsetY: 14, blurRadius: 40, spreadDistance: -18, color: 'rgba(78, 222, 163, 0.45)' },
    ],
  } as any,
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  balanceOverline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  balanceChip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] + 1,
    paddingVertical: 4,
  },
  balanceChipText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  balanceStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing[2] + 1,
  },
  balanceStat: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.76,
    lineHeight: 38,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },
  balanceStatLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  trackOuter: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    overflow: 'hidden',
    marginTop: Spacing[4] - 2,
  },
  trackFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  balanceMeta: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: Spacing[2],
  },

  // Value props (sin pack)
  valueProps: {
    flexDirection: 'row',
    gap: Spacing[2] + 2,
  },
  valuePropCard: {
    flex: 1,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: Spacing[3] + 1,
    paddingHorizontal: Spacing[3],
    alignItems: 'center',
  },
  valuePropValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  valuePropValueAccent: {
    color: Colors.primary,
  },
  valuePropLabel: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 6,
    textAlign: 'center',
  },

  // Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] + 1,
    marginTop: Spacing[3],
    marginBottom: Spacing[1],
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.16,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  sectionTrailing: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Pack card
  packCard: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing[4],
  },
  packCardFeatured: {
    backgroundColor: 'rgba(78, 222, 163, 0.06)',
    borderColor: 'rgba(78, 222, 163, 0.40)',
    marginTop: Spacing[2],
  },
  recommendBadge: {
    position: 'absolute',
    top: -9,
    left: Spacing[4],
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] + 1,
    paddingVertical: 4,
    boxShadow: '0px 0px 18px rgba(78, 222, 163, 0.45)',
  } as any,
  recommendBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  packTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packTopLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  packIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.xl + 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  packIconFeatured: {
    backgroundColor: Colors.primaryDim,
    borderColor: 'rgba(78, 222, 163, 0.28)',
  },
  packIconPlain: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  packTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  packName: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 19,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  packSub: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  packDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: Spacing[3] + 2,
  },
  packDividerFeatured: {
    backgroundColor: 'rgba(78, 222, 163, 0.16)',
  },
  packPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  packPriceLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing[2],
  },
  packPrice: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.52,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  packPriceFeatured: {
    color: Colors.primary,
  },
  packPerClass: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  savingsPill: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] + 1,
    paddingVertical: 5,
  },
  savingsPillFeatured: {
    backgroundColor: Colors.primary,
  },
  savingsPillPlain: {
    backgroundColor: Colors.primaryDim,
  },
  savingsPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
  },
  savingsPillTextFeatured: {
    color: Colors.onPrimary,
  },
  savingsPillTextPlain: {
    color: Colors.primary,
  },

  // Footer note
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[4],
    paddingHorizontal: Spacing[4],
  },
  footerNoteText: {
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 16,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
