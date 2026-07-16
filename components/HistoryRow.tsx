import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { bcp47, durationFromSessionType, durationLabel, formatEur, formatTime } from '@/lib/format';
import { effectiveStatus } from '@/lib/history';
import { useLocale } from '@/lib/i18n/locale-context';
import type { BookingStatus, HistoryBooking } from '@/types/api';

interface HistoryRowProps {
  booking: HistoryBooking;
  onPress: () => void;
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={12}
          color={n <= rating ? Colors.primary : Colors.borderVariant}
        />
      ))}
    </View>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

export function HistoryRow({ booking, onPress }: HistoryRowProps) {
  const { locale, t } = useLocale();

  const status = effectiveStatus(booking);
  const isCancelled = status === 'cancelled';
  const dimmed = isCancelled;

  const start = new Date(booking.startsAt);
  const dayAbbr = start.toLocaleDateString(bcp47(locale), { weekday: 'short' }).replace('.', '');
  const dateNum = start.getDate();

  const duration = durationFromSessionType(booking.sessionType);
  const timeRange = `${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)} · ${durationLabel(duration, t)}`;

  const suffix = metaSuffix(booking, status, t);
  const reviewed = booking.review != null;
  // The review CTA needs an eventId to POST against, and only a delivered class is reviewable.
  const canReview = status === 'completed' && !reviewed && booking.eventId !== '';

  return (
    <TouchableOpacity
      style={[styles.row, dimmed && styles.rowDimmed]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={[styles.dateTile, dimmed && styles.dateTileDimmed]}>
        <Text style={[styles.dateNum, dimmed && styles.textDimmed]}>{dateNum}</Text>
        <Text style={styles.dayAbbr}>{dayAbbr}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.timeRange, dimmed && styles.textMutedDimmed]}>{timeRange}</Text>

        <View style={styles.metaRow}>
          {reviewed && <Stars rating={booking.review!.rating} />}

          {canReview && (
            <View style={[styles.pill, styles.pillWarning]}>
              <MaterialCommunityIcons name="star-outline" size={11} color={Colors.warning} />
              <Text style={[styles.pillText, styles.pillTextWarning]}>{t('history.reviewCta')}</Text>
            </View>
          )}

          {isCancelled && (
            <View style={[styles.pill, styles.pillNeutral]}>
              <MaterialCommunityIcons name="close-circle-outline" size={11} color={Colors.textDim} />
              <Text style={[styles.pillText, styles.pillTextNeutral]}>
                {t('history.statusCancelled')}
              </Text>
            </View>
          )}

          {status === 'no_show' && (
            <View style={[styles.pill, styles.pillError]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={11} color={Colors.error} />
              <Text style={[styles.pillText, styles.pillTextError]}>{t('history.statusNoShow')}</Text>
            </View>
          )}

          {suffix !== null && <Text style={styles.suffix}>· {suffix}</Text>}
        </View>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDim} />
    </TouchableOpacity>
  );
}

/**
 * The trailing "· 1 crédito" / "· €40" / "· crédito devuelto" line.
 *
 * A cancelled PACK class always restores its credit (POST /api/cancel), so we can
 * state that. A cancelled paid class refunds minus the Stripe fee — the history
 * payload can't tell us the net, so we say nothing rather than guess.
 */
function metaSuffix(
  booking: HistoryBooking,
  status: BookingStatus,
  t: (key: 'history.oneCredit' | 'history.creditReturned' | 'common.tagFree') => string,
): string | null {
  const isPack = booking.sessionType === 'pack';

  if (status === 'cancelled') {
    return isPack ? t('history.creditReturned') : null;
  }
  if (isPack) return t('history.oneCredit');
  if (booking.sessionType === 'free15min') return t('common.tagFree');
  return booking.amountCents != null ? formatEur(booking.amountCents) : null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3] + 2,
    backgroundColor: Colors.surfaceLow,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  rowDimmed: {
    backgroundColor: '#161517',
    borderColor: Colors.border,
  },

  dateTile: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTileDimmed: {
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.border,
  },
  dateNum: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  dayAbbr: {
    ...TypeScale.badge,
    fontSize: 8.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  content: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  timeRange: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] - 1,
    flexWrap: 'wrap',
  },
  stars: {
    flexDirection: 'row',
    gap: 1.5,
  },
  suffix: {
    fontSize: 11.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  pillWarning: { backgroundColor: Colors.warningBg },
  pillNeutral: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  pillError: { backgroundColor: Colors.errorBg },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
  },
  pillTextWarning: { color: Colors.warning },
  pillTextNeutral: { color: Colors.textDim },
  pillTextError: { color: Colors.error },

  textDimmed: { color: Colors.textDim },
  textMutedDimmed: { color: Colors.textMuted },
});
