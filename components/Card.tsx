import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  glowing?: boolean;
}

export function Card({ children, style, glowing = false }: CardProps) {
  return (
    <View style={[styles.card, glowing && styles.glowing, style]}>
      {children}
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
  },
  glowing: {
    backgroundColor: 'rgba(78, 222, 163, 0.07)',
    borderColor: 'rgba(78, 222, 163, 0.28)',
    boxShadow: [
      { offsetX: 0, offsetY: 14, blurRadius: 40, spreadDistance: -18, color: 'rgba(78, 222, 163, 0.45)' },
    ],
  },
});
