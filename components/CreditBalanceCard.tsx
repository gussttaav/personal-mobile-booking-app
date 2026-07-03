import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useT } from '@/lib/i18n/locale-context';
import type { GetCreditsResponse } from '@/types/api';

interface CreditBalanceCardProps {
  data: GetCreditsResponse;
  onReserve: () => void;
  onBuyMore: () => void;
}

const PACK_NAME: Record<number, string> = {
  5:  'Pack Esencial',
  10: 'Pack Intensivo',
};

export function CreditBalanceCard({ data, onReserve, onBuyMore }: CreditBalanceCardProps) {
  const t = useT();
  const { credits, packSize } = data;
  const packName = packSize != null ? (PACK_NAME[packSize] ?? `Pack ×${packSize}`) : null;
  const progressRatio = packSize != null && packSize > 0 ? credits / packSize : null;
  // Depleted: the user owns a pack (this card only renders when packSize != null) but
  // has spent every credit. Swap the reserve CTA for a repurchase nudge, and drop the
  // redundant top-right "Comprar más" link (the button already does it).
  const depleted = credits === 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.overline}>{t('creditCard.overline')}</Text>
        {!depleted && (
          <TouchableOpacity onPress={onBuyMore} hitSlop={8}>
            <Text style={styles.buyMore}>{t('creditCard.buyMore')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statRow}>
        <Text style={styles.stat}>{credits}</Text>
        <Text style={styles.statLabel}>
          {' '}
          {credits === 1 ? t('creditCard.creditWordOne') : t('creditCard.creditWordOther')}
        </Text>
        {packName != null && (
          <Text style={styles.packName}> · {packName}</Text>
        )}
      </View>

      {progressRatio != null && (
        <View style={styles.trackOuter}>
          <View style={[styles.trackFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
      )}

      {depleted && (
        <Text style={styles.depletedHint}>
          {t('creditCard.depletedHint')}
        </Text>
      )}

      <TouchableOpacity
        style={styles.reserveBtn}
        onPress={depleted ? onBuyMore : onReserve}
        activeOpacity={0.8}
      >
        <Text style={styles.reserveBtnText}>
          {depleted ? t('creditCard.buyMoreCredits') : t('creditCard.reserve')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.default,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  buyMore: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  stat: {
    ...TypeScale.stat,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  statLabel: {
    ...TypeScale.body,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  packName: {
    ...TypeScale.body,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  trackOuter: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  depletedHint: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  reserveBtn: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  reserveBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    fontWeight: '600',
  },
});
