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
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/lib/api-client';
import { getDeviceTimeZone } from '@/lib/grid-time';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetPricingResponse } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
// Screen-local, matching confirm.tsx / success.tsx conventions.

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

// Pack-size → display name (mirrors components/CreditBalanceCard.tsx).
const PACK_NAME: Record<number, string> = { 5: 'Pack Esencial', 10: 'Pack Intensivo' };
function packLabel(packSize: number | null): string | null {
  return packSize != null ? (PACK_NAME[packSize] ?? `Pack ×${packSize}`) : null;
}

// "Jueves 25 jun"
function formatDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

// "17:00 – 18:00 · 1 hora" — credit classes are always 1h.
function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(startIso)} – ${fmt(endIso)} · 1 hora`;
}

// One credit always books exactly one hour.
const ONE_HOUR_MS = 3_600_000;

// ── Types ─────────────────────────────────────────────────────────────────────
// 'no_credits' = the sin-créditos cross-sell (zero on load OR INSUFFICIENT_CREDITS race).
// 'slot_taken' = the picked hour was claimed between selection and booking.
type ScreenState = 'loading' | 'load_error' | 'summary' | 'no_credits' | 'slot_taken';

// ── TopGlow ───────────────────────────────────────────────────────────────────

function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.12)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({ title, backDisabled }: { title: string; backDisabled?: boolean }) {
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
        <Text style={styles.headerOverline}>Reservar · crédito</Text>
        <Text style={styles.headerTitleText}>{title}</Text>
      </View>
      <View style={styles.stepChip}>
        <Text style={styles.stepChipText}>Paso 2/2</Text>
      </View>
    </View>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({ start, end }: { start: string; end: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryOverline}>Tu reserva</Text>

      <View style={styles.summaryDateRow}>
        <View style={styles.summaryCalIcon}>
          <MaterialCommunityIcons name="calendar-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.summaryDateText}>
          <Text style={styles.summaryDate}>{formatDate(start)}</Text>
          <Text style={styles.summaryTime}>{formatTimeRange(start, end)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.summaryTutorRow}>
        <View style={styles.summaryAvatar}>
          <Text style={styles.summaryAvatarText}>GT</Text>
        </View>
        <View style={styles.summaryTutorInfo}>
          <Text style={styles.summaryTutorName}>con Gustavo</Text>
          <Text style={styles.summaryTutorSub}>Tutoría individual 1:1</Text>
        </View>
        <Text style={styles.summaryTz}>Europe/Madrid</Text>
      </View>
    </View>
  );
}

// ── CreditCard ────────────────────────────────────────────────────────────────
// "Gastas 1 crédito · te quedan N" — N is the balance AFTER this booking.

function CreditCard({ remainingAfter, packSize }: { remainingAfter: number; packSize: number | null }) {
  const name = packLabel(packSize);
  return (
    <View style={styles.creditCard}>
      <View style={styles.creditTopRow}>
        <View style={styles.creditIcon}>
          <MaterialCommunityIcons name="timer-outline" size={21} color={Colors.primary} />
        </View>
        <View style={styles.creditText}>
          <Text style={styles.creditTitle}>Gastas 1 crédito</Text>
          <Text style={styles.creditRemaining}>
            {remainingAfter === 0
              ? 'Será tu último crédito'
              : `Te quedan ${remainingAfter} ${remainingAfter === 1 ? 'crédito' : 'créditos'}`}
          </Text>
        </View>
      </View>
      {name != null && (
        <>
          <View style={styles.creditDivider} />
          <View style={styles.creditMetaRow}>
            <Text style={styles.creditPackName}>{name}</Text>
            <Text style={styles.creditMetaDim}>Crédito de pack</Text>
          </View>
        </>
      )}
    </View>
  );
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────

function ErrorBanner({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.errorBanner}>
      <MaterialCommunityIcons name="alert-circle-outline" size={20} color={Colors.error} style={styles.errorBannerIcon} />
      <View style={styles.errorBannerText}>
        <Text style={styles.errorBannerTitle}>{title}</Text>
        <Text style={styles.errorBannerBody}>{body}</Text>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ConfirmCreditScreen() {
  const insets = useSafeAreaInsets();
  const { start: startParam, end: endParam } = useLocalSearchParams<{
    start?: string;
    end?: string;
  }>();

  const start = startParam ?? '';
  // Credit is always a 1h class — recompute end from start rather than trust the param.
  const end = start ? new Date(Date.parse(start) + ONE_HOUR_MS).toISOString() : (endParam ?? '');

  const [state, setState] = useState<ScreenState>('loading');
  const [credits, setCredits] = useState<number>(0);
  const [packSize, setPackSize] = useState<number | null>(null);
  const [oneHourCents, setOneHourCents] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prevent stale updates after unmount, and double-submit before state lands.
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // ── Load credit balance (+ 1h price for the cross-sell label) ───────────────
  const load = useCallback(async () => {
    setState('loading');
    try {
      // Pricing is only needed for the "Pagar esta clase" label; never block on it.
      const [creditsRes, pricing] = await Promise.all([
        api.getCredits(),
        api.getPricing().catch(() => null),
      ]);
      if (!mountedRef.current) return;
      setCredits(creditsRes.credits);
      setPackSize(creditsRes.packSize);
      if (pricing) setOneHourCents(findCents(pricing, 'session1h'));
      // Zero balance on arrival → straight to the cross-sell (no dead-end).
      setState(creditsRes.credits > 0 ? 'summary' : 'no_credits');
    } catch {
      if (!mountedRef.current) return;
      setState('load_error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Confirm → synchronous POST /api/book ────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    // Hard guard against double-submission — a credit is real value.
    if (submittingRef.current || !start || !end) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.postBook({
        startIso: start,
        endIso: end,
        sessionType: 'pack',
        timezone: getDeviceTimeZone(),
        note: note.trim() || undefined,
      });

      // Success — hand S08 the completed booking. sessionType 'pack' renders as
      // "1 hora" via success.tsx's durationFromSessionType.
      router.replace({
        pathname: '/(tabs)/(booking)/success',
        params: {
          eventId: res.eventId,
          startIso: start,
          endIso: end,
          sessionType: 'pack',
          joinToken: res.joinToken,
          emailFailed: String(res.emailFailed),
        },
      });
      return; // navigated away — leave the submit guard engaged
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      if (err instanceof ApiError) {
        // Match on code (robust to the 400/402 status discrepancy for credits).
        if (err.code === 'INSUFFICIENT_CREDITS') {
          setState('no_credits');
        } else if (err.code === 'SLOT_UNAVAILABLE') {
          setState('slot_taken');
        } else if (err.status === 429) {
          setSubmitError('Demasiados intentos. Espera un momento e inténtalo de nuevo.');
        } else {
          // 401 is normally handled by api-client's silent refresh; if it (or any
          // 400/500) surfaces here, show a generic retryable error.
          setSubmitError('No pudimos completar la reserva. Inténtalo de nuevo.');
        }
      } else {
        setSubmitError('No hay conexión. Comprueba tu red e inténtalo de nuevo.');
      }
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [start, end, note]);

  const goPacks = useCallback(() => {
    router.replace('/(tabs)/(packs)/packs');
  }, []);

  const payThisClass = useCallback(() => {
    // Reuse the already-picked slot in the S06 pay flow (always 1h here).
    router.replace({
      pathname: '/(tabs)/(booking)/confirm',
      params: { duration: '1h', start, end },
    });
  }, [start, end]);

  const chooseAnotherSlot = useCallback(() => {
    router.back();
  }, []);

  const headerTitle = state === 'no_credits' ? 'Reservar con crédito' : 'Confirmar reserva';

  return (
    <View style={styles.screen}>
      <TopGlow />

      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header title={headerTitle} backDisabled={isSubmitting} />
      </View>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {state === 'loading' && (
        <View style={styles.skeletonBody}>
          <SkeletonBlock width="100%" height={150} borderRadius={14} />
          <SkeletonBlock width="100%" height={84} borderRadius={14} />
        </View>
      )}

      {/* ── Load error ──────────────────────────────────────────────────────── */}
      {state === 'load_error' && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
          <Text style={styles.errorText}>
            No pudimos cargar tu saldo de créditos. Comprueba tu conexión e inténtalo de nuevo.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
            <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary (con créditos) ──────────────────────────────────────────── */}
      {state === 'summary' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 }]}
          keyboardShouldPersistTaps="handled"
        >
          {submitError && <ErrorBanner title="No se pudo confirmar" body={submitError} />}

          <SummaryCard start={start} end={end} />
          <CreditCard remainingAfter={Math.max(0, credits - 1)} packSize={packSize} />

          <View style={styles.noteSection}>
            <View style={styles.noteLabelRow}>
              <Text style={styles.noteLabel}>Nota para Gustavo</Text>
              <View style={styles.optionalChip}>
                <Text style={styles.optionalChipText}>Opcional</Text>
              </View>
            </View>
            <TextInput
              style={styles.noteInput}
              placeholder="¿Algo en lo que quieras centrarte? Ej. recursión, álgebra lineal…"
              placeholderTextColor={Colors.textDim}
              multiline
              numberOfLines={3}
              value={note}
              onChangeText={setNote}
              textAlignVertical="top"
              editable={!isSubmitting}
            />
          </View>
        </ScrollView>
      )}

      {/* ── Slot taken between selection and booking ────────────────────────── */}
      {state === 'slot_taken' && (
        <View style={[styles.terminalRoot, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <View style={styles.terminalCenter}>
            <View style={[styles.terminalIcon, { backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder }]}>
              <MaterialCommunityIcons name="clock-alert-outline" size={32} color={Colors.warning} />
            </View>
            <Text style={styles.terminalTitle}>Esa hora ya no está disponible</Text>
            <Text style={styles.terminalBody}>
              Alguien acaba de reservar ese hueco. No se ha gastado ningún crédito. Elige otra hora
              para continuar.
            </Text>
          </View>
          <View style={styles.terminalActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={chooseAnotherSlot} activeOpacity={0.85}>
              <MaterialCommunityIcons name="calendar-clock" size={17} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>Elegir otro horario</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Sin créditos · cross-sell ───────────────────────────────────────── */}
      {state === 'no_credits' && (
        <View style={styles.noCreditsRoot}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.noCreditsScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.emptyHero}>
              <View style={styles.emptyHeroIcon}>
                <MaterialCommunityIcons name="timer-off-outline" size={30} color={Colors.warning} />
              </View>
              <Text style={styles.emptyTitle}>No te quedan créditos</Text>
              <Text style={styles.emptyBody}>
                {packLabel(packSize)
                  ? `Tu ${packLabel(packSize)} ya no tiene créditos disponibles. `
                  : 'Ya no tienes créditos disponibles. '}
                Compra un pack nuevo para volver a reservar con crédito, o paga esta clase suelta.
              </Text>
            </View>

            <View style={styles.crossSell}>
              <View style={styles.crossSellHead}>
                <Text style={styles.crossSellTitle}>Ahorra con un pack</Text>
                <View style={styles.crossSellBadge}>
                  <Text style={styles.crossSellBadgeText}>-15%</Text>
                </View>
              </View>
              <Text style={styles.crossSellBody}>
                5 o 10 clases por adelantado. Reserva con crédito cuando quieras.
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
            <TouchableOpacity style={styles.primaryBtn} onPress={goPacks} activeOpacity={0.85}>
              <MaterialCommunityIcons name="gift-outline" size={17} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>Ver packs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={payThisClass} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>
                {oneHourCents != null ? `Pagar esta clase · ${formatEur(oneHourCents)}` : 'Pagar esta clase'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Sticky confirm bar (summary only) ───────────────────────────────── */}
      {state === 'summary' && (
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <TouchableOpacity
            style={[styles.primaryBtn, isSubmitting && styles.primaryBtnDisabled]}
            onPress={isSubmitting ? undefined : handleConfirm}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons name="check" size={18} color={Colors.onPrimary} />
                <Text style={styles.primaryBtnText}>Confirmar · gastar 1 crédito</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.payCaption}>
            <Text style={styles.payCaptionText}>Sin pago · se descuenta 1 crédito al confirmar</Text>
          </View>
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

  // Skeleton / load error
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

  // Credit card (emerald-tinted)
  creditCard: {
    borderRadius: 14,
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    padding: Spacing[4],
  },
  creditTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  creditIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: 'rgba(78, 222, 163, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  creditTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 19,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  creditRemaining: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 16,
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  creditDivider: {
    height: 1,
    backgroundColor: 'rgba(78, 222, 163, 0.16)',
    marginVertical: Spacing[3],
  },
  creditMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  creditPackName: {
    fontSize: 12.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  creditMetaDim: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
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

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3] - 2,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[3] + 1,
  },
  errorBannerIcon: {
    marginTop: 1,
  },
  errorBannerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  errorBannerTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.error,
  },
  errorBannerBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Sticky bar (shared by summary + no_credits)
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
  primaryBtn: {
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
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
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

  // Terminal (slot_taken)
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

  // No-credits cross-sell
  noCreditsRoot: {
    flex: 1,
  },
  noCreditsScroll: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[5],
    paddingBottom: 160,
    gap: Spacing[4],
  },
  emptyHero: {
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    gap: Spacing[2],
  },
  emptyHeroIcon: {
    width: 66,
    height: 66,
    borderRadius: Radius.full,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.42,
    lineHeight: 26,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 290,
  },
  crossSell: {
    borderRadius: 14,
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    padding: Spacing[4],
    gap: Spacing[2] - 2,
  },
  crossSellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  crossSellTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  crossSellBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  crossSellBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  crossSellBody: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
