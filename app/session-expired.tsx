import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { Image as RNImage } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { AuthError } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/locale-context';

// S02 · Sesión expirada / Re-login
// Design source: docs/design/screens/ReLogin.dc.html + "Sesion Expirada.dc.html".
// Shown when a present session lapsed beyond silent refresh (the 401 hook hit
// NO_SAVED_CREDENTIAL — see lib/auth-context.tsx). Re-entry framing for a
// returning user, NOT the value-prop welcome (S01). Reuses the proven sign-in
// flow (useAuth().signIn); the auth guard flips back into the app on success.
// States (inventory): aviso (idle) → conectando (account picker) → error / offline.
//
// NOTE: re-auth lands on Inicio — there's no captured route to restore (see the
// TODO in lib/auth-context.tsx), so the copy avoids promising the exact screen.

type Status = 'idle' | 'connecting' | 'error' | 'offline';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Ambient emerald glow at the top — same approach as S01 / Home.
function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.18)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

export default function SessionExpiredScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, session } = useAuth();
  const t = useT();
  const [status, setStatus] = useState<Status>('idle');

  const connecting = status === 'connecting';
  const user = session?.user;

  async function handleReSignIn() {
    if (connecting) return;
    setStatus('connecting');
    try {
      await signIn();
      // On success the auth guard flips and routes back into the app automatically.
    } catch (e) {
      // A cancelled picker is swallowed inside signIn() and resolves normally;
      // anything thrown here is a real failure.
      if (e instanceof AuthError && e.code === 'NETWORK') setStatus('offline');
      else setStatus('error');
    }
  }

  return (
    <View style={styles.screen}>
      <TopGlow />
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + Spacing[6], paddingBottom: insets.bottom + Spacing[4] },
        ]}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconBadge}>
            <MaterialCommunityIcons name="clock-outline" size={34} color={Colors.primary} />
          </View>

          <Text style={styles.overline}>{t('sessionExpired.badge')}</Text>

          <Text style={styles.heading}>{t('sessionExpired.title')}</Text>

          <Text style={styles.body}>{t('sessionExpired.description')}</Text>

          {/* Known user identity — "Continuar como …" */}
          {user && (
            <View style={styles.identityWrap}>
              <Text style={styles.identityLabel}>{t('sessionExpired.continueAsLabel')}</Text>
              <View style={styles.identityCard}>
                {user.image ? (
                  <RNImage source={{ uri: user.image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitials}>{initials(user.name)}</Text>
                  </View>
                )}
                <View style={styles.identityText}>
                  <Text style={styles.identityName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Auth block */}
        <View style={styles.authBlock}>
          {/* Fixed-height alert slot keeps the buttons from jumping between states. */}
          <View style={styles.alertSlot}>
            {status === 'error' && (
              <View style={[styles.alert, styles.alertError]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.error} />
                <Text style={[styles.alertText, { color: Colors.error }]}>
                  {t('sessionExpired.errorMessage')}
                </Text>
              </View>
            )}
            {status === 'offline' && (
              <View style={[styles.alert, styles.alertOffline]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color={Colors.warning} />
                <Text style={[styles.alertText, { color: Colors.warning }]}>
                  {t('sessionExpired.offlineMessage')}
                </Text>
              </View>
            )}
          </View>

          {/* Google — native flow, design-matched button */}
          <TouchableOpacity
            style={[styles.googleBtn, connecting && styles.googleBtnLoading]}
            onPress={handleReSignIn}
            activeOpacity={0.85}
            disabled={connecting}
            accessibilityRole="button"
            accessibilityState={{ disabled: connecting, busy: connecting }}
          >
            {connecting ? (
              <>
                <ActivityIndicator size="small" color="#1f1f1f" />
                <Text style={styles.googleBtnText}>{t('common.signingIn')}</Text>
              </>
            ) : (
              <>
                <Image
                  source={require('@/assets/images/google-g.svg')}
                  style={styles.googleIcon}
                  contentFit="contain"
                />
                <Text style={styles.googleBtnText}>{t('common.signInGoogle')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple — reserved slot for iOS, no functionality yet */}
          <View style={styles.appleSlot}>
            <MaterialCommunityIcons name="apple" size={16} color="#555357" />
            <Text style={styles.appleSlotText}>{t('common.comingSoonIos')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

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
    height: 320,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing[6],
  },

  // Hero
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[6],
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 34, color: 'rgba(78, 222, 163, 0.3)' },
    ],
  },
  overline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.primary,
    marginBottom: Spacing[3],
  },
  heading: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 31,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing[3],
  },
  body: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 300,
  },

  // Identity card
  identityWrap: {
    width: '100%',
    marginTop: Spacing[6],
    gap: Spacing[2],
  },
  identityLabel: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: Colors.textDim,
    textAlign: 'center',
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.35)',
  },
  avatarFallback: {
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },
  identityText: {
    flex: 1,
  },
  identityName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  identityEmail: {
    fontSize: 12.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 2,
  },

  // Auth block
  authBlock: {
    gap: Spacing[3],
  },
  alertSlot: {
    minHeight: 56,
    justifyContent: 'center',
  },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertError: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
  },
  alertOffline: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warningBorder,
  },
  alertText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    lineHeight: 19,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: '#ffffff',
    boxShadow: [
      { offsetX: 0, offsetY: 6, blurRadius: 22, color: 'rgba(0, 0, 0, 0.38)' },
    ],
  },
  googleBtnLoading: {
    opacity: 0.88,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: '#1f1f1f',
  },

  appleSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderStyle: 'dashed',
  },
  appleSlotText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: '#555357',
  },
});
