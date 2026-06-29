import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { Colors, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';
import type { Locale } from '@/types/api';

// S18 · Ajustes — foundation build wires only the language control: it exercises
// the full setLocale path (switch UI language + persist to device + POST
// /api/locale). The rest of the settings UI is future work.

const OPTIONS: { value: Locale; labelKey: 'settings.language.es' | 'settings.language.en' }[] = [
  { value: 'es', labelKey: 'settings.language.es' },
  { value: 'en', labelKey: 'settings.language.en' },
];

export default function SettingsScreen() {
  const { locale, setLocale, t } = useLocale();
  const [pending, setPending] = useState<Locale | null>(null);

  async function choose(next: Locale) {
    if (next === locale || pending) return;
    setPending(next);
    try {
      await setLocale(next);
    } catch {
      // setLocale already switched the UI + persisted locally; only the backend
      // sync failed. Leave the new language in place — the next sign-in reconciles.
    } finally {
      setPending(null);
    }
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('settings.title'),
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />
      <Text style={styles.sectionTitle}>{t('settings.language.title')}</Text>
      <View style={styles.segment}>
        {OPTIONS.map((opt) => {
          const active = opt.value === locale;
          return (
            <Pressable
              key={opt.value}
              onPress={() => choose(opt.value)}
              disabled={pending != null}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[6],
    gap: Spacing[3],
  },
  sectionTitle: {
    color: Colors.textMuted,
    ...TypeScale.overline,
    textTransform: 'uppercase',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.xl,
    padding: Spacing[1],
    gap: Spacing[1],
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: Colors.primaryDim,
  },
  segmentLabel: {
    color: Colors.textDim,
    ...TypeScale.label,
  },
  segmentLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
