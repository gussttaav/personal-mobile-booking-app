import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { useConfig } from '@/lib/config-context';
import { pollPaymentConfirmation, PollAbortedError } from '@/lib/payment-confirmation';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetPricingResponse, Locale } from '@/types/api';

type TFn = (key: TranslationKey) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

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

// "Miércoles 24 jun" / "Wednesday 24 Jun"
function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

// "18:00 – 20:00 · 2 horas"
function formatTimeRange(startIso: string, endIso: string, duration: '1h' | '2h', locale: Locale, t: TFn): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(bcp47(locale), { hour: '2-digit', minute: '2-digit', hour12: false });
  const label = duration === '1h' ? t('common.duration1h') : t('common.duration2h');
  return `${fmt(startIso)} – ${fmt(endIso)} · ${label}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

// 'confirmando' holds while the poller resolves the backend outcome (Pass B).
// Terminal-but-on-screen states: 'slot_taken' (hueco tomado durante el pago),
// 'failed' (DLQ — manual contact), 'limbo' (30s timeout — couldn't tell).
// 'confirmed' has no resting state: it navigates straight to S08.
type ScreenState =
  | 'loading'
  | 'load_error'
  | 'summary'
  | 'initiating'
  | 'confirmando'
  | 'rejected'
  | 'slot_taken'
  | 'failed'
  | 'limbo';

// ── TopGlow ───────────────────────────────────────────────────────────────────

function TopGlow({ error }: { error?: boolean }) {
  const color = error ? 'rgba(255, 180, 171, 0.10)' : 'rgba(78, 222, 163, 0.12)';
  return (
    <LinearGradient
      colors={[color, 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

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
        <Text style={styles.headerOverline}>{t('confirm.header.overline')}</Text>
        <Text style={styles.headerTitleText}>{t('confirm.header.title')}</Text>
      </View>
      <View style={styles.stepChip}>
        <Text style={styles.stepChipText}>{t('confirm.header.step')}</Text>
      </View>
    </View>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

interface SummaryCardProps {
  start: string;
  end: string;
  duration: '1h' | '2h';
  priceCents: number;
}

function SummaryCard({ start, end, duration, priceCents }: SummaryCardProps) {
  const { t, locale } = useLocale();
  const durationLabel = duration === '1h' ? t('common.duration1h') : t('common.duration2h');
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryOverline}>{t('common.yourBooking')}</Text>

      <View style={styles.summaryDateRow}>
        <View style={styles.summaryCalIcon}>
          <MaterialCommunityIcons name="calendar-outline" size={22} color={Colors.primary} />
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

      <View style={styles.divider} />

      <View style={styles.summaryPriceRow}>
        <Text style={styles.summaryPriceLabel}>{t('confirm.summary.priceLabel').replace('{duration}', durationLabel)}</Text>
        <Text style={styles.summaryPrice}>{formatEur(priceCents)}</Text>
      </View>
    </View>
  );
}

// ── CheckoutErrorBanner ───────────────────────────────────────────────────────

function CheckoutErrorBanner({ message }: { message: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.checkoutErrorBanner}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} style={styles.checkoutErrorIcon} />
      <View style={styles.checkoutErrorText}>
        <Text style={styles.checkoutErrorTitle}>{t('errors.checkoutInitTitle')}</Text>
        <Text style={styles.checkoutErrorBody}>{message}</Text>
      </View>
    </View>
  );
}

// ── RejectedBanner ────────────────────────────────────────────────────────────

function RejectedBanner() {
  const { t } = useLocale();
  return (
    <View style={styles.rejectedBanner}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} style={styles.checkoutErrorIcon} />
      <View style={styles.checkoutErrorText}>
        <Text style={styles.checkoutErrorTitle}>{t('errors.paymentRejectedTitle')}</Text>
        <Text style={styles.checkoutErrorBody}>
          {t('confirm.rejected.body')}
        </Text>
      </View>
    </View>
  );
}

// ── StickyBar ─────────────────────────────────────────────────────────────────

interface StickyBarProps {
  priceCents: number;
  state: ScreenState;
  onPay: () => void;
  onRetry: () => void;
  insetBottom: number;
}

function StickyBar({ priceCents, state, onPay, onRetry, insetBottom }: StickyBarProps) {
  const { t } = useLocale();
  const { cancelMinNoticeHours } = useConfig();
  const isInitiating = state === 'initiating';
  const isRejected = state === 'rejected';
  const label = isRejected
    ? t('common.retryPrice').replace('{eur}', formatEur(priceCents))
    : t('common.payPrice').replace('{eur}', formatEur(priceCents));

  return (
    <View style={[styles.stickyBar, { paddingBottom: Math.max(insetBottom, Spacing[4]) }]}>
      <TouchableOpacity
        style={[styles.payBtn, isInitiating && styles.payBtnDisabled]}
        onPress={isInitiating ? undefined : isRejected ? onRetry : onPay}
        activeOpacity={0.85}
        disabled={isInitiating}
      >
        {isInitiating ? (
          <ActivityIndicator size="small" color={Colors.onPrimary} />
        ) : isRejected ? (
          <MaterialCommunityIcons name="refresh" size={17} color={Colors.onPrimary} />
        ) : (
          <MaterialCommunityIcons name="lock-outline" size={17} color={Colors.onPrimary} />
        )}
        <Text style={styles.payBtnText}>{label}</Text>
      </TouchableOpacity>
      {!isRejected && (
        <View style={styles.payCaption}>
          <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textDim} />
          <Text style={styles.payCaptionText}>
            {t('confirm.pay.caption').replace('{hours}', String(cancelMinNoticeHours))}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── ConfirmandoOverlay ────────────────────────────────────────────────────────

function ConfirmandoOverlay({ priceCents, insetBottom }: { priceCents: number; insetBottom: number }) {
  const { t } = useLocale();
  return (
    <View style={[styles.confirmandoOverlay, { paddingBottom: Math.max(insetBottom + Spacing[4], Spacing[8]) }]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.confirmandoTitle}>{t('confirm.confirmando.title')}</Text>
      <Text style={styles.confirmandoBody}>
        {t('confirm.confirmando.body')}
      </Text>
      <View style={styles.confirmandoCaption}>
        <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textDim} />
        <Text style={styles.payCaptionText}>{t('confirm.confirmando.caption').replace('{eur}', formatEur(priceCents))}</Text>
      </View>
    </View>
  );
}

// ── TerminalView ──────────────────────────────────────────────────────────────
// Full-screen resolution view shared by slot_taken / failed / limbo.

interface TerminalAction {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface TerminalViewProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  tintBg: string;
  tintBorder: string;
  title: string;
  body: string;
  primary: TerminalAction;
  secondary?: TerminalAction;
  insetBottom: number;
}

function TerminalView({
  icon,
  tint,
  tintBg,
  tintBorder,
  title,
  body,
  primary,
  secondary,
  insetBottom,
}: TerminalViewProps) {
  return (
    <View style={[styles.terminalRoot, { paddingBottom: Math.max(insetBottom, Spacing[4]) }]}>
      <View style={styles.terminalCenter}>
        <View style={[styles.terminalIcon, { backgroundColor: tintBg, borderColor: tintBorder }]}>
          <MaterialCommunityIcons name={icon} size={32} color={tint} />
        </View>
        <Text style={styles.terminalTitle}>{title}</Text>
        <Text style={styles.terminalBody}>{body}</Text>
      </View>

      <View style={styles.terminalActions}>
        <TouchableOpacity style={styles.payBtn} onPress={primary.onPress} activeOpacity={0.85}>
          {primary.icon && (
            <MaterialCommunityIcons name={primary.icon} size={17} color={Colors.onPrimary} />
          )}
          <Text style={styles.payBtnText}>{primary.label}</Text>
        </TouchableOpacity>
        {secondary && (
          <TouchableOpacity
            style={styles.terminalSecondaryBtn}
            onPress={secondary.onPress}
            activeOpacity={0.7}
          >
            <Text style={styles.terminalSecondaryText}>{secondary.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { duration: durationParam, start: startParam, end: endParam } = useLocalSearchParams<{
    duration?: string;
    start?: string;
    end?: string;
  }>();

  const duration = (durationParam === '2h' ? '2h' : '1h') as '1h' | '2h';
  const start = startParam ?? '';
  const end = endParam ?? '';

  const [state, setState] = useState<ScreenState>('loading');
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Captured on Stripe authorization; the confirmation poller (below) keys off it.
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Prevent stale state updates after unmount.
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // ── Confirmation poller (Pass B) ──────────────────────────────────────────
  // While 'confirmando', poll the authoritative channel endpoint until a terminal
  // status or the 30s ceiling. Re-runs if 'limbo' → 'confirmando' (manual retry).
  // A transient drop is swallowed inside the poller — the screen never errors out.
  useEffect(() => {
    if (state !== 'confirmando' || !paymentIntentId) return;
    const controller = new AbortController();

    pollPaymentConfirmation({ paymentIntentId, signal: controller.signal })
      .then((outcome) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        switch (outcome.kind) {
          case 'confirmed': {
            const b = outcome.booking;
            // Option (b): hand S08 the full booking so it renders without a round trip.
            router.replace({
              pathname: '/(tabs)/(booking)/success',
              params: {
                eventId: b.eventId,
                startIso: b.startIso,
                endIso: b.endIso,
                sessionType: b.sessionType,
                joinToken: b.joinToken,
              },
            });
            break;
          }
          case 'slot_taken':
            setState('slot_taken');
            break;
          case 'failed':
            setState('failed');
            break;
          case 'timeout':
            setState('limbo');
            break;
        }
      })
      .catch((err: unknown) => {
        if (err instanceof PollAbortedError || !mountedRef.current) return;
        // Unexpected error — fall to limbo rather than spin or fake success.
        setState('limbo');
      });

    return () => controller.abort();
  }, [state, paymentIntentId]);

  const loadPricing = useCallback(async () => {
    setState('loading');
    setCheckoutError(null);
    try {
      const pricing = await api.getPricing();
      const productKey = duration === '1h' ? 'session1h' : 'session2h';
      const cents = findCents(pricing, productKey);
      if (cents == null) { setState('load_error'); return; }
      if (!mountedRef.current) return;
      setPriceCents(cents);
      setState('summary');
    } catch {
      if (!mountedRef.current) return;
      setState('load_error');
    }
  }, [duration]);

  useEffect(() => { loadPricing(); }, [loadPricing]);

  const handlePay = useCallback(async () => {
    if (priceCents == null || !start || !end) return;
    setState('initiating');
    setCheckoutError(null);

    try {
      const checkout = await api.postStripeCheckout({
        type: 'single',
        duration,
        startIso: start,
        endIso: end,
      });

      if (!checkout.clientSecret) {
        if (!mountedRef.current) return;
        setCheckoutError(t('errors.checkoutInitFailed'));
        setState('summary');
        return;
      }

      // Hold paymentIntentId for Pass B confirmation.
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
        // Payment authorized — enter holding state. Pass B completes confirmation.
        setState('confirmando');
        return;
      }

      if (presentError.code === PaymentSheetError.Canceled) {
        // User dismissed the sheet — silent return to summary.
        setState('summary');
        return;
      }

      // Any other error (declined, network, etc.) → rejected state.
      setState('rejected');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : t('errors.unknown');
      setCheckoutError(msg);
      setState('summary');
    }
  }, [duration, end, priceCents, start, t]);

  const handleRetry = useCallback(() => {
    setState('summary');
  }, []);

  const goHome = useCallback(() => {
    router.replace('/(tabs)/(home)');
  }, []);

  const chooseAnotherSlot = useCallback(() => {
    // Back to S05 with a fresh mount so availability re-fetches.
    router.replace({ pathname: '/(tabs)/(booking)/schedule', params: { duration } });
  }, [duration]);

  const recheck = useCallback(() => {
    setState('confirmando');
  }, []);

  const isConfirmando = state === 'confirmando';
  const isTerminal = state === 'slot_taken' || state === 'failed' || state === 'limbo';
  const showStickyBar = state === 'summary' || state === 'initiating' || state === 'rejected';

  return (
    <View style={styles.screen}>
      <TopGlow error={state === 'rejected'} />

      {/* Header — always rendered. Back is disabled once payment is authorized
          (confirmando) and through every terminal state; those resolve via their
          own actions, never the back stack. */}
      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header backDisabled={isConfirmando || isTerminal} />
      </View>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <View style={styles.skeletonBody}>
          <SkeletonBlock width="100%" height={180} borderRadius={14} />
          <SkeletonBlock width="100%" height={80} borderRadius={Radius['2xl']} />
        </View>
      )}

      {/* ── Load error ──────────────────────────────────────────────────────── */}
      {state === 'load_error' && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
          <Text style={styles.errorText}>
            {t('confirm.loadError')}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPricing} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary / Initiating / Rejected ─────────────────────────────────── */}
      {(state === 'summary' || state === 'initiating' || state === 'rejected') && priceCents != null && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
          keyboardShouldPersistTaps="handled"
        >
          {checkoutError && <CheckoutErrorBanner message={checkoutError} />}
          {state === 'rejected' && <RejectedBanner />}

          <SummaryCard start={start} end={end} duration={duration} priceCents={priceCents} />

          {/* Note field */}
          <View style={styles.noteSection}>
            <View style={styles.noteLabelRow}>
              <Text style={styles.noteLabel}>{t('common.noteLabel')}</Text>
              <View style={styles.optionalChip}>
                <Text style={styles.optionalChipText}>{t('common.optional')}</Text>
              </View>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder={t('common.notePlaceholder')}
              placeholderTextColor={Colors.textDim}
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      )}

      {/* ── Confirmando ─────────────────────────────────────────────────────── */}
      {state === 'confirmando' && priceCents != null && (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 16, opacity: 0.45 }]}
            scrollEnabled={false}
            pointerEvents="none"
          >
            <SummaryCard start={start} end={end} duration={duration} priceCents={priceCents} />
          </ScrollView>
          <ConfirmandoOverlay priceCents={priceCents} insetBottom={insets.bottom} />
        </>
      )}

      {/* ── Slot taken during payment ───────────────────────────────────────── */}
      {state === 'slot_taken' && (
        <TerminalView
          icon="clock-alert-outline"
          tint={Colors.warning}
          tintBg={Colors.warningBg}
          tintBorder={Colors.warningBorder}
          title={t('confirm.slotTaken.title')}
          body={t('confirm.slotTaken.body')}
          primary={{ label: t('confirm.slotTaken.cta'), icon: 'calendar-clock', onPress: chooseAnotherSlot }}
          secondary={{ label: t('confirm.slotTaken.cancel'), onPress: goHome }}
          insetBottom={insets.bottom}
        />
      )}

      {/* ── Failed → dead-letter, MANUAL contact (no automated email promise) ── */}
      {state === 'failed' && (
        <TerminalView
          icon="progress-clock"
          tint={Colors.textMuted}
          tintBg={Colors.surfaceHigh}
          tintBorder={Colors.border}
          title={t('confirm.failed.title')}
          body={t('confirm.failed.body')}
          primary={{ label: t('common.backHome'), onPress: goHome }}
          insetBottom={insets.bottom}
        />
      )}

      {/* ── Limbo → 30s timeout, couldn't tell (manual re-check) ─────────────── */}
      {state === 'limbo' && (
        <TerminalView
          icon="timer-sand"
          tint={Colors.textMuted}
          tintBg={Colors.surfaceHigh}
          tintBorder={Colors.border}
          title={t('confirm.limbo.title')}
          body={t('confirm.limbo.body')}
          primary={{ label: t('confirm.limbo.recheck'), icon: 'refresh', onPress: recheck }}
          secondary={{ label: t('common.backHome'), onPress: goHome }}
          insetBottom={insets.bottom}
        />
      )}

      {/* ── Sticky pay bar ──────────────────────────────────────────────────── */}
      {showStickyBar && priceCents != null && (
        <StickyBar
          priceCents={priceCents}
          state={state}
          onPay={handlePay}
          onRetry={handleRetry}
          insetBottom={insets.bottom}
        />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[4],
    gap: Spacing[4],
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
  stepChip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[2] + 1,
    paddingVertical: 5,
  },
  stepChipText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    fontWeight: '600',
  },

  // Skeleton / load_error
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

  // Summary card
  summaryCard: {
    borderRadius: 14,
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
  summaryPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
  },
  summaryPriceLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  summaryPrice: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },

  // Note
  noteSection: {
    gap: Spacing[2],
  },
  noteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  noteLabel: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  optionalChip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  optionalChipText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  noteInput: {
    minHeight: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: Spacing[3],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  // Error / rejected banners
  checkoutErrorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3] - 2,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[3] + 1,
  },
  checkoutErrorIcon: {
    marginTop: 1,
  },
  checkoutErrorText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  checkoutErrorTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.error,
  },
  checkoutErrorBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  rejectedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3] - 2,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[3] + 1,
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
    // Emerald glow (boxShadow works on Android via New Arch, not shadowColor):
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

  // Confirmando overlay
  confirmandoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(19, 19, 21, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(78, 222, 163, 0.20)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: Spacing[6],
    paddingHorizontal: Spacing[6],
    alignItems: 'center',
    // Elevated shadow
    boxShadow: '0px -20px 50px rgba(0, 0, 0, 0.5)',
  } as any,
  confirmandoTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.text,
    marginTop: Spacing[4] + 2,
  },
  confirmandoBody: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    marginTop: Spacing[2],
  },
  confirmandoCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing[4],
  },

  // Terminal views (slot_taken / failed / limbo)
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
  terminalSecondaryBtn: {
    height: 48,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  terminalSecondaryText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
