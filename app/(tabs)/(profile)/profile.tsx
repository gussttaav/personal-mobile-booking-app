import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useT } from '@/lib/i18n/locale-context';
import { CreditBalanceCard } from '@/components/CreditBalanceCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetCreditsResponse } from '@/types/api';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  const [credits, setCredits] = useState<GetCreditsResponse | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  // Only show the skeleton on the first load; later focus refreshes update silently.
  const hasLoadedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!hasLoadedRef.current) setCreditsLoading(true);
      api
        .getCredits()
        .then((res) => {
          if (active) setCredits(res);
        })
        .catch(() => {
          // Best-effort: the balance card is non-critical, omit it silently on error.
        })
        .finally(() => {
          if (active) {
            setCreditsLoading(false);
            hasLoadedRef.current = true;
          }
        });
      return () => {
        active = false;
      };
    }, []),
  );

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(); // clears the token + flips the guard → routes to login
    } finally {
      setSigningOut(false);
    }
  }

  const user = session?.user;
  // The depleted-pack signal nulls packSize, so a fully-consumed pack won't surface
  // here. Perfil intentionally does not fetch bookings (Home derives `ownedPack`
  // from booking history to cover that case); the credit card shows for active packs.
  const hasPack = credits?.packSize != null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[2] }]}
    >
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity
          style={styles.gearBtn}
          onPress={() => router.push('/(tabs)/(profile)/settings')}
          accessibilityLabel={t('settings.title')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="cog-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* identity */}
      <View style={styles.identity}>
        {user?.image != null ? (
          <Image source={{ uri: user.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{user ? initials(user.name) : ''}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name}</Text>
        <View style={styles.emailRow}>
          <MaterialCommunityIcons name="email-outline" size={14} color={Colors.textDim} />
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <View style={styles.googleBadge}>
          <MaterialCommunityIcons name="check" size={13} color={Colors.primary} />
          <Text style={styles.googleBadgeText}>{t('profile.googleLinked')}</Text>
        </View>
      </View>

      {/* credit balance */}
      {creditsLoading ? (
        <SkeletonBlock width="100%" height={92} borderRadius={Radius['3xl']} />
      ) : (
        credits != null &&
        hasPack && (
          <CreditBalanceCard
            data={credits}
            onReserve={() =>
              router.push({ pathname: '/(tabs)/(booking)/schedule', params: { mode: 'credit' } })
            }
            onBuyMore={() => router.push('/(tabs)/(packs)/packs')}
          />
        )
      )}

      {/* settings entry */}
      <Pressable
        style={styles.settingsCard}
        onPress={() => router.push('/(tabs)/(profile)/settings')}
      >
        <View style={styles.settingsIcon}>
          <MaterialCommunityIcons name="cog-outline" size={19} color={Colors.textMuted} />
        </View>
        <View style={styles.settingsTextWrap}>
          <Text style={styles.settingsTitle}>{t('profile.settingsRow')}</Text>
          <Text style={styles.settingsSubtitle}>{t('profile.settingsRowDesc')}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={19} color={Colors.textDim} />
      </Pressable>

      {/* sign out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        activeOpacity={0.8}
        disabled={signingOut}
      >
        <MaterialCommunityIcons name="logout" size={18} color={Colors.error} />
        <Text style={styles.signOutText}>
          {signingOut ? t('profile.signingOut') : t('profile.signOut')}
        </Text>
      </TouchableOpacity>

      <Text style={styles.footer}>gustavoai.dev · {t('common.version')} 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[8],
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: 'rgba(78, 222, 163, 0.45)',
  },
  avatarFallback: {
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...TypeScale.h2,
    fontFamily: FontFamily.headline,
    color: Colors.primary,
  },
  name: {
    ...TypeScale.h2,
    fontFamily: FontFamily.headline,
    fontSize: 22,
    color: Colors.text,
    marginTop: Spacing[2],
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  email: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  googleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
    marginTop: Spacing[1],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1] + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainer,
  },
  googleBadgeText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: Radius['3xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLow,
    padding: Spacing[4],
  },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: {
    flex: 1,
  },
  settingsTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.text,
  },
  settingsSubtitle: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 50,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
  },
  signOutText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },
  footer: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: Spacing[2],
  },
});
