import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ZoomView, useZoom } from '@zoom/react-native-videosdk';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useLocale } from '@/lib/i18n/locale-context';

// ── Types ─────────────────────────────────────────────────────────────────────

// Permission-driven phases. "Entering" (token fetch) and its error are booleans
// layered on top of `ready` so the live preview stays mounted underneath.
type Phase = 'checking' | 'requesting' | 'denied' | 'ready';
type ErrorKind = 'auth' | 'generic';

// ── Helpers ───────────────────────────────────────────────────────────────────

function durationHours(sessionType: string): number {
  if (sessionType === 'session2h') return 2;
  if (sessionType === 'free15min') return 0.25;
  return 1; // session1h + pack
}

function timeStr(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale === 'es' ? 'es-ES' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return parts
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function VideoPrejoinScreen() {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();
  const { session } = useAuth();
  const zoom = useZoom();

  const params = useLocalSearchParams<{
    eventId?: string;
    startsAt?: string;
    sessionType?: string;
  }>();
  const eventId = params.eventId ?? '';
  const startsAt = params.startsAt ?? '';
  const sessionType = params.sessionType ?? 'session1h';

  const displayName = session?.user?.name ?? '';
  const firstName = displayName.split(/\s+/)[0] ?? '';
  const initials = initialsOf(displayName);

  const [phase, setPhase] = useState<Phase>('checking');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [entering, setEntering] = useState(false);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const enteringRef = useRef(false);

  // ── Permissions (Android). iOS is deferred (see CLAUDE.md); the ZoomView
  // preview surfaces the native iOS prompt on first camera access. ──────────────
  useEffect(() => {
    let active = true;
    (async () => {
      if (Platform.OS !== 'android') {
        if (active) setPhase('ready'); // TODO(ios): explicit camera/mic request
        return;
      }
      const cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (!active) return;
      setPhase(cam && mic ? 'ready' : 'requesting');
    })();
    return () => {
      active = false;
    };
  }, []);

  async function requestAccess() {
    if (Platform.OS !== 'android') {
      setPhase('ready');
      return;
    }
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    const cam = res[PermissionsAndroid.PERMISSIONS.CAMERA];
    const mic = res[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    const { GRANTED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
    if (cam === GRANTED && mic === GRANTED) {
      setPhase('ready');
    } else if (cam === NEVER_ASK_AGAIN || mic === NEVER_ASK_AGAIN) {
      setPhase('denied');
    } else {
      // Plain "deny" (not permanent) — keep the request screen so they can retry.
      setPhase('requesting');
    }
  }

  async function recheckAccess() {
    if (Platform.OS !== 'android') {
      setPhase('ready');
      return;
    }
    const cam = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    const mic = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    setPhase(cam && mic ? 'ready' : 'denied');
  }

  // Correct the preview orientation. The native view manager's refreshRotation()
  // bails out when !isInSession() (RNZoomViewManager.java), so during a device-only
  // preview the camera renders in raw sensor orientation (sideways). We re-apply the
  // display rotation ourselves. The app is portrait-locked (app.json), so the display
  // rotation is always Surface.ROTATION_0 (0) — matching what refreshRotation() would
  // pass in-session. A short delay lets the preview canvas start first.
  function correctPreviewRotation() {
    if (Platform.OS !== 'android') return;
    zoom.videoHelper.rotateMyVideo(0).catch(() => {});
  }

  useEffect(() => {
    if (phase !== 'ready' || !cameraOn) return;
    const id = setTimeout(correctPreviewRotation, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cameraOn]);

  function flipCamera() {
    // Best-effort: switchCamera may only take effect once in a session; harmless
    // before join. Never let a rejection crash the preview. Re-apply the rotation
    // afterwards since switching cameras resets it.
    zoom.videoHelper
      .switchCamera()
      .then(() => setTimeout(correctPreviewRotation, 250))
      .catch(() => {});
  }

  // ── Enter: exchange eventId → Zoom token, then hand off to S15 (which joins).
  async function onEnter() {
    if (enteringRef.current || !eventId) return;
    enteringRef.current = true;
    setEntering(true);
    setErrorKind(null);
    try {
      const res = await api.postZoomToken({ eventId });
      // Navigate to S15 with everything it needs to joinSession(). The display
      // name comes from the auth session (the token endpoint doesn't return it),
      // and the camera/mic intent chosen here is forwarded as join options.
      router.push({
        pathname: '/video-room',
        params: {
          eventId,
          token: res.token,
          sessionName: res.sessionName,
          passcode: res.passcode,
          userName: displayName,
          startIso: res.startIso,
          durationWithGrace: String(res.durationWithGrace),
          expiresAt: String(res.expiresAt),
          startMuted: micOn ? '0' : '1',
          startVideoOff: cameraOn ? '0' : '1',
        },
      });
    } catch (e) {
      const isAuth = e instanceof ApiError && (e.status === 401 || e.requiresAuth === true);
      setErrorKind(isAuth ? 'auth' : 'generic');
    } finally {
      enteringRef.current = false;
      setEntering(false);
    }
  }

  // ── Derived header bits ──────────────────────────────────────────────────────
  let subtitle: string | null = null;
  let chip: { text: string } | null = null;
  if (startsAt) {
    const start = new Date(startsAt);
    const end = new Date(start.getTime() + durationHours(sessionType) * 3600_000);
    const sameDay = start.toDateString() === new Date().toDateString();
    const dayLabel = sameDay
      ? t('prejoin.today')
      : start.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { weekday: 'short' });
    subtitle = `${dayLabel} · ${timeStr(start, locale)} – ${timeStr(end, locale)}`;

    const mins = Math.round((start.getTime() - Date.now()) / 60_000);
    chip =
      mins <= 0
        ? { text: t('prejoin.chipLive') }
        : { text: `${t('prejoin.chipInPrefix')} ${mins} ${t('prejoin.chipMinSuffix')}` };
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const glowColor =
    phase === 'denied' ? 'rgba(255, 180, 171, 0.12)' : 'rgba(78, 222, 163, 0.14)';

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[glowColor, 'rgba(19, 19, 21, 0)']}
        style={styles.topGlow}
        pointerEvents="none"
      />

      {/* App bar */}
      <View style={[styles.appBar, { paddingTop: insets.top + Spacing[1] }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {t('prejoin.appBarTitle')}
          </Text>
          {subtitle && (
            <Text style={styles.appBarSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {phase === 'ready' && chip ? (
          <View style={styles.timeChip}>
            <View style={styles.timeChipDot} />
            <Text style={styles.timeChipText}>{chip.text}</Text>
          </View>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {/* ── Phase body ──────────────────────────────────────────────────────── */}

      {phase === 'checking' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingLabel}>{t('prejoin.checking')}</Text>
        </View>
      )}

      {phase === 'requesting' && (
        <>
          <View style={styles.body}>
            <View style={styles.previewLocked}>
              <View style={styles.lockIconCircle}>
                <MaterialCommunityIcons name="video-outline" size={34} color={Colors.primary} />
              </View>
              <Text style={styles.previewLockedText}>{t('prejoin.previewWaiting')}</Text>
            </View>
            <View style={styles.rationale}>
              <Text style={styles.rationaleTitle}>{t('prejoin.requestTitle')}</Text>
              <Text style={styles.rationaleDesc}>{t('prejoin.requestDesc')}</Text>
            </View>
          </View>

          <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestAccess} activeOpacity={0.85}>
              <MaterialCommunityIcons name="microphone" size={18} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>{t('prejoin.requestBtn')}</Text>
            </TouchableOpacity>
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textDim} />
              <Text style={styles.hintText}>{t('prejoin.requestHint')}</Text>
            </View>
          </View>
        </>
      )}

      {phase === 'denied' && (
        <>
          <View style={styles.body}>
            <View style={[styles.previewLocked, styles.previewBlocked]}>
              <View style={[styles.lockIconCircle, styles.blockedIconCircle]}>
                <MaterialCommunityIcons name="video-off-outline" size={30} color={Colors.error} />
              </View>
              <Text style={[styles.previewLockedText, styles.blockedText]}>
                {t('prejoin.deniedPreview')}
              </Text>
            </View>

            <View style={styles.rationale}>
              <Text style={styles.rationaleTitle}>{t('prejoin.deniedTitle')}</Text>
              <Text style={styles.rationaleDesc}>{t('prejoin.deniedDesc')}</Text>
            </View>

            <View style={styles.stepsCard}>
              {[t('prejoin.deniedStep1'), t('prejoin.deniedStep2'), t('prejoin.deniedStep3')].map(
                (step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ),
              )}
            </View>
          </View>

          <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="cog-outline" size={18} color={Colors.onPrimary} />
              <Text style={styles.primaryBtnText}>{t('prejoin.openSettings')}</Text>
            </TouchableOpacity>
            <Pressable style={styles.textBtn} onPress={recheckAccess}>
              <Text style={styles.textBtnText}>{t('prejoin.retryEnabled')}</Text>
            </Pressable>
          </View>
        </>
      )}

      {phase === 'ready' && (
        <>
          <View style={styles.body}>
            {/* Live self-view */}
            <View style={styles.preview}>
              {cameraOn ? (
                // userId MUST be "" (not null) for the device-only preview: the
                // native setUserId() calls newUserId.equals(userId) and NPEs on a
                // null (RNZoomViewManager.java) — "" matches the native default and
                // `preview` renders the local camera via startVideoCanvasPreview.
                <ZoomView userId="" preview style={StyleSheet.absoluteFill} />
              ) : (
                <View style={styles.previewAvatarWrap}>
                  <View style={styles.previewAvatar}>
                    <Text style={styles.previewAvatarText}>{initials}</Text>
                  </View>
                  <Text style={styles.cameraOffLabel}>{t('prejoin.cameraOffLabel')}</Text>
                </View>
              )}

              {/* Top row: identity + camera flip */}
              <View style={styles.previewTopRow} pointerEvents="box-none">
                <View style={styles.selfBadge}>
                  <View style={styles.selfBadgeDot} />
                  <Text style={styles.selfBadgeText} numberOfLines={1}>
                    {t('prejoin.you')}
                    {firstName ? ` · ${firstName}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.flipBtn}
                  onPress={flipCamera}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar de cámara"
                >
                  <MaterialCommunityIcons name="camera-flip" size={18} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Bottom control bar */}
              <LinearGradient
                colors={['transparent', 'rgba(0, 0, 0, 0.55)']}
                style={styles.controlBar}
              >
                <TouchableOpacity
                  style={[styles.controlBtn, !cameraOn && styles.controlBtnOff]}
                  onPress={() => setCameraOn((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Cámara"
                >
                  <MaterialCommunityIcons
                    name={cameraOn ? 'video' : 'video-off'}
                    size={22}
                    color={cameraOn ? Colors.text : Colors.error}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.controlBtn, !micOn && styles.controlBtnOff]}
                  onPress={() => setMicOn((v) => !v)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Micrófono"
                >
                  <MaterialCommunityIcons
                    name={micOn ? 'microphone' : 'microphone-off'}
                    size={22}
                    color={micOn ? Colors.text : Colors.error}
                  />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>

          <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
            {errorKind && (
              <View style={styles.errorBanner}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.errorBannerText}>
                  {errorKind === 'auth' ? t('prejoin.errorAuth') : t('prejoin.errorDesc')}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, entering && styles.primaryBtnBusy]}
              onPress={onEnter}
              activeOpacity={0.85}
              disabled={entering}
            >
              {entering ? (
                <>
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>{t('prejoin.joining')}</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="video" size={18} color={Colors.onPrimary} />
                  <Text style={styles.primaryBtnText}>{t('prejoin.enter')}</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.hintRow}>
              <MaterialCommunityIcons name="shield-lock-outline" size={13} color={Colors.textDim} />
              <Text style={styles.hintText}>{t('prejoin.secure')}</Text>
            </View>
          </View>
        </>
      )}
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
    height: 220,
  },

  // App bar
  appBar: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[2],
    paddingBottom: Spacing[1],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: {
    flex: 1,
    minWidth: 0,
  },
  appBarTitle: {
    ...TypeScale.h4,
    fontSize: 15,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  appBarSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 2,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 6,
  },
  timeChipDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },

  // Loading
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
  },
  loadingLabel: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Body (all non-loading phases)
  body: {
    flex: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[1],
    gap: Spacing[4],
  },

  // Locked / blocked preview placeholder (requesting + denied)
  previewLocked: {
    flex: 1,
    minHeight: 220,
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  previewBlocked: {
    borderColor: Colors.errorBorder,
  },
  lockIconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 30px rgba(78, 222, 163, 0.20)',
  } as any,
  blockedIconCircle: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
    boxShadow: 'none',
  } as any,
  previewLockedText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: Spacing[4],
    textAlign: 'center',
  },
  blockedText: {
    color: Colors.error,
  },

  // Rationale / explanation copy
  rationale: {
    gap: Spacing[2],
  },
  rationaleTitle: {
    ...TypeScale.h3,
    fontSize: 19,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  rationaleDesc: {
    fontSize: 13.5,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Denied steps card
  stepsCard: {
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: Spacing[4],
    gap: Spacing[3],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Ready preview
  preview: {
    flex: 1,
    minHeight: 260,
    borderRadius: Radius['3xl'],
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLowest,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.22)',
    justifyContent: 'flex-end',
  },
  previewAvatarWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
  },
  previewAvatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: '#26332e',
    borderWidth: 2,
    borderColor: 'rgba(78, 222, 163, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 36px rgba(78, 222, 163, 0.28)',
  } as any,
  previewAvatarText: {
    fontSize: 30,
    fontWeight: '800',
    fontFamily: FontFamily.headline,
    color: Colors.secondary,
  },
  cameraOffLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  previewTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing[3],
  },
  selfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '70%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 6,
  },
  selfBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  selfBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  flipBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
    paddingTop: Spacing[5],
    paddingBottom: Spacing[4],
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(40, 40, 44, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnOff: {
    borderColor: Colors.errorBorder,
    backgroundColor: 'rgba(255, 180, 171, 0.14)',
  },

  // Sticky action bar
  stickyBar: {
    backgroundColor: 'rgba(19, 19, 21, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  primaryBtn: {
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    boxShadow: '0px 0px 26px rgba(78, 222, 163, 0.35)',
  } as any,
  primaryBtnBusy: {
    opacity: 0.85,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  textBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBtnText: {
    fontSize: 13.5,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  hintText: {
    fontSize: 11.5,
    fontWeight: '400',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.xl,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2] + 2,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 17,
    fontFamily: FontFamily.body,
    color: Colors.error,
  },
});
