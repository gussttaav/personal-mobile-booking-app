import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';

type TFn = (key: TranslationKey) => string;

function fmt2(n: number): string {
  return String(n).padStart(2, '0');
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

export default function RescheduleScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const { token, startsAt, sessionType } = useLocalSearchParams<{
    token: string;
    startsAt: string;
    sessionType: string;
  }>();

  const safeToken = token ?? '';
  const safeStartsAt = startsAt ?? '';
  const safeSessionType = sessionType ?? 'session1h';

  // Synchronous 2h window check — mirrors S12's cancel gate
  const isBlocked = new Date(safeStartsAt).getTime() - 2 * 60 * 60 * 1000 <= Date.now();

  useEffect(() => {
    if (!isBlocked) {
      router.replace({
        pathname: '/(tabs)/(booking)/schedule',
        params: {
          mode: 'reschedule',
          rescheduleToken: safeToken,
          lockedSessionType: safeSessionType,
          origStartsAt: safeStartsAt,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Not blocked: render empty shell while the effect navigates to the grid
  if (!isBlocked) {
    return <View style={styles.root} />;
  }

  // Blocked — bottom-sheet style UI matching S12's blocked state
  const sheetPB = Math.max(insets.bottom, Spacing[4]);

  return (
    <View style={[styles.root, styles.rootSheet]}>
      <View style={[styles.sheet, { paddingBottom: sheetPB }]}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="clock-alert-outline" size={22} color={Colors.warning} />
          </View>
          <View style={{ flex: 1, paddingTop: 1 }}>
            <Text style={styles.title}>{t('reschedule.blockedTitle')}</Text>
            <Text style={styles.subtitle}>{formatTimeRemaining(safeStartsAt, t)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={Colors.textDim}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>{t('reschedule.windowTitle')}</Text>
            <Text style={styles.infoBody}>
              {t('reschedule.windowBody')}
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootSheet: {
    justifyContent: 'flex-end',
  },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  title: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },
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
  infoTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  infoBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    lineHeight: 18,
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
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
