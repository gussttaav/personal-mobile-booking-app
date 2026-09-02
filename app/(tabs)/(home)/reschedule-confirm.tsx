import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/lib/api-client';
import { openGustavoEmail } from '@/lib/contact';
import { getDeviceTimeZone } from '@/lib/grid-time';
import { rescheduleFlag } from '@/lib/reschedule-flag';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { Locale, PostBookResponse, SessionType } from '@/types/api';

type TFn = (key: TranslationKey) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatHHMM(startIso)}–${formatHHMM(endIso)}`;
}

function endIsoFromSessionType(startIso: string, sType: string): string {
  const t = Date.parse(startIso);
  if (isNaN(t)) return startIso;
  const ms =
    sType === 'session2h' ? 7_200_000
    : sType === 'free15min' ? 900_000
    : 3_600_000;
  return new Date(t + ms).toISOString();
}

function durationLabel(sType: string, t: TFn): string {
  if (sType === 'session2h') return t('common.duration2h');
  if (sType === 'free15min') return t('common.duration15min');
  return t('common.duration1h');
}

// Reset the Booking tab's stack to session-type (it holds S05 in reschedule mode),
function goHome() {
  rescheduleFlag.mark();
  router.replace('/(tabs)/(home)');
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'confirm'
  | 'submitting'
  | 'success'
  | 'slot_taken'
  | 'err_invalid_token'
  | 'err_outside_window'
  | 'err_generic';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RescheduleConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();
  const { rescheduleToken, sessionType, newStartIso, newEndIso, origStartsAt } =
    useLocalSearchParams<{
      rescheduleToken: string;
      sessionType: string;
      newStartIso: string;
      newEndIso: string;
      origStartsAt: string;
    }>();

  const safeToken = rescheduleToken ?? '';
  const safeSessionType = sessionType ?? 'session1h';
  const safeNewStart = newStartIso ?? '';
  const safeNewEnd = newEndIso ?? '';
  const safeOrigStart = origStartsAt ?? '';

  const origEnd = endIsoFromSessionType(safeOrigStart, safeSessionType);
  const isPack = safeSessionType === 'pack';

  const [phase, setPhase] = useState<Phase>('confirm');
  const [bookingResult, setBookingResult] = useState<PostBookResponse | null>(null);
  const submittingRef = useRef(false);

  async function handleConfirm() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase('submitting');
    try {
      const res = await api.postBook({
        startIso: safeNewStart,
        endIso: safeNewEnd,
        sessionType: safeSessionType as SessionType,
        rescheduleToken: safeToken,
        timezone: getDeviceTimeZone(),
      });
      setBookingResult(res);
      setPhase('success');
      // submittingRef stays true — success screen has no retry path
    } catch (err) {
      submittingRef.current = false;
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'SLOT_UNAVAILABLE') {
          setPhase('slot_taken');
          return;
        }
        if (
          err.code === 'INVALID_RESCHEDULE_TOKEN' ||
          err.code === 'SESSION_TYPE_MISMATCH' ||
          err.code === 'RESCHEDULE_TOKEN_CONSUMED'
        ) {
          setPhase('err_invalid_token');
          return;
        }
        if (err.code === 'OUTSIDE_RESCHEDULE_WINDOW') {
          setPhase('err_outside_window');
          return;
        }
      }
      setPhase('err_generic');
    }
  }

  // ── SUCCESS — full-screen ─────────────────────────────────────────────────

  if (phase === 'success') {
    const footerPB = Math.max(insets.bottom, Spacing[4]);
    void bookingResult; // used for side effects, success display uses params

    return (
      <View style={styles.root}>
        {/* Emerald ambient top glow */}
        <LinearGradient
          colors={['rgba(78, 222, 163, 0.18)', 'rgba(19, 19, 21, 0)']}
          style={styles.topGlow}
          pointerEvents="none"
        />

        {/* Close button */}
        <View style={[styles.closeRow, { paddingTop: Math.max(insets.top, Spacing[2]) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => {
              goHome();
            }}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={22} color={Colors.textDim} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.successScroll, { paddingBottom: 160 + footerPB }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.heroCircle}>
              <MaterialCommunityIcons name="check" size={40} color={Colors.primary} />
            </View>
            <View style={styles.pillTag}>
              <Text style={styles.pillTagText}>{t('reschedule.confirm.successPill')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('reschedule.confirm.successTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('reschedule.confirm.noChargeSameCredit')}</Text>
          </View>

          {/* Before → After card */}
          <View style={styles.changeCard}>
            <Text style={styles.changeCardOverline}>{t('reschedule.confirm.changeOverline')}</Text>

            {/* FROM row */}
            <View style={styles.slotRow}>
              <View style={[styles.slotIconWrap, styles.slotIconFrom]}>
                <MaterialCommunityIcons name="calendar-remove-outline" size={18} color={Colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.slotDate, styles.strikethrough]}>{formatDate(safeOrigStart, locale)}</Text>
                <Text style={[styles.slotTime, styles.strikethrough]}>
                  {formatTimeRange(safeOrigStart, origEnd)} · {durationLabel(safeSessionType, t)}
                </Text>
              </View>
              {isPack ? (
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>{t('common.tagCredit')}</Text>
                </View>
              ) : (
                <View style={styles.badgeGray}>
                  <Text style={styles.badgeGrayText}>{t('common.tagPaid')}</Text>
                </View>
              )}
            </View>

            <View style={styles.arrowRow}>
              <View style={styles.arrowLine} />
              <View style={styles.arrowCircle}>
                <MaterialCommunityIcons name="arrow-down" size={14} color={Colors.primary} />
              </View>
              <View style={styles.arrowLine} />
            </View>

            {/* TO row */}
            <View style={styles.slotRow}>
              <View style={[styles.slotIconWrap, styles.slotIconTo]}>
                <MaterialCommunityIcons name="calendar-check-outline" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotDate}>{formatDate(safeNewStart, locale)}</Text>
                <Text style={styles.slotTime}>
                  {formatTimeRange(safeNewStart, safeNewEnd)} · {durationLabel(safeSessionType, t)}
                </Text>
              </View>
              <MaterialCommunityIcons name="check-circle" size={20} color={Colors.primary} />
            </View>
          </View>

          {/* Reassurance card */}
          <View style={styles.reassuranceCard}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={18}
              color={Colors.primary}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.reassuranceTitle}>{t('reschedule.confirm.reassuranceTitle')}</Text>
              <Text style={styles.reassuranceBody}>
                {t('reschedule.confirm.reassuranceBody')}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              Alert.alert(t('common.soonTitle'), t('reschedule.confirm.calendarSoonBody'))
            }
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="calendar-plus" size={18} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('addToCalendar.title')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => {
              goHome();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostBtnText}>{t('common.backHome')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── BOTTOM-SHEET states ───────────────────────────────────────────────────

  const submitting = phase === 'submitting';
  const sheetPB = Math.max(insets.bottom, Spacing[4]);

  return (
    <View style={[styles.root, styles.rootSheet]}>
      <View style={[styles.sheet, { paddingBottom: sheetPB }]}>
        <View style={styles.handle} />

        {/* ── CONFIRM / SUBMITTING ───────────────────────────────────────── */}
        {(phase === 'confirm' || phase === 'submitting') && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconGreen]}>
                <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('reschedule.confirm.sheetTitle')}</Text>
                <Text style={styles.sheetSubtitle}>{t('reschedule.confirm.noChargeSameCredit')}</Text>
              </View>
            </View>

            {/* FROM mini row */}
            <View style={styles.miniSlotCard}>
              <View style={[styles.miniSlotIconWrap, styles.slotIconFrom]}>
                <MaterialCommunityIcons name="calendar-remove-outline" size={17} color={Colors.textDim} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.miniSlotDate, styles.strikethrough]}>{formatDate(safeOrigStart, locale)}</Text>
                <Text style={[styles.miniSlotTime, styles.strikethrough]}>
                  {formatTimeRange(safeOrigStart, origEnd)} · {durationLabel(safeSessionType, t)}
                </Text>
              </View>
            </View>

            <View style={styles.arrowRowSmall}>
              <MaterialCommunityIcons name="arrow-down" size={18} color={Colors.primary} />
            </View>

            {/* TO mini row */}
            <View style={[styles.miniSlotCard, styles.miniSlotCardTo]}>
              <View style={[styles.miniSlotIconWrap, styles.slotIconTo]}>
                <MaterialCommunityIcons name="calendar-check-outline" size={17} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniSlotDate}>{formatDate(safeNewStart, locale)}</Text>
                <Text style={styles.miniSlotTime}>
                  {formatTimeRange(safeNewStart, safeNewEnd)} · {durationLabel(safeSessionType, t)}
                </Text>
              </View>
            </View>

            {/* 2h rule reassurance */}
            <View style={styles.ruleRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.ruleText}>
                {t('reschedule.confirm.ruleTextBefore')}
                <Text style={styles.ruleBold}>2 h</Text>
                {t('reschedule.confirm.ruleTextAfter')}
              </Text>
            </View>

            {/* What changes */}
            <View style={styles.consequenceCard}>
              <MaterialCommunityIcons
                name="swap-horizontal"
                size={19}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.consequenceTitle}>{t('reschedule.confirm.consequenceTitle')}</Text>
                <Text style={styles.consequenceBody}>
                  {isPack
                    ? t('reschedule.confirm.consequenceBodyPack')
                    : t('reschedule.confirm.consequenceBodyPaid')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={18} color={Colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>{t('reschedule.confirm.confirmBtn')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, submitting && styles.ghostBtnDisabled]}
              onPress={() => router.back()}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('schedule.empty.keepCurrent')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── SLOT TAKEN ────────────────────────────────────────────────── */}
        {phase === 'slot_taken' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('reschedule.confirm.slotTakenTitle')}</Text>
                <Text style={styles.sheetSubtitle}>{t('reschedule.confirm.originalIntact')}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>{t('reschedule.confirm.bookingStillActive')}</Text>
                <Text style={styles.infoCardBody}>
                  {t('reschedule.confirm.slotTakenBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="calendar-search" size={18} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>{t('reschedule.confirm.chooseAnother')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ERR_INVALID_TOKEN ─────────────────────────────────────────── */}
        {phase === 'err_invalid_token' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="link-variant-off" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('reschedule.confirm.invalidTokenTitle')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {t('reschedule.confirm.invalidTokenBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={goHome}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('common.backHome')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ERR_OUTSIDE_WINDOW ────────────────────────────────────────── */}
        {phase === 'err_outside_window' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconWarning]}>
                <MaterialCommunityIcons name="clock-alert-outline" size={22} color={Colors.warning} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('reschedule.blockedTitle')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {t('reschedule.confirm.outsideWindowBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={goHome}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('common.backHome')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ERR_GENERIC ───────────────────────────────────────────────── */}
        {phase === 'err_generic' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="close-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('reschedule.confirm.genericTitle')}</Text>
                <Text style={styles.sheetSubtitle}>{t('reschedule.confirm.originalIntact')}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>{t('reschedule.confirm.bookingStillActive')}</Text>
                <Text style={styles.infoCardBody}>
                  {t('reschedule.confirm.genericBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={() => {
                submittingRef.current = false;
                setPhase('confirm');
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('reschedule.confirm.backToGrid')}</Text>
            </TouchableOpacity>
            <View style={styles.contactRow}>
              <Text style={styles.contactMuted}>{t('common.stillFailing')}</Text>
              <TouchableOpacity
                onPress={() =>
                  openGustavoEmail({
                    subject: t('reschedule.confirm.emailSubject'),
                    body: t('reschedule.confirm.emailBody').replace(
                      '{date}',
                      `${formatDate(safeOrigStart, locale)} · ${formatHHMM(safeOrigStart)}`,
                    ),
                    noMailAppTitle: t('common.noMailAppTitle'),
                    noMailAppBody: t('common.noMailAppBody'),
                  })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.contactLink}>{t('common.writeToGustavo')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootSheet: {
    justifyContent: 'flex-end',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },

  // ── Bottom sheet ────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: Colors.surfaceLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderVariant,
    alignSelf: 'center',
    marginBottom: Spacing[4],
  },

  // ── Sheet header row ────────────────────────────────────────────────────
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  headerIconCircle: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIconGreen: {
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  headerIconError: {
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  headerIconWarning: {
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  sheetTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  // ── Mini slot cards (confirm sheet) ────────────────────────────────────
  miniSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[1],
  },
  miniSlotCardTo: {
    backgroundColor: Colors.primaryDim,
    borderColor: Colors.successBorder,
    marginBottom: Spacing[3],
  },
  miniSlotIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniSlotDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  miniSlotTime: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  arrowRowSmall: {
    alignItems: 'center',
    marginVertical: Spacing[1],
  },

  // ── Slot icon variants ───────────────────────────────────────────────────
  slotIconFrom: {
    backgroundColor: Colors.surfaceHigh,
  },
  slotIconTo: {
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },

  // ── 2h rule line ────────────────────────────────────────────────────────
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  ruleText: {
    flex: 1,
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  ruleBold: {
    color: Colors.text,
    fontWeight: '600',
  },

  // ── Consequence card ────────────────────────────────────────────────────
  consequenceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[4],
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  consequenceTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  consequenceBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // ── Info card (slot_taken / errors) ────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.border,
  },
  infoCardTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  infoCardBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    lineHeight: 18,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[2],
    boxShadow: '0 0 26px rgba(78,222,163,0.35)',
  } as any,
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
    lineHeight: 20,
  },
  ghostBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  ghostBtnDisabled: {
    opacity: 0.4,
  },
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },

  // ── Contact row (err_generic) ───────────────────────────────────────────
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  contactMuted: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  contactLink: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── SUCCESS styles ───────────────────────────────────────────────────────
  closeRow: {
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
  successScroll: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    gap: Spacing[4] - 2,
  },
  heroBlock: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[4],
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 30px rgba(78,222,163,0.25)',
  } as any,
  pillTag: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
  },
  pillTagText: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FontFamily.headline,
    letterSpacing: -0.48,
    lineHeight: 28,
    color: Colors.text,
  },
  heroSubtitle: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    textAlign: 'center',
  },

  // Before → After card (success)
  changeCard: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[3],
  },
  changeCardOverline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginBottom: Spacing[3],
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[1],
  },
  slotIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  slotDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  slotTime: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  badgeGreen: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeGreenText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    letterSpacing: 0.4,
    lineHeight: 12,
    color: Colors.primary,
  },
  badgeGray: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeGrayText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    letterSpacing: 0.4,
    lineHeight: 12,
    color: Colors.textMuted,
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginVertical: Spacing[2],
  },
  arrowLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Reassurance card (success)
  reassuranceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['3xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  reassuranceTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  reassuranceBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // Sticky footer (success)
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19,19,21,0.94)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[2],
  },
});
