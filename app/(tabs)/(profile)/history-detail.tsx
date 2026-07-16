import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { api } from '@/lib/api-client';
import {
  durationFromSessionType,
  durationLabel,
  formatDate,
  formatEur,
  formatTime,
  formatTimeRange,
} from '@/lib/format';
import { effectiveStatus } from '@/lib/history';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import type { BookingStatus, HistoryBooking, SessionType } from '@/types/api';

type TFn = (key: TranslationKey) => string;

const HISTORY_ROUTE = '/(tabs)/(profile)/history';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgoLabel(startsAt: string, t: TFn): string {
  const days = Math.floor((Date.now() - new Date(startsAt).getTime()) / 86400000);
  if (days <= 0) return t('history.today');
  if (days === 1) return t('history.daysAgoOne');
  return t('history.daysAgo').replace('{n}', String(days));
}

/** Where a pack class came from: "1 crédito · Pack 10" (or just the credit if size unknown). */
function packOriginValue(b: HistoryBooking, t: TFn): string {
  return b.packSize != null
    ? t('bookingDetail.payPackSized').replace('{n}', String(b.packSize))
    : t('bookingDetail.payPack');
}

/** A non-pack class's Pago value: "€75 · tarjeta" / "Clase gratuita" / fallback. */
function singlePayValue(b: HistoryBooking, t: TFn): string {
  if (b.sessionType === 'free15min') return t('bookingDetail.payFree');
  // Card is currently the only payment method (api-contract: payment method is not returned).
  return b.amountCents != null
    ? t('history.paidByCard').replace('{eur}', formatEur(b.amountCents))
    : t('bookingDetail.paySingle');
}

const STATUS_LABEL: Record<BookingStatus, TranslationKey> = {
  completed: 'history.statusCompleted',
  cancelled: 'history.statusCancelled',
  no_show:   'history.statusNoShow',
  confirmed: 'history.statusCompleted', // settlement lag — effectiveStatus never yields this
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useLocale();
  const params = useLocalSearchParams<{
    id: string;
    eventId: string;
    sessionType: string;
    status: string;
    startsAt: string;
    endsAt: string;
    packSize?: string;
    note?: string;
    amountCents?: string;
    rating?: string;
    comment?: string;
  }>();

  const [rebooking, setRebooking] = useState(false);

  // Rebuild the booking from the route params the list passed through.
  const booking: HistoryBooking = {
    id: params.id ?? '',
    eventId: params.eventId ?? '',
    sessionType: (params.sessionType ?? 'session1h') as SessionType,
    status: (params.status ?? 'completed') as BookingStatus,
    startsAt: params.startsAt ?? '',
    endsAt: params.endsAt ?? '',
    packSize: params.packSize != null ? Number(params.packSize) : undefined,
    note: params.note ?? null,
    amountCents: params.amountCents != null ? Number(params.amountCents) : null,
    currency: null,
    review: params.rating != null ? { rating: Number(params.rating), comment: params.comment ?? null } : null,
  };

  const status = effectiveStatus(booking);
  const isCompleted = status === 'completed';
  const duration = durationFromSessionType(booking.sessionType);
  const reviewed = booking.review != null;
  // The review endpoint keys off eventId, which the contract warns may be ''.
  const canReview = isCompleted && !reviewed && booking.eventId !== '';

  const goReview = useCallback(() => {
    router.push({
      pathname: '/review',
      params: { eventId: booking.eventId, returnTo: HISTORY_ROUTE },
    });
  }, [booking.eventId]);

  /**
   * "Book another like this". A paid class re-enters the pay flow at its own
   * duration. A pack class needs a live credit check — the credit that paid for
   * it was consumed, and the balance may now be zero, so route to Packs rather
   * than dead-ending on INSUFFICIENT_CREDITS at the confirm step.
   */
  const goBookAgain = useCallback(async () => {
    if (rebooking) return;

    if (booking.sessionType === 'session1h' || booking.sessionType === 'session2h') {
      router.push({
        pathname: '/(tabs)/(booking)/schedule',
        params: { duration: booking.sessionType === 'session2h' ? '2h' : '1h' },
      });
      return;
    }

    if (booking.sessionType === 'free15min') {
      // A free intro is one-per-account — let the user pick a real session instead.
      router.push('/(tabs)/(booking)/session-type');
      return;
    }

    setRebooking(true);
    try {
      const credits = await api.getCredits();
      if (credits.credits > 0) {
        router.push({ pathname: '/(tabs)/(booking)/schedule', params: { mode: 'credit' } });
      } else {
        router.push('/(tabs)/(packs)/packs');
      }
    } catch {
      // Can't confirm the balance — send them to Packs, which shows it and can top up.
      router.push('/(tabs)/(packs)/packs');
    } finally {
      setRebooking(false);
    }
  }, [booking.sessionType, rebooking]);

  const statusTone =
    status === 'completed' ? 'success' : status === 'no_show' ? 'error' : 'neutral';

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={
          isCompleted
            ? ['rgba(78, 222, 163, 0.13)', 'rgba(19, 19, 21, 0)']
            : ['rgba(255, 255, 255, 0.05)', 'rgba(19, 19, 21, 0)']
        }
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
        <Text style={styles.appBarTitle}>{t('history.detailTitle')}</Text>
        {booking.id !== '' && (
          <View style={styles.refPill}>
            <Text style={styles.refPillText}>#{booking.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.statusPill,
                statusTone === 'success' && styles.statusPillSuccess,
                statusTone === 'error' && styles.statusPillError,
                statusTone === 'neutral' && styles.statusPillNeutral,
              ]}
            >
              <MaterialCommunityIcons
                name={
                  status === 'completed'
                    ? 'check'
                    : status === 'no_show'
                      ? 'alert-circle-outline'
                      : 'close-circle-outline'
                }
                size={13}
                color={
                  statusTone === 'success'
                    ? Colors.primary
                    : statusTone === 'error'
                      ? Colors.error
                      : Colors.textDim
                }
              />
              <Text
                style={[
                  styles.statusPillText,
                  statusTone === 'success' && styles.statusTextSuccess,
                  statusTone === 'error' && styles.statusTextError,
                  statusTone === 'neutral' && styles.statusTextNeutral,
                ]}
              >
                {t(STATUS_LABEL[status])}
              </Text>
            </View>
            <Text style={styles.heroAgo}>{daysAgoLabel(booking.startsAt, t)}</Text>
          </View>

          <Text style={styles.heroOverline}>{durationLabel(duration, t)}</Text>
          <Text style={styles.heroTime}>
            {formatDate(booking.startsAt, locale)} · {formatTime(booking.startsAt)}
          </Text>
          <Text style={styles.heroMeta}>
            {durationLabel(duration, t)} · {t('common.tutorName')}
          </Text>
        </View>

        {/* ── Review state ──────────────────────────────────────────────────── */}
        {canReview && (
          <View style={styles.reviewPrompt}>
            <View style={styles.reviewPromptIcon}>
              <MaterialCommunityIcons name="star-outline" size={19} color={Colors.warning} />
            </View>
            <View style={styles.reviewPromptText}>
              <Text style={styles.reviewPromptTitle}>{t('history.notReviewedTitle')}</Text>
              <Text style={styles.reviewPromptBody}>{t('history.notReviewedBody')}</Text>
            </View>
          </View>
        )}

        {reviewed && (
          <View style={styles.reviewedCard}>
            <View style={styles.reviewedHeader}>
              <Text style={styles.sectionHeading}>{t('history.reviewedTitle')}</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <MaterialCommunityIcons
                    key={n}
                    name={n <= booking.review!.rating ? 'star' : 'star-outline'}
                    size={15}
                    color={n <= booking.review!.rating ? Colors.primary : Colors.borderVariant}
                  />
                ))}
              </View>
            </View>
            {booking.review!.comment != null && booking.review!.comment !== '' && (
              <Text style={styles.reviewedComment}>{booking.review!.comment}</Text>
            )}
          </View>
        )}

        {/* ── Details ───────────────────────────────────────────────────────── */}
        <View style={styles.detailsCard}>
          <DetailRow
            icon="calendar-outline"
            label={t('bookingDetail.dateLabel')}
            value={formatDate(booking.startsAt, locale)}
          />
          <View style={styles.divider} />
          <DetailRow
            icon="clock-outline"
            label={t('bookingDetail.timeLabel')}
            value={formatTimeRange(booking.startsAt, booking.endsAt, duration, t)}
          />
          <View style={styles.divider} />
          {booking.sessionType === 'pack' ? (
            <>
              {/* A pack class shows its origin (credit + pack size) and the per-class
                  amount the API already derived (pack charge ÷ pack size) as two rows. */}
              <DetailRow
                icon="credit-card-outline"
                label={t('history.originLabel')}
                value={packOriginValue(booking, t)}
              />
              {booking.amountCents != null && (
                <>
                  <View style={styles.divider} />
                  <DetailRow
                    icon="cash-multiple"
                    label={t('history.amountLabel')}
                    value={formatEur(booking.amountCents)}
                  />
                </>
              )}
            </>
          ) : (
            <DetailRow
              icon="cash-multiple"
              label={t('bookingDetail.payLabel')}
              value={singlePayValue(booking, t)}
            />
          )}
        </View>

        {/* ── Student note ──────────────────────────────────────────────────── */}
        {booking.note != null && booking.note.trim() !== '' && (
          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <MaterialCommunityIcons name="file-document-outline" size={16} color={Colors.textDim} />
              <Text style={styles.sectionHeading}>{t('history.noteHeading')}</Text>
            </View>
            <Text style={styles.noteText}>{booking.note}</Text>
          </View>
        )}

        {isCompleted && (
          <View style={styles.footerNote}>
            <MaterialCommunityIcons name="check" size={14} color={Colors.textDim} />
            <Text style={styles.footerNoteText}>{t('history.completedFooter')}</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Sticky actions ──────────────────────────────────────────────────── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + Spacing[3] }]}>
        {canReview && (
          <TouchableOpacity style={styles.primaryBtn} onPress={goReview} activeOpacity={0.85}>
            <MaterialCommunityIcons name="star-outline" size={19} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('history.leaveReview')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secondaryBtn, !canReview && styles.secondaryBtnSolo]}
          onPress={goBookAgain}
          activeOpacity={0.8}
          disabled={rebooking}
        >
          {rebooking ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.primary} />
              <Text style={styles.secondaryBtnText}>{t('history.bookAgain')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={19} color={Colors.textDim} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  refPill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 6,
  },
  refPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[5],
    gap: Spacing[3] + 2,
  },

  // Hero
  heroCard: {
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing[4] + 2,
    gap: Spacing[2],
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[1],
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 6,
  },
  statusPillSuccess: { backgroundColor: Colors.primaryDim },
  statusPillError: { backgroundColor: Colors.errorBg },
  statusPillNeutral: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
  },
  statusTextSuccess: { color: Colors.primary },
  statusTextError: { color: Colors.error },
  statusTextNeutral: { color: Colors.textDim },
  heroAgo: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  heroOverline: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  heroTime: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.52,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Review prompt (not reviewed)
  reviewPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] + 2,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.07)',
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    padding: Spacing[4] - 1,
  },
  reviewPromptIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    backgroundColor: Colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewPromptText: {
    flex: 1,
    minWidth: 0,
  },
  reviewPromptTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  reviewPromptBody: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 2,
  },

  // Reviewed card
  reviewedCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing[4],
    gap: Spacing[2],
  },
  reviewedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewedComment: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  sectionHeading: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Details card
  detailsCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3] + 2,
    paddingVertical: Spacing[3] + 1,
  },
  detailLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Note
  noteCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing[4],
    gap: Spacing[2] + 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] + 1,
  },
  noteText: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 22,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  footerNoteText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Action bar
  actionBar: {
    backgroundColor: 'rgba(19, 19, 21, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[2] + 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2] + 1,
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2] + 1,
    height: 50,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.30)',
    backgroundColor: 'rgba(78, 222, 163, 0.06)',
  },
  secondaryBtnSolo: {
    height: 52,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
});
