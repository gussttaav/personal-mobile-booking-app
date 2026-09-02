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
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { Locale } from '@/types/api';

type TFn = (key: TranslationKey) => string;

// The free intro is always a 15-min call.
const FIFTEEN_MIN_MS = 900_000;

// ── Helpers ───────────────────────────────────────────────────────────────────
// Screen-local, matching confirm-credit.tsx conventions.

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

// "Jueves 25 jun" / "Thursday 25 Jun"
function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

// "17:00 – 17:15 · 15 min"
function formatTimeRange(startIso: string, endIso: string, locale: Locale, t: TFn): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(bcp47(locale), { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fmt(startIso)} – ${fmt(endIso)} · ${t('common.duration15min')}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
// 'slot_taken' = the picked slot was claimed between selection and booking.
type ScreenState = 'summary' | 'slot_taken';

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
        <Text style={styles.headerOverline}>{t('confirmFree.header.overline')}</Text>
        <Text style={styles.headerTitleText}>{t('confirmFree.header.title')}</Text>
      </View>
      <View style={styles.stepChip}>
        <Text style={styles.stepChipText}>{t('confirmFree.header.step')}</Text>
      </View>
    </View>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({ start, end }: { start: string; end: string }) {
  const { t, locale } = useLocale();
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryOverline}>{t('common.yourBooking')}</Text>

      <View style={styles.summaryDateRow}>
        <View style={styles.summaryCalIcon}>
          <MaterialCommunityIcons name="calendar-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.summaryDateText}>
          <Text style={styles.summaryDate}>{formatDate(start, locale)}</Text>
          <Text style={styles.summaryTime}>{formatTimeRange(start, end, locale, t)}</Text>
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
  );
}

// ── FreeNoteCard ──────────────────────────────────────────────────────────────
// Emerald-tinted "no charge" reassurance card (mirrors the credit card slot).

function FreeNoteCard() {
  const { t } = useLocale();
  return (
    <View style={styles.freeCard}>
      <View style={styles.freeIcon}>
        <MaterialCommunityIcons name="gift-outline" size={21} color={Colors.primary} />
      </View>
      <View style={styles.freeText}>
        <Text style={styles.freeTitle}>{t('confirmFree.freeNote.title')}</Text>
        <Text style={styles.freeBody}>{t('confirmFree.freeNote.body')}</Text>
      </View>
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

export default function ConfirmFreeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();

  const start = startParam ?? '';
  // The free intro is always 15 min — recompute end from start rather than trust a param.
  const end = start ? new Date(Date.parse(start) + FIFTEEN_MIN_MS).toISOString() : '';

  const [state, setState] = useState<ScreenState>('summary');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Prevent stale updates after unmount, and double-submit before state lands.
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // ── Confirm → synchronous POST /api/book (free15min, no payment) ─────────────
  const handleConfirm = useCallback(async () => {
    if (submittingRef.current || !start || !end) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.postBook({
        startIso: start,
        endIso: end,
        sessionType: 'free15min',
        timezone: getDeviceTimeZone(),
        note: note.trim() || undefined,
      });

      router.replace({
        pathname: '/(tabs)/(booking)/success',
        params: {
          eventId: res.eventId,
          startIso: start,
          endIso: end,
          sessionType: 'free15min',
          joinToken: res.joinToken,
          cancelToken: res.cancelToken,
          emailFailed: String(res.emailFailed),
        },
      });
      return; // navigated away — leave the submit guard engaged
    } catch (err: unknown) {
      if (!mountedRef.current) return;

      if (err instanceof ApiError) {
        if (err.code === 'SLOT_UNAVAILABLE') {
          setState('slot_taken');
        } else if (err.status === 429) {
          setSubmitError(t('errors.tooManyAttempts'));
        } else {
          setSubmitError(t('confirmFree.errBookFailed'));
        }
      } else {
        setSubmitError(t('errors.noConnection'));
      }
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
      submittingRef.current = false;
    }
  }, [start, end, note, t]);

  const chooseAnotherSlot = useCallback(() => {
    router.back();
  }, []);

  return (
    <View style={styles.screen}>
      <TopGlow />

      <View style={[styles.headerWrap, { paddingTop: insets.top }]}>
        <Header backDisabled={isSubmitting} />
      </View>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      {state === 'summary' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 150 }]}
          keyboardShouldPersistTaps="handled"
        >
          {submitError && <ErrorBanner title={t('confirmFree.errorTitle')} body={submitError} />}

          <SummaryCard start={start} end={end} />
          <FreeNoteCard />

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
            <Text style={styles.terminalTitle}>{t('confirmFree.slotTaken.title')}</Text>
            <Text style={styles.terminalBody}>{t('confirmFree.slotTaken.body')}</Text>
          </View>
          <View style={styles.terminalActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={chooseAnotherSlot} activeOpacity={0.85}>
              <MaterialCommunityIcons name="calendar-clock" size={17} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>{t('confirmFree.slotTaken.cta')}</Text>
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
                <Text style={styles.primaryBtnText}>{t('confirmFree.confirmCta')}</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.payCaption}>
            <Text style={styles.payCaptionText}>{t('confirmFree.caption')}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Subset of confirm-credit.tsx's styles, kept consistent with that screen.

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

  // Free-note card (emerald-tinted)
  freeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: 14,
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    padding: Spacing[4],
  },
  freeIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius['2xl'] - 2,
    backgroundColor: 'rgba(78, 222, 163, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  freeTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 19,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  freeBody: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 16,
    fontFamily: FontFamily.body,
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

  // Sticky confirm bar
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
});
