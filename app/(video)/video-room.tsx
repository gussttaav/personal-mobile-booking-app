import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { EventType, VideoAspect, ZoomView, useZoom } from '@zoom/react-native-videosdk';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { EmitterSubscription } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';

// ── Types ─────────────────────────────────────────────────────────────────────
// S15 joins a FRESH Zoom session on mount (S14 only previewed the device camera,
// it never joined). Since this is a 1:1 tutoring session, ANY remote participant
// is the tutor — so waiting↔inClass is driven purely by the remote-user count.
type Phase = 'connecting' | 'waiting' | 'inClass' | 'error';

const LEAVE_RED = '#e5544a';

// Mapped user shape carried by the native events (RNZoomVideoSdkModule.java).
type ZUser = { userId: string; userName?: string };

export default function VideoRoomScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const zoom = useZoom();

  const params = useLocalSearchParams<{
    token?: string;
    sessionName?: string;
    passcode?: string;
    userName?: string;
    startIso?: string;
    durationWithGrace?: string;
    expiresAt?: string;
    startMuted?: string;
    startVideoOff?: string;
    eventId?: string;
  }>();

  const token = params.token ?? '';
  const sessionName = params.sessionName ?? '';
  const passcode = params.passcode ?? '';
  const userName = params.userName ?? '';
  const durationWithGrace = params.durationWithGrace ?? '';
  const eventId = params.eventId ?? '';
  const startMuted = params.startMuted === '1';
  const startVideoOff = params.startVideoOff === '1';

  const [phase, setPhase] = useState<Phase>('connecting');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [tutorUserId, setTutorUserId] = useState<string | null>(null);
  const [tutorName, setTutorName] = useState('');
  const [tutorVideoOn, setTutorVideoOn] = useState(true);
  const [tutorMuted, setTutorMuted] = useState(false);
  const [micOn, setMicOn] = useState(!startMuted);
  const [cameraOn, setCameraOn] = useState(!startVideoOff);

  // Refs the (once-registered) event/AppState/back handlers read for current values.
  const myUserIdRef = useRef<string | null>(null);
  const leftRef = useRef(false); // teardown guard — leaveSession must run exactly once
  const subsRef = useRef<EmitterSubscription[]>([]);
  const cameraOnRef = useRef(cameraOn); // read by the AppState handler (registered once)

  // ── Teardown: fully release the session (camera + mic + video views). Idempotent.
  // A leaked session keeps the camera on (privacy) or fails the next join.
  async function teardown() {
    if (leftRef.current) return;
    leftRef.current = true;
    for (const s of subsRef.current) s.remove();
    subsRef.current = [];
    try {
      // NEVER call zoom.cleanup() — that tears down the root-singleton SDK.
      if (await zoom.isInSession()) zoom.leaveSession(false);
    } catch {
      // Ignore — best-effort release on the way out.
    }
  }

  // Explicit exit → release then hand off to S16 review (needs eventId).
  async function goReview() {
    await teardown();
    router.replace({ pathname: '/review', params: { eventId } });
  }

  function confirmLeave() {
    Alert.alert(t('room.leaveConfirmTitle'), t('room.leaveConfirmMessage'), [
      { text: t('room.leaveConfirmCancel'), style: 'cancel' },
      { text: t('room.leaveConfirmOk'), style: 'destructive', onPress: () => void goReview() },
    ]);
  }

  // Any remote present → the tutor is here → in class.
  function applyRemotes(remotes: ZUser[] | undefined) {
    if (remotes && remotes.length > 0) {
      setTutorUserId(remotes[0].userId);
      if (remotes[0].userName) setTutorName(remotes[0].userName);
      if (!leftRef.current) setPhase('inClass');
      void reconcileTutor();
    }
  }

  // Reconcile local mic/camera from the SDK's truth (not just optimistic state)
  // whenever a status-change event names our own user.
  async function reconcileSelf(changed: ZUser[] | undefined) {
    const mine = myUserIdRef.current;
    if (!mine || !changed?.some((u) => u.userId === mine)) return;
    try {
      const me = await zoom.session.getMySelf();
      setMicOn(!(await me.audioStatus.isMuted()));
      setCameraOn(await me.videoStatus.isOn());
    } catch {
      // Leave optimistic state as-is if the query fails.
    }
  }

  // Reconcile the tutor's camera/mic from SDK truth so we can show placeholders
  // instead of a black frame (camera off) and a live mic-muted indicator. 1:1 ⇒
  // remoteUsers[0] is the tutor.
  async function reconcileTutor() {
    try {
      const tutor = (await zoom.session.getRemoteUsers())?.[0];
      if (!tutor) return;
      setTutorVideoOn(await tutor.videoStatus.isOn());
      setTutorMuted(await tutor.audioStatus.isMuted());
    } catch {
      // Keep last-known status if the query fails.
    }
  }

  // ── Join on mount + wire the event-driven lifecycle. Single-shot ([]). ─────────
  useEffect(() => {
    const subs: EmitterSubscription[] = [];
    const add = (event: EventType, handler: (data?: any) => void) => {
      subs.push(zoom.addListener(event, handler));
    };

    add(EventType.onSessionJoin, async (data) => {
      const mySelf: ZUser | undefined = data?.mySelf;
      if (mySelf?.userId) {
        myUserIdRef.current = mySelf.userId;
        setMyUserId(mySelf.userId);
      }
      // The tutor may already be present at the moment we join.
      try {
        const remotes = (await zoom.session.getRemoteUsers()) as ZUser[];
        if (remotes && remotes.length > 0) applyRemotes(remotes);
        else if (!leftRef.current) setPhase('waiting');
      } catch {
        if (!leftRef.current) setPhase('waiting');
      }
    });

    add(EventType.onUserJoin, (data) => applyRemotes(data?.remoteUsers));

    add(EventType.onUserLeave, (data) => {
      const remotes: ZUser[] = data?.remoteUsers ?? [];
      if (remotes.length === 0) {
        // Tutor dropped / rejoining — calm waiting state, not a crash.
        setTutorUserId(null);
        setTutorVideoOn(true);
        setTutorMuted(false);
        if (!leftRef.current) setPhase('waiting');
      } else {
        applyRemotes(remotes);
      }
    });

    // Session ended (idle-timeout or the tutor ended it) → the class is over.
    add(EventType.onSessionLeave, () => void goReview());

    add(EventType.onError, (data) => {
      console.warn('[S15] Zoom onError', data?.errorType);
      if (!leftRef.current) setPhase('error');
    });

    add(EventType.onUserAudioStatusChanged, (data) => {
      void reconcileSelf(data?.changedUsers);
      void reconcileTutor();
    });
    add(EventType.onUserVideoStatusChanged, (data) => {
      void reconcileSelf(data?.changedUsers);
      void reconcileTutor();
    });

    subsRef.current = subs;

    (async () => {
      try {
        await zoom.joinSession({
          sessionName,
          token,
          userName,
          sessionPassword: passcode,
          audioOptions: {
            connect: true,
            mute: startMuted,
            // REQUIRED — native join throws without it despite the optional type.
            autoAdjustSpeakerVolume: true,
          },
          videoOptions: { localVideoOn: !startVideoOff },
          // durationWithGrace is minutes incl. grace; cap so a lone waiting student
          // isn't kicked before the tutor arrives, but never runs unbounded.
          sessionIdleTimeoutMins: Math.min(Math.ceil(Number(durationWithGrace) || 40), 240),
        });
      } catch (e) {
        console.warn('[S15] joinSession failed', e);
        if (!leftRef.current) setPhase('error');
      }
    })();

    // Cleanup is the last-resort release: any unmount not already handled by an
    // explicit path (e.g. a programmatic navigation) still leaves the session.
    return () => {
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the camera-intent ref in sync for the once-registered AppState handler.
  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);

  // ── Backgrounding + hardware back (registered once). ───────────────────────────
  // BACKGROUND: keep the session ALIVE (a brief notification check must not drop a
  // live class) but RELEASE THE CAMERA for privacy — otherwise the sensor keeps
  // capturing while the room isn't on screen. Audio stays connected, like a call.
  // Video resumes on return only if it was on. BACK GESTURE: Android hardware-back
  // runs the SAME confirm-then-leave flow as the Leave button (not a silent pop to
  // pre-join), matching the agreed UX. Explicit teardown still guarantees release.
  useEffect(() => {
    let bgVideoWasOn = false;
    const appSub = AppState.addEventListener('change', (next) => {
      if (leftRef.current) return;
      if (next === 'background') {
        bgVideoWasOn = cameraOnRef.current;
        if (cameraOnRef.current) zoom.videoHelper.stopVideo().catch(() => {});
      } else if (next === 'active' && bgVideoWasOn) {
        zoom.videoHelper.startVideo().catch(() => {});
        bgVideoWasOn = false;
      }
    });

    const backSub =
      Platform.OS === 'android'
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            if (leftRef.current) return false; // already leaving — let it through
            confirmLeave();
            return true; // block the default pop; leave happens on confirm
          })
        : null;

    return () => {
      appSub.remove();
      backSub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controls (optimistic; reconciled by the status-changed events) ─────────────
  function toggleMic() {
    const id = myUserId;
    if (!id) return;
    const next = !micOn;
    setMicOn(next);
    const p = next ? zoom.audioHelper.unmuteAudio(id) : zoom.audioHelper.muteAudio(id);
    Promise.resolve(p).catch(() => {});
  }

  function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    const p = next ? zoom.videoHelper.startVideo() : zoom.videoHelper.stopVideo();
    Promise.resolve(p).catch(() => {});
  }

  const joined = phase === 'waiting' || phase === 'inClass';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.screen}>
      {/* Full-bleed tutor video (first remote render through the New-Arch shim).
          userId is guaranteed non-null in inClass; a null userId NPE-crashes the
          native view manager, so we still guard. In-session rotation self-corrects
          (native refreshRotation runs), so no manual rotateMyVideo here. */}
      {phase === 'inClass' && tutorUserId && tutorVideoOn ? (
        <ZoomView
          key={`tutor-${tutorUserId}`}
          userId={tutorUserId}
          fullScreen
          videoAspect={VideoAspect.PanAndScan}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Tutor camera off → avatar placeholder instead of a black frame. */}
      {phase === 'inClass' && !tutorVideoOn && (
        <View style={styles.centered}>
          <View style={styles.waitAvatar}>
            <MaterialCommunityIcons name="account" size={48} color={Colors.secondary} />
          </View>
          <Text style={styles.waitTitle}>{tutorName || 'Gustavo'}</Text>
          <Text style={styles.waitHelp}>{t('room.cameraOff')}</Text>
        </View>
      )}

      {phase === 'connecting' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.connectingTitle}>{t('room.connecting')}</Text>
          <View style={styles.encryptedRow}>
            <MaterialCommunityIcons name="lock-outline" size={13} color={Colors.textDim} />
            <Text style={styles.encryptedText}>{t('room.encrypted')}</Text>
          </View>
        </View>
      )}

      {phase === 'waiting' && (
        <View style={styles.centered}>
          <View style={styles.waitAvatar}>
            <MaterialCommunityIcons name="account" size={48} color={Colors.secondary} />
          </View>
          <Text style={styles.waitTitle}>{t('room.waitingTitle')}</Text>
          <Text style={styles.waitHelp}>{t('room.waitingHelp')}</Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.centered}>
          <View style={styles.errIconCircle}>
            <MaterialCommunityIcons name="wifi-off" size={30} color={Colors.error} />
          </View>
          <Text style={styles.waitTitle}>{t('room.errorTitle')}</Text>
          <Text style={styles.waitHelp}>{t('room.errorDesc')}</Text>
          <TouchableOpacity style={styles.errBtn} onPress={() => void goReview()} activeOpacity={0.85}>
            <Text style={styles.errBtnText}>{t('room.errorBack')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Top status bar — over the video, waiting + inClass */}
      {joined && (
        <>
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.55)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing[1] }]}>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {t('room.appBarTitle')}
            </Text>
            <View style={[styles.statusPill, phase === 'inClass' && styles.statusPillLive]}>
              <View style={[styles.statusDot, phase === 'inClass' && styles.statusDotLive]} />
              <Text style={styles.statusText}>
                {phase === 'inClass' ? t('room.statusLive') : t('room.statusWaiting')}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Self view — small PiP bottom-right whenever we're joined */}
      {joined && myUserId && (
        <View style={[styles.pip, { bottom: insets.bottom + 104 }]}>
          {cameraOn ? (
            <ZoomView
              key={`self-${myUserId}`}
              userId={myUserId}
              videoAspect={VideoAspect.PanAndScan}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.pipOff}>
              <MaterialCommunityIcons name="video-off" size={20} color={Colors.textDim} />
            </View>
          )}
          <View style={styles.pipLabel}>
            <Text style={styles.pipLabelText}>{t('room.selfLabel')}</Text>
          </View>
        </View>
      )}

      {/* Tutor name + live mic indicator, bottom-left (over the video) */}
      {phase === 'inClass' && (
        <View style={[styles.tutorChip, { bottom: insets.bottom + 104 }]}>
          <MaterialCommunityIcons
            name={tutorMuted ? 'microphone-off' : 'microphone'}
            size={14}
            color={tutorMuted ? Colors.error : Colors.primary}
          />
          <Text style={styles.tutorChipText} numberOfLines={1}>
            {tutorName || 'Gustavo'}
          </Text>
        </View>
      )}

      {/* Control bar — dimmed/disabled until joined; hidden in the error state */}
      {phase !== 'error' && (
        <>
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.6)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
          <View
            style={[
              styles.controlBar,
              { paddingBottom: Math.max(insets.bottom, Spacing[4]) },
              !joined && styles.controlBarDimmed,
            ]}
          >
            <TouchableOpacity
              style={[styles.controlBtn, !micOn && styles.controlBtnOff]}
              onPress={toggleMic}
              disabled={!joined}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('room.micLabel')}
            >
              <MaterialCommunityIcons
                name={micOn ? 'microphone' : 'microphone-off'}
                size={24}
                color={micOn ? Colors.text : Colors.error}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, !cameraOn && styles.controlBtnOff]}
              onPress={toggleCamera}
              disabled={!joined}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('room.cameraLabel')}
            >
              <MaterialCommunityIcons
                name={cameraOn ? 'video' : 'video-off'}
                size={24}
                color={cameraOn ? Colors.text : Colors.error}
              />
            </TouchableOpacity>

            {/* TODO(Pass B): wire chat. Disabled placeholder to hold the layout. */}
            <TouchableOpacity
              style={[styles.controlBtn, styles.controlBtnDisabled]}
              disabled
              accessibilityRole="button"
              accessibilityLabel={t('room.chatLabel')}
            >
              <MaterialCommunityIcons name="message-outline" size={24} color={Colors.textDim} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.leaveBtn]}
              onPress={confirmLeave}
              disabled={!joined}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('room.leaveLabel')}
            >
              <MaterialCommunityIcons name="phone-hangup" size={24} color="#ffffff" />
            </TouchableOpacity>
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
    backgroundColor: Colors.surfaceLowest,
  },

  // Centered states (connecting / waiting / error)
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    gap: Spacing[4],
  },
  connectingTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  encryptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encryptedText: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  waitAvatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: '#26332e',
    borderWidth: 2,
    borderColor: 'rgba(78, 222, 163, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 0px 36px rgba(78, 222, 163, 0.24)',
  } as any,
  waitTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  waitHelp: {
    fontSize: 13.5,
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  errIconCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errBtn: {
    height: 48,
    paddingHorizontal: Spacing[8],
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[2],
  },
  errBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  // Top bar
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[2],
  },
  topBarTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 6,
  },
  statusPillLive: {
    backgroundColor: Colors.primaryDim,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.warning,
  },
  statusDotLive: {
    backgroundColor: Colors.primary,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  // Self-view PiP
  pip: {
    position: 'absolute',
    right: Spacing[4],
    width: 98,
    height: 134,
    borderRadius: Radius['3xl'],
    overflow: 'hidden',
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.4)',
    boxShadow: '0px 6px 24px rgba(0, 0, 0, 0.45)',
  } as any,
  pipOff: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipLabel: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: Radius.md,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pipLabelText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  // Tutor name + mic indicator chip
  tutorChip: {
    position: 'absolute',
    left: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3] - 2,
    paddingVertical: 7,
  },
  tutorChipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.text,
  },

  // Control bar
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
  controlBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[4],
    paddingTop: Spacing[5],
  },
  controlBarDimmed: {
    opacity: 0.4,
  },
  controlBtn: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(40, 40, 44, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnOff: {
    borderColor: Colors.errorBorder,
    backgroundColor: 'rgba(255, 180, 171, 0.14)',
  },
  controlBtnDisabled: {
    opacity: 0.45,
  },
  leaveBtn: {
    backgroundColor: LEAVE_RED,
    borderColor: LEAVE_RED,
    boxShadow: '0px 0px 22px rgba(229, 84, 74, 0.45)',
  } as any,
});
