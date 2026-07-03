import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
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

// S01 · Bienvenida / Iniciar sesión
// Design source: docs/design/screens/SignIn.dc.html + "Iniciar Sesion.dc.html".
// States (inventory): initial → connecting (account picker) → error / offline.
// The native Google flow runs behind a design-matched custom button; the Apple
// slot below is a reserved placeholder so a second provider drops in later.

type Status = 'idle' | 'connecting' | 'error' | 'offline';

// Ambient emerald glow at the top — vertical green→transparent fade approximating
// the design's radial halo (same approach as the Home screen).
function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.18)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const t = useT();
  const [status, setStatus] = useState<Status>('idle');

  const connecting = status === 'connecting';

  async function handleGoogle() {
    if (connecting) return;
    setStatus('connecting');
    try {
      await signIn();
      // On success the auth guard flips and routes into the app automatically.
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
        {/* Brand hero */}
        <View style={styles.hero}>
          <View style={styles.brandMark}>
            <Image
              source={require('@/assets/images/favicon.svg')}
              style={styles.brandMarkImg}
              contentFit="contain"
            />
          </View>

          <Text style={styles.brandOverline}>
            GUSTAVO<Text style={styles.brandOverlineAccent}>AI.DEV</Text>
          </Text>

          <Text style={styles.heading}>Gustavo Torres</Text>

          <Text style={styles.valueProp}>
            {t('login.valueProp')}
          </Text>

          <View style={styles.socialProof}>
            <MaterialCommunityIcons name="star" size={14} color={Colors.primary} />
            <Text style={styles.socialProofText}>{t('login.socialProof')}</Text>
          </View>
        </View>

        {/* Auth block */}
        <View style={styles.authBlock}>
          {/* Fixed-height alert slot keeps the buttons from jumping between states. */}
          <View style={styles.alertSlot}>
            {status === 'error' && (
              <View style={[styles.alert, styles.alertError]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.error} />
                <Text style={[styles.alertText, { color: Colors.error }]}>
                  {t('login.error')}
                </Text>
              </View>
            )}
            {status === 'offline' && (
              <View style={[styles.alert, styles.alertOffline]}>
                <MaterialCommunityIcons name="wifi-off" size={18} color={Colors.warning} />
                <Text style={[styles.alertText, { color: Colors.warning }]}>
                  {t('errors.noConnection')}
                </Text>
              </View>
            )}
          </View>

          {/* Google — native flow, design-matched button */}
          <TouchableOpacity
            style={[styles.googleBtn, connecting && styles.googleBtnLoading]}
            onPress={handleGoogle}
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

          {/* Legal */}
          <View style={styles.legal}>
            <Text style={styles.legalIntro}>{t('login.legalIntro')}</Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.legalLink}>{t('login.terms')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalSep}>·</Text>
              <TouchableOpacity hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.legalLink}>{t('login.privacy')}</Text>
              </TouchableOpacity>
            </View>
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
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: Radius['5xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[6],
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 36, color: 'rgba(78, 222, 163, 0.3)' },
    ],
  },
  brandMarkImg: {
    width: 40,
    height: 40,
  },
  brandOverline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    letterSpacing: 1.8,
    color: Colors.text,
    marginBottom: Spacing[3],
  },
  brandOverlineAccent: {
    color: Colors.primary,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    lineHeight: 33,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing[3],
  },
  valueProp: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 23,
    maxWidth: 290,
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: Spacing[5],
  },
  socialProofText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
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

  // Legal
  legal: {
    alignItems: 'center',
    marginTop: Spacing[1],
  },
  legalIntro: {
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    paddingVertical: 6,
  },
  legalSep: {
    fontSize: 11,
    color: '#555357',
  },
});
