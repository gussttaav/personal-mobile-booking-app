import { useEffect, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';

// ── Helpers ───────────────────────────────────────────────────────────────────
// Screen-local copies matching Home/S08 conventions.

function formatDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTimeRange(startIso: string, endIso: string, duration: '1h' | '2h'): string {
  const label = duration === '1h' ? '1 hora' : '2 horas';
  return `${formatTime(startIso)} – ${formatTime(endIso)} · ${label}`;
}

function durationFromSessionType(sessionType: string): '1h' | '2h' {
  return sessionType === 'session2h' ? '2h' : '1h';
}

function classLabel(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  if (start.toDateString() === now.toDateString()) return 'Hoy';
  const tomorrow = new Date(now.getTime() + 86400000);
  if (start.toDateString() === tomorrow.toDateString()) return 'Mañana';
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return DAYS[start.getDay()];
}

type ClassStatus = 'upcoming' | 'imminent' | 'active';

function getClassStatus(startsAt: string, endsAt: string): ClassStatus {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (now >= start && now <= end) return 'active';
  if (now >= start - 15 * 60 * 1000 && now < start) return 'imminent';
  return 'upcoming';
}

function minutesUntil(startsAt: string): number {
  return Math.max(0, Math.round((new Date(startsAt).getTime() - Date.now()) / 60000));
}

function payLabel(sessionType: string, packSize?: string): string {
  if (sessionType === 'pack') {
    return packSize ? `1 crédito · Pack ${packSize}` : '1 crédito · Pack';
  }
  if (sessionType === 'free15min') return 'Clase gratuita';
  return 'Sesión individual';
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    token: string;
    joinToken: string;
    eventId: string;
    sessionType: string;
    startsAt: string;
    endsAt: string;
    packSize?: string;
  }>();

  const token = params.token ?? '';
  const joinToken = params.joinToken ?? '';
  const eventId = params.eventId ?? '';
  const sessionType = params.sessionType ?? 'session1h';
  const startsAt = params.startsAt ?? '';
  const endsAt = params.endsAt ?? '';
  const packSize = params.packSize;

  const duration = durationFromSessionType(sessionType);
  const status = startsAt ? getClassStatus(startsAt, endsAt) : 'upcoming';
  const isJoinable = status === 'imminent' || status === 'active';
  const isPack = sessionType === 'pack';
  const heroEmphasis = isJoinable;

  // Pulsing dot for imminent/active chip
  const dotOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status === 'upcoming') {
      dotOpacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.15, duration: 800, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [status]);

  const goBack = () => router.back();

  const goJoin = () => {
    router.push({ pathname: '/video-prejoin', params: { eventId, startsAt, sessionType } });
  };

  const goCancel = () => {
    router.push({
      pathname: '/(tabs)/(home)/cancel',
      params: { token, startsAt, sessionType },
    });
  };

  const goReschedule = () => {
    router.push({
      pathname: '/(tabs)/(home)/reschedule',
      params: { token, startsAt, sessionType },
    });
  };

  const addToCalendar = () => {
    router.push({
      pathname: '/add-to-calendar',
      params: { startIso: startsAt, endIso: endsAt, sessionType, joinToken },
    });
  };

  return (
    <View style={styles.screen}>
      {/* Ambient emerald top glow */}
      <LinearGradient
        colors={['rgba(78, 222, 163, 0.15)', 'rgba(19, 19, 21, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      {/* App bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing[1] }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={goBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Detalle de reserva</Text>
        {/* spacer to visually center the title */}
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ──────────────────────────────────────────────────────── */}
        <View style={[styles.heroCard, heroEmphasis && styles.heroCardEmphasis]}>
          {/* Top row: status pill (left) + imminent chip (right) */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroPill}>
              <MaterialCommunityIcons name="check-circle-outline" size={13} color={Colors.primary} />
              <Text style={styles.heroPillText}>Confirmada</Text>
            </View>
            {status !== 'upcoming' && (
              <View style={styles.imminentChip}>
                <Animated.View style={[styles.imminentDot, { opacity: dotOpacity }]} />
                <Text style={styles.imminentText}>
                  {status === 'active' ? 'Sala activa' : `Empieza en ${minutesUntil(startsAt)} min`}
                </Text>
              </View>
            )}
          </View>

          {/* Overline */}
          <Text style={styles.heroOverline}>TU PRÓXIMA CLASE</Text>

          {/* Time row — start and end on the same line, mixed sizes */}
          {startsAt ? (
            <>
              <View style={styles.heroTimeRow}>
                <Text style={styles.heroTime}>
                  {classLabel(startsAt)} · {formatTime(startsAt)}
                </Text>
                <Text style={styles.heroTimeEnd}> – {formatTime(endsAt)}</Text>
              </View>
              <Text style={styles.heroMeta}>
                {duration === '1h' ? '1 hora' : '2 horas'} · con Gustavo
                {status === 'active' ? ' · Sala lista' : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.heroTime}>—</Text>
          )}
        </View>

        {/* ── Details card ───────────────────────────────────────────────────── */}
        <View style={styles.detailsCard}>
          {/* Fecha */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>Fecha</Text>
              <Text style={styles.detailValue}>
                {startsAt ? formatDate(startsAt) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Horario */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>Horario</Text>
              <Text style={styles.detailValue}>
                {startsAt ? formatTimeRange(startsAt, endsAt, duration) : '—'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Pago */}
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <MaterialCommunityIcons
                name={isPack ? 'credit-card-outline' : 'cash-multiple'}
                size={18}
                color={Colors.primary}
              />
            </View>
            <View style={[styles.detailBody, styles.detailBodyRow]}>
              <View style={styles.detailBodyText}>
                <Text style={styles.detailLabel}>Pago</Text>
                <Text style={styles.detailValue}>{payLabel(sessionType, packSize)}</Text>
              </View>
              <View style={[styles.payPill, isPack && styles.payPillPack]}>
                <Text style={[styles.payPillText, isPack && styles.payPillTextPack]}>
                  {isPack ? 'Crédito' : 'Pago único'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Cancel policy banner ───────────────────────────────────────────── */}
        <View style={styles.policyBanner}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={Colors.textDim} />
          <Text style={styles.policyText}>
            Cancela o reprograma gratis hasta 2 h antes
          </Text>
        </View>
      </ScrollView>

      {/* ── Sticky action bar ──────────────────────────────────────────────────── */}
      <View style={styles.stickyBar}>
        {/* JOIN button */}
        <TouchableOpacity
          style={[styles.joinBtn, isJoinable ? styles.joinBtnActive : styles.joinBtnIdle]}
          onPress={isJoinable ? goJoin : undefined}
          disabled={!isJoinable}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Unirse a la clase"
        >
          <MaterialCommunityIcons
            name="video"
            size={19}
            color={isJoinable ? Colors.onPrimary : Colors.textDim}
          />
          <Text style={[styles.joinBtnText, !isJoinable && styles.joinBtnTextIdle]}>
            Unirse a la clase
          </Text>
        </TouchableOpacity>

        {!isJoinable && (
          <Text style={styles.joinHint}>Disponible 15 min antes</Text>
        )}

        {/* Secondary row */}
        <View style={styles.secondaryRow}>
          {/* Calendario */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={addToCalendar}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-plus" size={17} color={Colors.textMuted} />
            <Text style={styles.secondaryBtnText}>Calendario</Text>
          </TouchableOpacity>

          {/* Reprogramar */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={goReschedule}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar-refresh-outline" size={17} color={Colors.textMuted} />
            <Text style={styles.secondaryBtnText}>Reprogramar</Text>
          </TouchableOpacity>

          {/* Cancelar */}
          <TouchableOpacity
            style={[styles.secondaryBtn, styles.cancelBtn]}
            onPress={goCancel}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close-circle-outline" size={17} color={Colors.error} />
            <Text style={[styles.secondaryBtnText, styles.cancelBtnText]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    height: 260,
  },

  // App bar
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingBottom: Spacing[2],
    zIndex: 1,
  },
  backBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
    textAlign: 'center',
    ...TypeScale.label,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    gap: Spacing[3],
  },

  // Hero card
  heroCard: {
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.20)',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[4],
    gap: Spacing[2],
    boxShadow: '0px 0px 20px rgba(78, 222, 163, 0.07)',
  } as any,
  heroCardEmphasis: {
    borderColor: 'rgba(78, 222, 163, 0.38)',
    boxShadow: '0px 0px 28px rgba(78, 222, 163, 0.16)',
  } as any,
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
  },
  heroPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  imminentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  imminentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  imminentText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  heroOverline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: Spacing[1],
  },
  heroTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroTime: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 33,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  heroTimeEnd: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Details card
  detailsCard: {
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[1],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3] + 2,
  },
  detailIconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  detailBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  detailBodyText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Payment pill
  payPill: {
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: Spacing[2] + 2,
    paddingVertical: 4,
  },
  payPillPack: {
    backgroundColor: Colors.primaryDim,
    borderColor: 'rgba(78, 222, 163, 0.22)',
  },
  payPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  payPillTextPack: {
    color: Colors.primary,
  },

  // Cancel policy banner
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  policyText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Sticky bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19, 19, 21, 0.96)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: Spacing[3],
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[2],
  },

  // Join button
  joinBtn: {
    height: 52,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  joinBtnActive: {
    backgroundColor: Colors.primary,
    boxShadow: '0px 0px 26px rgba(78, 222, 163, 0.38)',
  } as any,
  joinBtnIdle: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  joinBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  joinBtnTextIdle: {
    color: Colors.textDim,
  },
  joinHint: {
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '400',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: -Spacing[1],
  },

  // Secondary row
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  secondaryBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  secondaryBtnText: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  cancelBtn: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
  },
  cancelBtnText: {
    color: Colors.error,
  },
});
