import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
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
  const { credits, packSize } = data;
  const packName = packSize != null ? (PACK_NAME[packSize] ?? `Pack ×${packSize}`) : null;
  const progressRatio = packSize != null && packSize > 0 ? credits / packSize : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.overline}>SALDO DE CRÉDITOS</Text>
        <TouchableOpacity onPress={onBuyMore} hitSlop={8}>
          <Text style={styles.buyMore}>Comprar más</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statRow}>
        <Text style={styles.stat}>{credits}</Text>
        <Text style={styles.statLabel}> créditos</Text>
        {packName != null && (
          <Text style={styles.packName}> · {packName}</Text>
        )}
      </View>

      {progressRatio != null && (
        <View style={styles.trackOuter}>
          <View style={[styles.trackFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
      )}

      <TouchableOpacity style={styles.reserveBtn} onPress={onReserve} activeOpacity={0.8}>
        <Text style={styles.reserveBtnText}>Reservar con crédito →</Text>
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
