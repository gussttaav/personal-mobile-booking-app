import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  initPaymentSheet,
  PaymentSheet,
  PaymentSheetError,
  presentPaymentSheet,
} from '@stripe/stripe-react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api-client';
import { pollPackConfirmation, PollAbortedError } from '@/lib/payment-confirmation';
import { useLocale } from '@/lib/i18n/locale-context';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { PricingPack } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEur(cents: number): string {
  const value = (cents / 100).toLocaleString('es-ES', {
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `€${value}`;
}

const PACK_NAME: Record<number, string> = { 5: 'Pack Esencial', 10: 'Pack Intensivo' };

function pricingKeyFor(size: 5 | 10): 'pack5' | 'pack10' {
  return size === 10 ? 'pack10' : 'pack5';
}

// ── Types ─────────────────────────────────────────────────────────────────────

// 'confirmando' holds while the pack poller resolves the backend outcome.
// 'success' shows the NEW balance (credits only ever appear here). 'limbo' is the
// 30s-timeout / loud-mismatch fallback — never fakes success.
type ScreenState =
  | 'loading'
  | 'load_error'
  | 'summary'
  | 'initiating'
  | 'confirmando'
  | 'success'
  | 'rejected'
  | 'limbo';

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ backDisabled }: { backDisabled?: boolean }) {
  const { t } = useLocale();
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={[styles.backBtn, backDisabled && styles.backBtnDisabled]}
        onPress={backDisabled ? undefined : () => router.back()}
        activeOpacity={0.7}
        disabled={backDisabled}
      >
        <MaterialCommunityIcons name="chevron-left" size={22} color={Colors.text} />
      </TouchableOpacity>
      <View style={styles.headerTitle}>
        <Text style={styles.headerOverline}>{t('packs.header.overline')}</Text>
        <Text style={styles.headerTitleText}>{t('packPay.header.title')}</Text>
      </View>
      <View style={styles.secureChip}>
        <MaterialCommunityIcons name="lock-outline" size={12} color={Colors.textDim} />
        <Text style={styles.secureChipText}>{t('packPay.header.secure')}</Text>
      </View>
    </View>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({ pack, size }: { pack: PricingPack; size: number }) {
  const { t } = useLocale();
  const savings = pack.savingsCents != null && pack.savingsCents > 0 ? pack.savingsCents : null;
  const original = pack.originalAmountCents;
  const listPerClass = original != null ? Math.round(original / size) : null;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryOverline}>{t('packPay.summary.overline')}</Text>

      <View style={styles.summaryPackRow}>
        <View style={styles.summaryPackIcon}>
          <MaterialCommunityIcons name="gift-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.summaryPackInfo}>
          <Text style={styles.summaryPackName}>{PACK_NAME[size] ?? `Pack ×${size}`}</Text>
          <Text style={styles.summaryPackSub}>
            {t('packPay.summary.classes').replace('{size}', String(size)).replace('{eur}', formatEur(pack.perClassCents))}
          </Text>
        </View>
        {savings != null && (
          <View style={styles.savingsPill}>
            <Text style={styles.savingsPillText}>{t('packs.card.save').replace('{eur}', formatEur(savings))}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {original != null && listPerClass != null && (
        <View style={styles.lineRow}>
          <Text style={styles.lineLabel}>{t('packPay.summary.lineClasses').replace('{size}', String(size)).replace('{eur}', formatEur(listPerClass))}</Text>
          <Text style={styles.lineStrike}>{formatEur(original)}</Text>
        </View>
      )}
      {savings != null && (
        <View style={styles.lineRow}>
          <Text style={styles.lineLabelAccent}>{t('packPay.summary.discount')}</Text>
          <Text style={styles.lineDiscount}>−{formatEur(savings)}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t('packPay.summary.total')}</Text>
        <Text style={styles.totalValue}>{formatEur(pack.amountCents)}</Text>
      </View>
    </View>
  );
}

// ── CreditsNote ───────────────────────────────────────────────────────────────

function CreditsNote({ size }: { size: number }) {
  const { t } = useLocale();
  return (
    <View style={styles.creditsNote}>
      <MaterialCommunityIcons name="information-outline" size={17} color={Colors.textDim} style={styles.creditsNoteIcon} />
      <Text style={styles.creditsNoteText}>
        {t('packPay.creditsNote').replace('{size}', String(size))}
      </Text>
    </View>
  );
}

// ── ConfirmingView (créditos aún no) ──────────────────────────────────────────

function StepRow({
  icon,
  label,
  status,
  statusColor,
  spinning,
  dashed,
  textMuted,
}: {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  status: string;
  statusColor: string;
  spinning?: boolean;
  dashed?: boolean;
  textMuted?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      {spinning ? (
        <View style={styles.stepSpinner}>
          <ActivityIndicator size="small" color={Colors.warning} />
        </View>
      ) : (
        <View style={[styles.stepDot, dashed ? styles.stepDotDashed : styles.stepDotDone]}>
          {icon && <MaterialCommunityIcons name={icon} size={15} color={Colors.primary} />}
        </View>
      )}
      <Text style={[styles.stepLabel, textMuted && styles.stepLabelMuted]}>{label}</Text>
      <Text style={[styles.stepStatus, { color: statusColor }]}>{status}</Text>
    </View>
  );
}

function ConfirmingView({ priceCents, size }: { priceCents: number; size: number }) {
  const { t } = useLocale();
  return (
    <View style={styles.confirmingBody}>
      <View style={styles.confirmingHero}>
        <View style={styles.confirmingBadge}>
          <MaterialCommunityIcons name="check" size={26} color={Colors.warning} />
        </View>
        <Text style={styles.confirmingTitle}>{t('packPay.confirming.title')}</Text>
        <Text style={styles.confirmingSub}>
          {t('packPay.confirming.sub').replace('{eur}', formatEur(priceCents))}
        </Text>
      </View>

      <View style={styles.stepperCard}>
        <StepRow
          icon="check"
          label={t('packPay.confirming.step1')}
          status={t('packPay.confirming.done')}
          statusColor={Colors.primary}
        />
        <View style={styles.divider} />
        <StepRow
          spinning
          label={t('packPay.confirming.step2').replace('{size}', String(size))}
          status={t('packPay.confirming.inProgress')}
          statusColor={Colors.warning}
        />
        <View style={styles.divider} />
        <StepRow
          dashed
          textMuted
          label={t('packPay.confirming.step3')}
          status={t('packPay.confirming.pending')}
          statusColor={Colors.textDim}
        />
      </View>

      <View style={styles.creditsNote}>
        <MaterialCommunityIcons name="information-outline" size={17} color={Colors.textDim} style={styles.creditsNoteIcon} />
        <Text style={styles.creditsNoteText}>
          {t('packPay.confirming.note')}
        </Text>
      </View>
    </View>
  );
}

// ── SuccessView (créditos activos) ────────────────────────────────────────────

function SuccessView({
  credits,
  packSize,
  insetBottom,
  onReserve,
  onBack,
}: {
  credits: number;
  packSize: number;
  insetBottom: number;
  onReserve: () => void;
  onBack: () => void;
}) {
  const { t } = useLocale();
  const previous = Math.max(0, credits - packSize);
  const metaText =
    previous > 0
      ? t('packPay.success.metaBoth').replace('{previous}', String(previous)).replace('{new}', String(packSize))
      : t('packPay.success.metaNew').replace('{new}', String(packSize));

  return (
    <View style={styles.successRoot}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.successContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successHero}>
          <View style={styles.successBadge}>
            <MaterialCommunityIcons name="check" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.successTitle}>{t('packPay.success.title').replace('{pack}', PACK_NAME[packSize] ?? `Pack ×${packSize}`)}</Text>
          <Text style={styles.successSub}>
            {t('packPay.success.sub')}
          </Text>
        </View>

        <View style={styles.successBalanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceOverline}>{t('packPay.success.balanceOverline')}</Text>
            <View style={styles.plusBadge}>
              <MaterialCommunityIcons name="plus" size={11} color={Colors.onPrimary} />
              <Text style={styles.plusBadgeText}>{packSize}</Text>
            </View>
          </View>
          <View style={styles.balanceStatRow}>
            <Text style={styles.balanceStat}>{credits}</Text>
            <Text style={styles.balanceStatLabel}>{t('packPay.success.available')}</Text>
          </View>
          <Text style={styles.balanceMeta}>
            {metaText}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: Math.max(insetBottom, Spacing[4]) }]}>
        <TouchableOpacity style={styles.payBtn} onPress={onReserve} activeOpacity={0.85}>
          <MaterialCommunityIcons name="calendar" size={18} color={Colors.onPrimary} />
          <Text style={styles.payBtnText}>{t('packPay.success.reserveNow')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.secondaryBtnText}>{t('packPay.backToPacks')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PackPayScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { packSize: packSizeParam } = useLocalSearchParams<{ packSize?: string }>();
  const size: 5 | 10 = packSizeParam === '10' ? 10 : 5;

  const [state, setState] = useState<ScreenState>('loading');
  const [pack, setPack] = useState<PricingPack | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Captured on Stripe authorization; the confirmation poller keys off it.
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  // The confirmed balance — set ONLY when the backend confirms (product rule:
  // never show credits before they exist).
  const [confirmed, setConfirmed] = useState<{ credits: number; packSize: number } | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  // Hard guard against a double tap landing two checkouts (real money).
  const submittingRef = useRef(false);

  const loadPricing = useCallback(async () => {
    setState('loading');
    setCheckoutError(null);
    try {
      const pricing = await api.getPricing();
      const found = pricing.packs.find((p) => p.productKey === pricingKeyFor(size));
      if (!found) { setState('load_error'); return; }
      if (!mountedRef.current) return;
      setPack(found);
      setState('summary');
    } catch {
      if (!mountedRef.current) return;
      setState('load_error');
    }
  }, [size]);

  useEffect(() => { loadPricing(); }, [loadPricing]);

  // ── Confirmation poller ─────────────────────────────────────────────────────
  // While 'confirmando', poll until credits activate or the 30s ceiling. Re-runs
  // if 'limbo' → 'confirmando' (manual retry). Aborts on unmount.
  useEffect(() => {
    if (state !== 'confirmando' || !paymentIntentId) return;
    const controller = new AbortController();

    pollPackConfirmation({ paymentIntentId, signal: controller.signal })
      .then((outcome) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        switch (outcome.kind) {
          case 'confirmed':
            setConfirmed({ credits: outcome.credits, packSize: outcome.packSize });
            setState('success');
            break;
          case 'timeout':
          case 'error':
            // Timeout or loud shape-mismatch — never fake success.
            setState('limbo');
            break;
        }
      })
      .catch((err: unknown) => {
        if (err instanceof PollAbortedError || !mountedRef.current) return;
        setState('limbo');
      });

    return () => controller.abort();
  }, [state, paymentIntentId]);

  const handlePay = useCallback(async () => {
    if (!pack || submittingRef.current) return;
    submittingRef.current = true;
    setState('initiating');
    setCheckoutError(null);

    try {
      const checkout = await api.postStripeCheckout({ type: 'pack', packSize: size });

      if (!checkout.clientSecret) {
        if (!mountedRef.current) return;
        setCheckoutError(t('errors.checkoutInitFailed'));
        setState('summary');
        return;
      }

      setPaymentIntentId(checkout.paymentIntentId);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: checkout.clientSecret,
        merchantDisplayName: 'Gustavo AI',
        style: 'alwaysDark',
        // Card-only checkout. This hides the Link wallet button AND its
        // "save your details" opt-in inside the card form. The remaining
        // wallets (Klarna, Amazon Pay, Bancontact, EPS) are attached to the
        // PaymentIntent by /api/stripe/checkout, so they can ONLY be removed
        // server-side — not from here.
        link: { display: PaymentSheet.LinkDisplay.NEVER },
      });

      if (initError) {
        if (!mountedRef.current) return;
        setCheckoutError(initError.message ?? t('errors.checkoutPrepFailed'));
        setState('summary');
        return;
      }

      const { error: presentError } = await presentPaymentSheet();

      if (!mountedRef.current) return;

      if (!presentError) {
        // Authorized — hold at "confirmando" until the backend activates credits.
        setState('confirmando');
        return;
      }

      if (presentError.code === PaymentSheetError.Canceled) {
        setState('summary');
        return;
      }

      setState('rejected');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('errors.unknown');
      setCheckoutError(msg);
      setState('summary');
    } finally {
      submittingRef.current = false;
    }
  }, [pack, size, t]);

  const recheck = useCallback(() => {
    setState('confirmando');
  }, []);

  const goReserve = useCallback(() => {
    router.replace('/(tabs)/(home)');
  }, []);

  const goPacks = useCallback(() => {
    router.replace('/(tabs)/(packs)/packs');
  }, []);

  const isInitiating = state === 'initiating';
  const isConfirmando = state === 'confirmando';
  const showSummary = state === 'summary' || state === 'initiating' || state === 'rejected';
  const showStickyPay = showSummary;

  // ── Success has its own full-screen layout ──────────────────────────────────
  if (state === 'success' && confirmed) {
    return (
      <View style={styles.screen}>
        <LinearGradient
          colors={['rgba(78, 222, 163, 0.20)', 'rgba(19, 19, 21, 0)']}
          style={styles.topGlowTall}
          pointerEvents="none"
        />
        <View style={{ paddingTop: insets.top }} />
        <SuccessView
          credits={confirmed.credits}
          packSize={confirmed.packSize}
          insetBottom={insets.bottom}
          onReserve={goReserve}
          onBack={goPacks}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[
          state === 'rejected' ? 'rgba(255, 180, 171, 0.10)'
            : isConfirmando ? 'rgba(251, 191, 36, 0.10)'
            : 'rgba(78, 222, 163, 0.12)',
          'rgba(19, 19, 21, 0)',
        ]}
        style={styles.topGlow}
        pointerEvents="none"
      />

      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header backDisabled={isInitiating || isConfirmando} />
      </View>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <View style={styles.skeletonBody}>
          <SkeletonBlock width="100%" height={190} borderRadius={Radius['3xl']} />
          <SkeletonBlock width="100%" height={64} borderRadius={Radius.xl} />
        </View>
      )}

      {/* ── Load error ──────────────────────────────────────────────────────── */}
      {state === 'load_error' && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
          <Text style={styles.errorText}>
            {t('packPay.loadError')}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPricing} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary / Initiating / Rejected ─────────────────────────────────── */}
      {showSummary && pack != null && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 }]}
        >
          {checkoutError && (
            <View style={styles.banner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} style={styles.bannerIcon} />
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>{t('errors.checkoutInitTitle')}</Text>
                <Text style={styles.bannerBody}>{checkoutError}</Text>
              </View>
            </View>
          )}
          {state === 'rejected' && (
            <View style={styles.banner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} style={styles.bannerIcon} />
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>{t('errors.paymentRejectedTitle')}</Text>
                <Text style={styles.bannerBody}>
                  {t('packPay.rejectedBody')}
                </Text>
              </View>
            </View>
          )}

          <SummaryCard pack={pack} size={size} />
          <CreditsNote size={size} />
        </ScrollView>
      )}

      {/* ── Confirmando ─────────────────────────────────────────────────────── */}
      {isConfirmando && pack != null && (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.confirmingScroll}
            showsVerticalScrollIndicator={false}
          >
            <ConfirmingView priceCents={pack.amountCents} size={size} />
          </ScrollView>
          <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
            <TouchableOpacity style={styles.outlineBtn} onPress={goPacks} activeOpacity={0.7}>
              <Text style={styles.outlineBtnText}>{t('packPay.backToPacks')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Limbo (timeout / mismatch) ──────────────────────────────────────── */}
      {state === 'limbo' && (
        <View style={[styles.terminalRoot, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <View style={styles.terminalCenter}>
            <View style={styles.terminalIcon}>
              <MaterialCommunityIcons name="timer-sand" size={32} color={Colors.textMuted} />
            </View>
            <Text style={styles.terminalTitle}>{t('packPay.limbo.title')}</Text>
            <Text style={styles.terminalBody}>
              {t('packPay.limbo.body')}
            </Text>
          </View>
          <View style={styles.terminalActions}>
            <TouchableOpacity style={styles.payBtn} onPress={recheck} activeOpacity={0.85}>
              <MaterialCommunityIcons name="refresh" size={17} color={Colors.onPrimary} />
              <Text style={styles.payBtnText}>{t('packPay.recheck')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goPacks} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>{t('packPay.backToPacks')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Sticky pay bar ──────────────────────────────────────────────────── */}
      {showStickyPay && pack != null && (
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <TouchableOpacity
            style={[styles.payBtn, isInitiating && styles.payBtnDisabled]}
            onPress={isInitiating ? undefined : handlePay}
            activeOpacity={0.85}
            disabled={isInitiating}
          >
            {isInitiating ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <MaterialCommunityIcons
                name={state === 'rejected' ? 'refresh' : 'lock-outline'}
                size={17}
                color={Colors.onPrimary}
              />
            )}
            <Text style={styles.payBtnText}>
              {state === 'rejected'
                ? t('common.retryPrice').replace('{eur}', formatEur(pack.amountCents))
                : t('common.payPrice').replace('{eur}', formatEur(pack.amountCents))}
            </Text>
          </TouchableOpacity>
          {state !== 'rejected' && (
            <View style={styles.payCaption}>
              <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textDim} />
              <Text style={styles.payCaptionText}>{t('packPay.caption')}</Text>
            </View>
          )}
        </View>
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
    height: 200,
  },
  topGlowTall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[4],
    gap: Spacing[3] + 2,
  },

  // Header
  headerWrap: {
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[2] + 2,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnDisabled: {
    opacity: 0.4,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headerOverline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitleText: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.16,
  },
  secureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] + 1,
    paddingVertical: 5,
  },
  secureChipText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    fontWeight: '600',
  },

  // Skeleton / error
  skeletonBody: {
    padding: Spacing[4],
    gap: Spacing[4],
  },
  errorCard: {
    margin: Spacing[4],
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

  // Banners
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3] - 2,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[3] + 1,
  },
  bannerIcon: {
    marginTop: 1,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  bannerTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.error,
  },
  bannerBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Summary card
  summaryCard: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[1],
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
  summaryPackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[4] - 2,
  },
  summaryPackIcon: {
    width: 46,
    height: 46,
    borderRadius: Radius.xl,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryPackInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  summaryPackName: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  summaryPackSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  savingsPill: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] - 1,
    paddingVertical: 4,
  },
  savingsPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing[3],
  },
  lineLabel: {
    fontSize: 13.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  lineLabelAccent: {
    fontSize: 13.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  lineStrike: {
    fontSize: 13.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textDecorationLine: 'line-through',
  },
  lineDiscount: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing[3] + 1,
    marginTop: Spacing[3],
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.22,
    lineHeight: 22,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },

  // Credits note
  creditsNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[2] + 2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3] + 1,
  },
  creditsNoteIcon: {
    marginTop: 1,
  },
  creditsNoteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Confirming view
  confirmingScroll: {
    padding: Spacing[4],
    paddingBottom: 120,
  },
  confirmingBody: {
    gap: Spacing[4] - 2,
  },
  confirmingHero: {
    alignItems: 'center',
    paddingTop: Spacing[3],
    paddingHorizontal: Spacing[2],
  },
  confirmingBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
    boxShadow: '0px 0px 30px rgba(251, 191, 36, 0.25)',
  } as any,
  confirmingTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.42,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  confirmingSub: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
    marginTop: Spacing[2] + 1,
  },

  // Stepper
  stepperCard: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3] + 1,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: 'rgba(78, 222, 163, 0.14)',
  },
  stepDotDashed: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    borderStyle: 'dashed',
  },
  stepSpinner: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  stepLabelMuted: {
    fontWeight: '500',
    color: Colors.textDim,
  },
  stepStatus: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.body,
  },

  // Success
  successRoot: {
    flex: 1,
  },
  successContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[3],
  },
  successHero: {
    alignItems: 'center',
    paddingTop: Spacing[5],
    paddingHorizontal: Spacing[2],
  },
  successBadge: {
    width: 74,
    height: 74,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[5],
    boxShadow: '0px 0px 36px rgba(78, 222, 163, 0.35)',
  } as any,
  successTitle: {
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.46,
    lineHeight: 27,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 282,
    marginTop: Spacing[2] + 1,
  },
  successBalanceCard: {
    borderRadius: Radius['4xl'],
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    padding: Spacing[5] - 2,
    marginTop: Spacing[5],
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
  plusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
  },
  plusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
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
  balanceMeta: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: Spacing[2] + 2,
  },

  // Terminal (limbo)
  terminalRoot: {
    flex: 1,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[8],
  },
  terminalCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
  },
  terminalIcon: {
    width: 66,
    height: 66,
    borderRadius: Radius.full,
    borderWidth: 1,
    backgroundColor: Colors.surfaceHigh,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
  },
  terminalTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.42,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  terminalBody: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 20,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  terminalActions: {
    gap: Spacing[2] + 2,
  },

  // Sticky bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 19, 21, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[2] + 2,
  },
  payBtn: {
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    boxShadow: '0px 0px 26px rgba(78, 222, 163, 0.35)',
  } as any,
  payBtnDisabled: {
    opacity: 0.7,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  payCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  payCaptionText: {
    fontSize: 11.5,
    fontWeight: '400',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  outlineBtn: {
    height: 52,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  secondaryBtn: {
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
