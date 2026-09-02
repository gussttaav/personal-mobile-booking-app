import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/lib/api-client';
import { openGustavoEmail } from '@/lib/contact';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { Locale, PostCancelResponse } from '@/types/api';

type TFn = (key: TranslationKey) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

function endIsoFromSessionType(startIso: string, sessionType: string): string {
  const t = Date.parse(startIso);
  if (isNaN(t)) return startIso;
  const ms =
    sessionType === 'session2h' ? 7_200_000
    : sessionType === 'free15min' ? 900_000
    : 3_600_000;
  return new Date(t + ms).toISOString();
}

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const tag = bcp47(locale);
  const weekday = d.toLocaleDateString(tag, { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString(tag, { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeHHMM(iso: string): string {
  const d = new Date(iso);
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

function sessionDurationLabel(sessionType: string, t: TFn): string {
  if (sessionType === 'session2h') return t('common.duration2h');
  if (sessionType === 'free15min') return t('common.duration15min');
  return t('common.duration1h');
}

function formatTimeRange(startIso: string, sessionType: string, t: TFn): string {
  const endIso = endIsoFromSessionType(startIso, sessionType);
  return `${formatTimeHHMM(startIso)}–${formatTimeHHMM(endIso)} · ${sessionDurationLabel(sessionType, t)}`;
}

function formatTimeRemaining(startsAt: string, t: TFn): string {
  const delta = new Date(startsAt).getTime() - Date.now();
  if (delta <= 0) return t('common.timeRemaining.started');
  const totalMins = Math.ceil(delta / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h >= 1) return t('common.timeRemaining.hoursMins').replace('{h}', String(h)).replace('{m}', fmt2(m));
  return t('common.timeRemaining.mins').replace('{n}', String(totalMins));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'confirm'
  | 'blocked'
  | 'submitting'
  | 'success'
  | 'err_generic'
  | 'err_invalid_token'
  | 'err_outside_window';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CancelScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();
  const { token, startsAt, sessionType } = useLocalSearchParams<{
    token: string;
    startsAt: string;
    sessionType: string;
  }>();

  const safeStartsAt = startsAt ?? '';
  const safeToken = token ?? '';
  const safeSessionType = sessionType ?? 'session1h';

  // Synchronous 2h window check — no useEffect needed, initialises state once
  const isBlocked = new Date(safeStartsAt).getTime() - 2 * 60 * 60 * 1000 <= Date.now();

  const [phase, setPhase] = useState<Phase>(isBlocked ? 'blocked' : 'confirm');
  const [cancelResult, setCancelResult] = useState<PostCancelResponse | null>(null);
  const submittingRef = useRef(false);

  const isPack = safeSessionType === 'pack';
  // Free intro: no payment and no credit — cancelling refunds nothing.
  const isFree = safeSessionType === 'free15min';

  async function handleCancel() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase('submitting');
    try {
      const res = await api.postCancel({ token: safeToken });
      setCancelResult(res);
      setPhase('success');
      // submittingRef stays true — success screen has no retry path
    } catch (err) {
      submittingRef.current = false;
      if (err instanceof ApiError) {
        if (err.code === 'OUTSIDE_CANCEL_WINDOW') {
          setPhase('err_outside_window');
        } else if (
          err.code === 'INVALID_CANCEL_TOKEN' ||
          err.code === 'CANCEL_TOKEN_CONSUMED'
        ) {
          setPhase('err_invalid_token');
        } else {
          // Covers 403 (CSRF infra blip), 500, network errors — all retryable
          setPhase('err_generic');
        }
      } else {
        setPhase('err_generic');
      }
    }
  }

  // ── SUCCESS — full-screen ─────────────────────────────────────────────────

  if (phase === 'success') {
    const creditsRestored = cancelResult?.creditsRestored ?? isPack;
    const footerPB = Math.max(insets.bottom, Spacing[4]);

    return (
      <View style={styles.root}>
        {/* Close button */}
        <View style={[styles.closeRow, { paddingTop: Math.max(insets.top, Spacing[2]) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.replace('/(tabs)/(home)')}
            hitSlop={12}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('common.backHome')}
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
              <Text style={styles.pillTagText}>{t('cancel.success.pill')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('cancel.success.title')}</Text>
          </View>

          {creditsRestored ? (
            /* Pack — credit restored */
            <View style={[styles.successCard, styles.successCardGreen]}>
              <View style={styles.successCardRow}>
                <View style={[styles.successIconBox, styles.successIconBoxGreen]}>
                  <MaterialCommunityIcons name="database-outline" size={23} color={Colors.primary} />
                </View>
                <View style={styles.successCardText}>
                  <Text style={styles.successCardTitle}>{t('cancel.success.creditTitle')}</Text>
                  <Text style={styles.successCardBody}>{t('cancel.success.creditBody')}</Text>
                </View>
              </View>
            </View>
          ) : isFree ? (
            /* Free intro — nothing charged, nothing to refund */
            <View style={[styles.successCard, styles.successCardGreen]}>
              <View style={styles.successCardRow}>
                <View style={[styles.successIconBox, styles.successIconBoxGreen]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={23} color={Colors.primary} />
                </View>
                <View style={styles.successCardText}>
                  <Text style={styles.successCardTitle}>{t('cancel.success.freeTitle')}</Text>
                  <Text style={styles.successCardBody}>{t('cancel.success.freeBody')}</Text>
                </View>
              </View>
            </View>
          ) : (
            /* Paid — refund in progress */
            <View style={[styles.successCard, styles.successCardYellow]}>
              <View style={[styles.successCardRow, { marginBottom: Spacing[3] }]}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={20}
                  color={Colors.warning}
                  style={{ marginTop: 1, flexShrink: 0 }}
                />
                <View style={styles.successCardText}>
                  <Text style={styles.successCardTitle}>{t('cancel.success.refundTitle')}</Text>
                  <Text style={styles.successCardBody}>
                    {t('cancel.refundBody')}
                  </Text>
                </View>
              </View>
              <View style={styles.emailRow}>
                <MaterialCommunityIcons name="email-outline" size={17} color={Colors.textDim} />
                <Text style={styles.emailNote}>
                  {t('cancel.success.emailNote')}
                </Text>
              </View>
            </View>
          )}

          {/* Cancelled booking summary */}
          <View style={styles.cancelledRow}>
            <View style={styles.cancelledIconWrap}>
              <MaterialCommunityIcons name="calendar-remove-outline" size={20} color={Colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cancelledDate, styles.strikethrough]}>
                {formatDate(safeStartsAt, locale)} · {formatTimeHHMM(safeStartsAt)}
              </Text>
              <Text style={styles.cancelledSub}>{t('cancel.success.cancelledTag')}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
          {creditsRestored ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/(booking)/session-type')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="calendar-plus" size={18} color={Colors.onPrimary} />
                <Text style={styles.primaryBtnText}>{t('cancel.success.bookAnother')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => router.replace('/(tabs)/(home)')}
                activeOpacity={0.7}
              >
                <Text style={styles.ghostBtnText}>{t('common.backHome')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/(home)')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="home-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.primaryBtnText}>{t('common.backHome')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => router.replace('/(tabs)/(booking)/session-type')}
                activeOpacity={0.7}
              >
                <Text style={styles.ghostBtnText}>{t('cancel.success.bookAnother')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── BOTTOM SHEET states ───────────────────────────────────────────────────

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
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('cancel.confirm.title')}</Text>
                <Text style={styles.sheetSubtitle}>{t('cancel.confirm.subtitle')}</Text>
              </View>
            </View>

            {/* Mini booking row */}
            <View style={styles.miniBookingCard}>
              <View style={styles.miniBookingIconWrap}>
                <MaterialCommunityIcons name="calendar-outline" size={20} color={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniBookingDate}>{formatDate(safeStartsAt, locale)}</Text>
                <Text style={styles.miniBookingSub}>
                  {formatTimeRange(safeStartsAt, safeSessionType, t)}
                </Text>
              </View>
              {isPack ? (
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>{t('cancel.confirm.badgeCredit')}</Text>
                </View>
              ) : isFree ? (
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>{t('common.tagFree')}</Text>
                </View>
              ) : (
                <View style={styles.badgeGray}>
                  <Text style={styles.badgeGrayText}>{t('cancel.confirm.badgePaid')}</Text>
                </View>
              )}
            </View>

            {/* 2h rule */}
            <View style={styles.ruleRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.ruleText}>
                {t('cancel.confirm.ruleBefore')}
                <Text style={styles.ruleBold}>{t('cancel.confirm.ruleHours')}</Text>
                {t('cancel.confirm.ruleAfter')}
              </Text>
            </View>

            {/* Consequence card */}
            {isPack ? (
              <View style={[styles.consequenceCard, styles.consequenceGreen]}>
                <MaterialCommunityIcons
                  name="database-outline"
                  size={19}
                  color={Colors.primary}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consequenceTitle}>
                    {t('cancel.confirm.consequencePackTitle')}
                  </Text>
                  <Text style={styles.consequenceBody}>{t('cancel.confirm.consequencePackBody')}</Text>
                </View>
              </View>
            ) : isFree ? (
              <View style={[styles.consequenceCard, styles.consequenceGreen]}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={19}
                  color={Colors.primary}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consequenceTitle}>
                    {t('cancel.confirm.consequenceFreeTitle')}
                  </Text>
                  <Text style={styles.consequenceBody}>{t('cancel.confirm.consequenceFreeBody')}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.consequenceCard, styles.consequenceYellow]}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={19}
                  color={Colors.warning}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consequenceTitle}>
                    {t('cancel.confirm.consequencePaidTitle')}
                  </Text>
                  <Text style={styles.consequenceBody}>
                    {t('cancel.refundBody')}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.dangerBtn, submitting && styles.dangerBtnDisabled]}
              onPress={handleCancel}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#3a0a06" />
              ) : (
                <>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color="#3a0a06" />
                  <Text style={styles.dangerBtnText}>{t('cancel.confirm.dangerCta')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, submitting && styles.ghostBtnDisabled]}
              onPress={() => router.back()}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('cancel.confirm.keepCta')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── BLOCKED / ERR_OUTSIDE_WINDOW ──────────────────────────────── */}
        {(phase === 'blocked' || phase === 'err_outside_window') && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconWarning]}>
                <MaterialCommunityIcons name="clock-alert-outline" size={22} color={Colors.warning} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>{t('cancel.blocked.title')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {phase === 'err_outside_window'
                    ? t('cancel.blocked.subtitleOutside')
                    : formatTimeRemaining(safeStartsAt, t)}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, styles.infoCardDark]}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={Colors.textDim}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>{t('cancel.blocked.respectTitle')}</Text>
                <Text style={styles.infoCardBody}>
                  {t('cancel.blocked.respectBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.ghostBtn, { marginTop: Spacing[2] }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('common.backToDetail')}</Text>
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
                <Text style={styles.sheetTitle}>{t('cancel.errGeneric.title')}</Text>
                <Text style={styles.sheetSubtitle}>{t('cancel.errGeneric.subtitle')}</Text>
              </View>
            </View>

            <View style={[styles.infoCard, styles.infoCardDark]}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>{t('cancel.errGeneric.stillActiveTitle')}</Text>
                <Text style={styles.infoCardBody}>
                  {t('cancel.errGeneric.stillActiveBody')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={handleCancel}
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
              <Text style={styles.ghostBtnText}>{t('common.backToDetail')}</Text>
            </TouchableOpacity>
            <View style={styles.contactRow}>
              <Text style={styles.contactMuted}>{t('common.stillFailing')}</Text>
              <TouchableOpacity
                onPress={() =>
                  openGustavoEmail({
                    subject: t('cancel.errGeneric.emailSubject'),
                    body: t('cancel.errGeneric.emailBody').replace(
                      '{date}',
                      `${formatDate(safeStartsAt, locale)} · ${formatTimeHHMM(safeStartsAt)}`,
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

        {/* ── ERR_INVALID_TOKEN ─────────────────────────────────────────── */}
        {phase === 'err_invalid_token' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="close-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>
                  {t('cancel.errInvalid.title')}
                </Text>
                <Text style={styles.sheetSubtitle}>
                  {t('cancel.errInvalid.subtitle')}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={() => router.replace('/(tabs)/(home)')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('common.backHome')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root ───────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootSheet: {
    justifyContent: 'flex-end',
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

  // ── Mini booking row (confirm) ──────────────────────────────────────────
  miniBookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  miniBookingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniBookingDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  miniBookingSub: {
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

  // ── Consequence card (confirm) ──────────────────────────────────────────
  consequenceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[4],
  },
  consequenceGreen: {
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  consequenceYellow: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.26)',
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

  // ── Info cards (blocked / error) ────────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  infoCardDark: {
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
  dangerBtn: {
    height: 52,
    backgroundColor: Colors.error,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
    marginBottom: Spacing[2],
  },
  dangerBtnDisabled: {
    opacity: 0.6,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: '#3a0a06',
    lineHeight: 20,
  },
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

  // ── Contact row (err_generic) ────────────────────────────────────────────
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

  // ── Success (full-screen) ────────────────────────────────────────────────
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
  },
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
  successCard: {
    borderRadius: Radius['3xl'],
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[3],
  },
  successCardGreen: {
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  successCardYellow: {
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderColor: 'rgba(251,191,36,0.24)',
  },
  successCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  successIconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successIconBoxGreen: {
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78,222,163,0.26)',
  },
  successCardText: {
    flex: 1,
  },
  successCardTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  successCardBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.18)',
    paddingTop: Spacing[3],
  },
  emailNote: {
    flex: 1,
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  cancelledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  cancelledIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cancelledDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textDim,
    marginBottom: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  cancelledSub: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
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
