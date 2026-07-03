import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';
import type { Booking, Locale } from '@/types/api';

interface BookingRowProps {
  booking: Booking;
  onPress: () => void;
}

type TFn = (key: TranslationKey) => string;

// Spanish uses day-before-month; en-GB keeps that ordering in English.
function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'es-ES';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function durationLabel(startsAt: string, endsAt: string, t: TFn): string {
  const mins = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  if (mins <= 60) return `${mins} min`;
  return mins === 120 ? t('common.duration2h') : t('common.duration1h');
}

type TagVariant = 'credit' | 'paid' | 'free';

function tagVariant(sessionType: Booking['sessionType']): TagVariant {
  if (sessionType === 'pack') return 'credit';
  if (sessionType === 'free15min') return 'free';
  return 'paid';
}

const TAG_LABEL_KEY: Record<TagVariant, TranslationKey> = {
  credit: 'common.tagCredit',
  paid:   'common.tagPaid',
  free:   'common.tagFree',
};

export function BookingRow({ booking, onPress }: BookingRowProps) {
  const { locale, t } = useLocale();
  const start = new Date(booking.startsAt);
  const dayAbbr = start.toLocaleDateString(bcp47(locale), { weekday: 'short' }).replace('.', '');
  const dateNum = start.getDate();
  const timeRange = `${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`;
  const dur = durationLabel(booking.startsAt, booking.endsAt, t);
  const variant = tagVariant(booking.sessionType);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.dayCol}>
        <Text style={styles.dayAbbr}>{dayAbbr}</Text>
        <Text style={styles.dateNum}>{dateNum}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.timeRange}>{timeRange}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.dur}>{dur}</Text>
          <View style={[styles.tag, variant === 'credit' ? styles.tagCredit : styles.tagPaid]}>
            <Text style={[styles.tagText, variant === 'credit' ? styles.tagTextCredit : styles.tagTextPaid]}>
              {t(TAG_LABEL_KEY[variant])}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.default,
    marginBottom: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dayCol: {
    width: 40,
    alignItems: 'center',
    marginRight: Spacing[3],
  },
  dayAbbr: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  dateNum: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  timeRange: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  dur: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tagCredit: {
    borderColor: Colors.successBorder,
    backgroundColor: Colors.successBg,
  },
  tagPaid: {
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  tagText: {
    ...TypeScale.badge,
    fontFamily: FontFamily.body,
  },
  tagTextCredit: {
    color: Colors.primary,
  },
  tagTextPaid: {
    color: Colors.textDim,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textDim,
    marginLeft: Spacing[2],
  },
});
