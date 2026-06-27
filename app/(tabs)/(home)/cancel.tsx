import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/lib/api-client';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { PostCancelResponse } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function endIsoFromSessionType(startIso: string, sessionType: string): string {
  const t = Date.parse(startIso);
  if (isNaN(t)) return startIso;
  const ms =
    sessionType === 'session2h' ? 7_200_000
    : sessionType === 'free15min' ? 900_000
    : 3_600_000;
  return new Date(t + ms).toISOString();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day} ${month}`;
}

function fmt2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimeHHMM(iso: string): string {
  const d = new Date(iso);
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}

function sessionDurationLabel(sessionType: string): string {
  if (sessionType === 'session2h') return '2 horas';
  if (sessionType === 'free15min') return '15 min';
  return '1 hora';
}

function formatTimeRange(startIso: string, sessionType: string): string {
  const endIso = endIsoFromSessionType(startIso, sessionType);
  return `${formatTimeHHMM(startIso)}–${formatTimeHHMM(endIso)} · ${sessionDurationLabel(sessionType)}`;
}

function formatTimeRemaining(startsAt: string): string {
  const delta = new Date(startsAt).getTime() - Date.now();
  if (delta <= 0) return 'Tu clase ha comenzado.';
  const totalMins = Math.ceil(delta / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h >= 1) return `Tu clase empieza en ${h} h ${fmt2(m)} min.`;
  return `Tu clase empieza en ${totalMins} min.`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'confirm'
  | 'blocked'
  | 'submitting'
  | 'success'
  | 'err_generic'
  | 'err_invalid_token'
  | 'err_outside_window';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CancelScreen() {
  const insets = useSafeAreaInsets();
  const { token, startsAt, sessionType } = useLocalSearchParams<{
    token: string;
    startsAt: string;
    sessionType: string;
  }>();

  const safeStartsAt = startsAt ?? '';
  const safeToken = token ?? '';
  const safeSessionType = sessionType ?? 'session1h';

  // Synchronous 2h window check — no useEffect needed, initialises state once
  const isBlocked = new Date(safeStartsAt).getTime() - 2 * 60 * 60 * 1000 <= Date.now();

  const [phase, setPhase] = useState<Phase>(isBlocked ? 'blocked' : 'confirm');
  const [cancelResult, setCancelResult] = useState<PostCancelResponse | null>(null);
  const submittingRef = useRef(false);

  const isPack = safeSessionType === 'pack';

  async function handleCancel() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase('submitting');
    try {
      const res = await api.postCancel({ token: safeToken });
      setCancelResult(res);
      setPhase('success');
      // submittingRef stays true — success screen has no retry path
    } catch (err) {
      submittingRef.current = false;
      if (err instanceof ApiError) {
        if (err.code === 'OUTSIDE_CANCEL_WINDOW') {
          setPhase('err_outside_window');
        } else if (
          err.code === 'INVALID_CANCEL_TOKEN' ||
          err.code === 'CANCEL_TOKEN_CONSUMED'
        ) {
          setPhase('err_invalid_token');
        } else {
          // Covers 403 (CSRF infra blip), 500, network errors — all retryable
          setPhase('err_generic');
        }
      } else {
        setPhase('err_generic');
      }
    }
  }

  // ── SUCCESS — full-screen ─────────────────────────────────────────────────

  if (phase === 'success') {
    const creditsRestored = cancelResult?.creditsRestored ?? isPack;
    const footerPB = Math.max(insets.bottom, Spacing[4]);

    return (
      <View style={styles.root}>
        {/* Close button */}
        <View style={[styles.closeRow, { paddingTop: Math.max(insets.top, Spacing[2]) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.replace('/(tabs)/(home)')}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={22} color={Colors.textDim} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.successScroll, { paddingBottom: 160 + footerPB }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.heroCircle}>
              <MaterialCommunityIcons name="check" size={40} color={Colors.primary} />
            </View>
            <View style={styles.pillTag}>
              <Text style={styles.pillTagText}>RESERVA CANCELADA</Text>
            </View>
            <Text style={styles.heroTitle}>Clase cancelada</Text>
          </View>

          {creditsRestored ? (
            /* Pack — credit restored */
            <View style={[styles.successCard, styles.successCardGreen]}>
              <View style={styles.successCardRow}>
                <View style={[styles.successIconBox, styles.successIconBoxGreen]}>
                  <MaterialCommunityIcons name="database-outline" size={23} color={Colors.primary} />
                </View>
                <View style={styles.successCardText}>
                  <Text style={styles.successCardTitle}>1 crédito devuelto</Text>
                  <Text style={styles.successCardBody}>Ya disponible en tu Pack Esencial</Text>
                </View>
              </View>
            </View>
          ) : (
            /* Paid — refund in progress */
            <View style={[styles.successCard, styles.successCardYellow]}>
              <View style={[styles.successCardRow, { marginBottom: Spacing[3] }]}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={20}
                  color={Colors.warning}
                  style={{ marginTop: 1, flexShrink: 0 }}
                />
                <View style={styles.successCardText}>
                  <Text style={styles.successCardTitle}>Reembolso en proceso</Text>
                  <Text style={styles.successCardBody}>
                    Recibirás tu reembolso en 1–3 días hábiles (menos la comisión de Stripe).
                  </Text>
                </View>
              </View>
              <View style={styles.emailRow}>
                <MaterialCommunityIcons name="email-outline" size={17} color={Colors.textDim} />
                <Text style={styles.emailNote}>
                  Recibirás un email de confirmación con los detalles.
                </Text>
              </View>
            </View>
          )}

          {/* Cancelled booking summary */}
          <View style={styles.cancelledRow}>
            <View style={styles.cancelledIconWrap}>
              <MaterialCommunityIcons name="calendar-remove-outline" size={20} color={Colors.textDim} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cancelledDate, styles.strikethrough]}>
                {formatDate(safeStartsAt)} · {formatTimeHHMM(safeStartsAt)}
              </Text>
              <Text style={styles.cancelledSub}>Cancelada</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
          {creditsRestored ? (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/(booking)/session-type')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="calendar-plus" size={18} color={Colors.onPrimary} />
                <Text style={styles.primaryBtnText}>Reservar otra clase</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => router.replace('/(tabs)/(home)')}
                activeOpacity={0.7}
              >
                <Text style={styles.ghostBtnText}>Volver a Inicio</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/(home)')}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="home-outline" size={18} color={Colors.onPrimary} />
                <Text style={styles.primaryBtnText}>Volver a Inicio</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => router.replace('/(tabs)/(booking)/session-type')}
                activeOpacity={0.7}
              >
                <Text style={styles.ghostBtnText}>Reservar otra clase</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }

  // ── BOTTOM SHEET states ───────────────────────────────────────────────────

  const submitting = phase === 'submitting';
  const sheetPB = Math.max(insets.bottom, Spacing[4]);

  return (
    <View style={[styles.root, styles.rootSheet]}>
      <View style={[styles.sheet, { paddingBottom: sheetPB }]}>
        <View style={styles.handle} />

        {/* ── CONFIRM / SUBMITTING ───────────────────────────────────────── */}
        {(phase === 'confirm' || phase === 'submitting') && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>¿Cancelar esta clase?</Text>
                <Text style={styles.sheetSubtitle}>Esta acción no se puede deshacer.</Text>
              </View>
            </View>

            {/* Mini booking row */}
            <View style={styles.miniBookingCard}>
              <View style={styles.miniBookingIconWrap}>
                <MaterialCommunityIcons name="calendar-outline" size={20} color={Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.miniBookingDate}>{formatDate(safeStartsAt)}</Text>
                <Text style={styles.miniBookingSub}>
                  {formatTimeRange(safeStartsAt, safeSessionType)}
                </Text>
              </View>
              {isPack ? (
                <View style={styles.badgeGreen}>
                  <Text style={styles.badgeGreenText}>CRÉDITO</Text>
                </View>
              ) : (
                <View style={styles.badgeGray}>
                  <Text style={styles.badgeGrayText}>PAGADA</Text>
                </View>
              )}
            </View>

            {/* 2h rule */}
            <View style={styles.ruleRow}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={Colors.primary} />
              <Text style={styles.ruleText}>
                Cancelación gratuita: faltan más de{' '}
                <Text style={styles.ruleBold}>2 h</Text> para el inicio.
              </Text>
            </View>

            {/* Consequence card */}
            {isPack ? (
              <View style={[styles.consequenceCard, styles.consequenceGreen]}>
                <MaterialCommunityIcons
                  name="database-outline"
                  size={19}
                  color={Colors.primary}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consequenceTitle}>
                    Se devuelve 1 crédito a tu Pack Esencial
                  </Text>
                  <Text style={styles.consequenceBody}>Automático e inmediato.</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.consequenceCard, styles.consequenceYellow]}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={19}
                  color={Colors.warning}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.consequenceTitle}>
                    El reembolso lo gestiona Gustavo a mano
                  </Text>
                  <Text style={styles.consequenceBody}>
                    Recibirás tu reembolso en 1–3 días hábiles (menos la comisión de Stripe).
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.dangerBtn, submitting && styles.dangerBtnDisabled]}
              onPress={handleCancel}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#3a0a06" />
              ) : (
                <>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color="#3a0a06" />
                  <Text style={styles.dangerBtnText}>Sí, cancelar la clase</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, submitting && styles.ghostBtnDisabled]}
              onPress={() => router.back()}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>Mantener clase</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── BLOCKED / ERR_OUTSIDE_WINDOW ──────────────────────────────── */}
        {(phase === 'blocked' || phase === 'err_outside_window') && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconWarning]}>
                <MaterialCommunityIcons name="clock-alert-outline" size={22} color={Colors.warning} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>Ya no puedes cancelar online</Text>
                <Text style={styles.sheetSubtitle}>
                  {phase === 'err_outside_window'
                    ? 'Tu clase empieza en menos de 2 h.'
                    : formatTimeRemaining(safeStartsAt)}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, styles.infoCardDark]}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={Colors.textDim}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>Por respeto al tiempo reservado</Text>
                <Text style={styles.infoCardBody}>
                  Con menos de 2 h de antelación no podemos ofrecer cancelación gratuita online.
                </Text>
              </View>
            </View>

            <View style={[styles.infoCard, styles.infoCardGreen]}>
              <MaterialCommunityIcons
                name="chat-outline"
                size={18}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>¿No puedes asistir?</Text>
                <Text style={styles.infoCardBody}>
                  Avísale a Gustavo directamente y buscad una solución.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.tealOutlineBtn}
              onPress={() =>
                Alert.alert(
                  'Próximamente',
                  'El chat con Gustavo estará disponible próximamente.',
                )
              }
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="chat-processing-outline" size={18} color={Colors.primary} />
              <Text style={styles.tealOutlineBtnText}>Avisar a Gustavo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.ghostBtnText}>Volver al detalle</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ERR_GENERIC ───────────────────────────────────────────────── */}
        {phase === 'err_generic' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="close-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>No hemos podido cancelar</Text>
                <Text style={styles.sheetSubtitle}>Algo ha fallado. Tu reserva sigue activa.</Text>
              </View>
            </View>

            <View style={[styles.infoCard, styles.infoCardDark]}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color={Colors.primary}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoCardTitle}>Tu reserva sigue activa</Text>
                <Text style={styles.infoCardBody}>
                  No se ha realizado ningún cambio en tu reserva.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={handleCancel}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>Reintentar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>Volver al detalle</Text>
            </TouchableOpacity>
            <View style={styles.contactRow}>
              <Text style={styles.contactMuted}>¿Sigue fallando?</Text>
              <TouchableOpacity
                onPress={() =>
                  Alert.alert('Contacto', 'Escríbele a Gustavo por los medios habituales.')
                }
                activeOpacity={0.7}
              >
                <Text style={styles.contactLink}>Escribir a Gustavo</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── ERR_INVALID_TOKEN ─────────────────────────────────────────── */}
        {phase === 'err_invalid_token' && (
          <>
            <View style={styles.sheetHeaderRow}>
              <View style={[styles.headerIconCircle, styles.headerIconError]}>
                <MaterialCommunityIcons name="close-circle-outline" size={23} color={Colors.error} />
              </View>
              <View style={{ flex: 1, paddingTop: 1 }}>
                <Text style={styles.sheetTitle}>
                  Esta reserva ya no existe o ya fue cancelada
                </Text>
                <Text style={styles.sheetSubtitle}>
                  Es posible que ya se hubiera cancelado anteriormente.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: Spacing[2] }]}
              onPress={() => router.replace('/(tabs)/(home)')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Volver a Inicio</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Root ───────────────────────────────────────────────────────────────
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  rootSheet: {
    justifyContent: 'flex-end',
  },

  // ── Bottom sheet ────────────────────────────────────────────────────────
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

  // ── Sheet header row ────────────────────────────────────────────────────
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  headerIconCircle: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIconError: {
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  headerIconWarning: {
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  sheetTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  // ── Mini booking row (confirm) ──────────────────────────────────────────
  miniBookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  miniBookingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniBookingDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  miniBookingSub: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  badgeGreen: {
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeGreenText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    letterSpacing: 0.4,
    lineHeight: 12,
    color: Colors.primary,
  },
  badgeGray: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  badgeGrayText: {
    fontSize: 9.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    letterSpacing: 0.4,
    lineHeight: 12,
    color: Colors.textMuted,
  },

  // ── 2h rule line ────────────────────────────────────────────────────────
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[3],
  },
  ruleText: {
    flex: 1,
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  ruleBold: {
    color: Colors.text,
    fontWeight: '600',
  },

  // ── Consequence card (confirm) ──────────────────────────────────────────
  consequenceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[4],
  },
  consequenceGreen: {
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  consequenceYellow: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.26)',
  },
  consequenceTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  consequenceBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },

  // ── Info cards (blocked / error) ────────────────────────────────────────
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  infoCardDark: {
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.border,
  },
  infoCardGreen: {
    backgroundColor: 'rgba(78,222,163,0.06)',
    borderColor: 'rgba(78,222,163,0.22)',
  },
  infoCardTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  infoCardBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    lineHeight: 18,
  },

  // ── Buttons ─────────────────────────────────────────────────────────────
  dangerBtn: {
    height: 52,
    backgroundColor: Colors.error,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
    marginBottom: Spacing[2],
  },
  dangerBtnDisabled: {
    opacity: 0.6,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: '#3a0a06',
    lineHeight: 20,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[2],
    boxShadow: '0 0 26px rgba(78,222,163,0.35)',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
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
  ghostBtnDisabled: {
    opacity: 0.4,
  },
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  tealOutlineBtn: {
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
  tealOutlineBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
    lineHeight: 20,
  },

  // ── Contact row (err_generic) ────────────────────────────────────────────
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[2],
  },
  contactMuted: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  contactLink: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Success (full-screen) ────────────────────────────────────────────────
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing[2],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successScroll: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
  },
  heroBlock: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[4],
  },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 30px rgba(78,222,163,0.25)',
  },
  pillTag: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 6,
  },
  pillTagText: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FontFamily.headline,
    letterSpacing: -0.48,
    lineHeight: 28,
    color: Colors.text,
  },
  successCard: {
    borderRadius: Radius['3xl'],
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[3],
  },
  successCardGreen: {
    backgroundColor: 'rgba(78,222,163,0.07)',
    borderColor: 'rgba(78,222,163,0.26)',
  },
  successCardYellow: {
    backgroundColor: 'rgba(251,191,36,0.07)',
    borderColor: 'rgba(251,191,36,0.24)',
  },
  successCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  successIconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successIconBoxGreen: {
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78,222,163,0.26)',
  },
  successCardText: {
    flex: 1,
  },
  successCardTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  successCardBody: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.18)',
    paddingTop: Spacing[3],
  },
  emailNote: {
    flex: 1,
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  cancelledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: 14,
    marginBottom: Spacing[3],
  },
  cancelledIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cancelledDate: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textDim,
    marginBottom: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  cancelledSub: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(19,19,21,0.94)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    gap: Spacing[2],
  },
});
