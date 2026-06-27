import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';

function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeRemaining(startsAt: string): string {
  const delta = new Date(startsAt).getTime() - Date.now();
  if (delta <= 0) return 'Tu clase ya ha comenzado.';
  const totalMins = Math.ceil(delta / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h >= 1) return `Tu clase empieza en ${h} h ${fmt2(m)} min.`;
  return `Tu clase empieza en ${totalMins} min.`;
}

export default function RescheduleScreen() {
  const insets = useSafeAreaInsets();
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
            <Text style={styles.title}>Ya no puedes reprogramar online</Text>
            <Text style={styles.subtitle}>{formatTimeRemaining(safeStartsAt)}</Text>
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
            <Text style={styles.infoTitle}>Ventana de reprogramación cerrada</Text>
            <Text style={styles.infoBody}>
              El cambio de hora se cierra 2 h antes del inicio de la clase.
            </Text>
          </View>
        </View>

        <View style={styles.infoCardGreen}>
          <MaterialCommunityIcons
            name="chat-outline"
            size={18}
            color={Colors.primary}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>¿No puedes asistir?</Text>
            <Text style={styles.infoBody}>
              Avísale a Gustavo directamente y buscad una solución.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.tealBtn}
          onPress={() =>
            Alert.alert(
              'Próximamente',
              'El chat con Gustavo estará disponible próximamente.',
            )
          }
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="chat-processing-outline" size={18} color={Colors.primary} />
          <Text style={styles.tealBtnText}>Avisar a Gustavo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.ghostBtnText}>Volver al detalle</Text>
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
  infoCardGreen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
    backgroundColor: 'rgba(78,222,163,0.06)',
    borderColor: 'rgba(78,222,163,0.22)',
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
  tealBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(78,222,163,0.40)',
    backgroundColor: 'rgba(78,222,163,0.10)',
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
    marginBottom: Spacing[2],
  },
  tealBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
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
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
