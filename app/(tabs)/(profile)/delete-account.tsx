import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { Stack, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { api, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { openGustavoEmail } from '@/lib/contact';
import { useLocale } from '@/lib/i18n/locale-context';
import {
  classifyDeleteFailure,
  confirmEmailMatches,
  gateFor,
  type DeletionGate,
} from '@/lib/account-deletion';
import { TERMS_URL } from '@/constants/config';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import type { GetAccountResponse } from '@/types/api';

// S21 · Eliminar cuenta — the in-app account-deletion flow (App Store 5.1.1(v) /
// Google Play data-deletion policy). Entered from S18 Ajustes → Cuenta.
//
// Deletion is GATED server-side and the gate has three outcomes, one screen each:
//   · blocked_pack     — unused pack credits; only a refund clears it → email Gustavo
//   · blocked_bookings — cancellable classes; he can act → send him to Inicio
//   · confirm          — type your own email, then delete
// GET /api/account is advisory (render hint); DELETE re-runs the whole check, so a
// 409 on submit just re-fetches the verdict and re-renders the matching screen.
//
// The teardown after a successful DELETE lives in useAuth().completeAccountDeletion:
// it disarms the 401 refresh BEFORE dropping the credentials, because re-exchanging
// a Google ID token would silently recreate the account that was just erased.

type Phase = 'loading' | 'load_error' | DeletionGate | 'submitting';

type SubmitError = 'mismatch' | 'rate_limited' | 'generic';

export default function DeleteAccountScreen() {
  const { t, locale } = useLocale();
  const { session, completeAccountDeletion } = useAuth();
  const email = session?.user.email ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [verdict, setVerdict] = useState<GetAccountResponse | null>(null);
  const [typed, setTyped] = useState('');
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const submittingRef = useRef(false);

  const scrollRef = useRef<ScrollView>(null);
  // Android edge-to-edge (SDK 54) does not pan for the soft keyboard — grow a
  // spacer by the true keyboard inset so the confirmation field stays reachable.
  const keyboard = useAnimatedKeyboard();
  const keyboardSpacer = useAnimatedStyle(() => ({ height: keyboard.height.value }));

  const loadVerdict = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await api.getAccount();
      setVerdict(res);
      setPhase(gateFor(res));
    } catch {
      setPhase('load_error');
    }
  }, []);

  useEffect(() => {
    void loadVerdict();
  }, [loadVerdict]);

  // Leaving mid-flight would unmount the screen before the teardown runs, leaving
  // a live bearer for an account that no longer exists (which the 401 refresh
  // would then re-register). Swallow the hardware back press while submitting;
  // the header back button and the swipe gesture are disabled below.
  useEffect(() => {
    if (phase !== 'submitting') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase]);

  // Runs the moment the account is gone — before any navigation and before
  // anything else can touch the network. The guard flip in the root layout
  // routes to /login on its own, so this screen just unmounts underneath.
  async function onDeleted() {
    await completeAccountDeletion();
    Alert.alert(t('deleteAccount.done.title'), t('deleteAccount.done.body'));
  }

  async function handleDelete() {
    if (submittingRef.current || !confirmEmailMatches(typed, email)) return;
    submittingRef.current = true;
    setSubmitError(null);
    setPhase('submitting');
    try {
      await api.deleteAccount({ confirmEmail: typed.trim() });
      await onDeleted();
      return; // unmounted — never re-arm submittingRef on the success path
    } catch (err) {
      submittingRef.current = false;
      const failure =
        err instanceof ApiError ? classifyDeleteFailure(err.status, err.code) : 'generic';
      if (failure === 'already_gone') {
        await onDeleted();
        return;
      }
      if (failure === 'blocked') {
        // The account changed under him — show the matching blocked screen, not an error.
        await loadVerdict();
        return;
      }
      setSubmitError(failure === 'not_confirmed' ? 'mismatch' : failure);
      setPhase('confirm');
    }
  }

  // ── Loading / load error ───────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <Screen title={t('deleteAccount.title')}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.centeredText}>{t('deleteAccount.checking')}</Text>
        </View>
      </Screen>
    );
  }

  if (phase === 'load_error') {
    return (
      <Screen title={t('deleteAccount.title')}>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="wifi-off" size={34} color={Colors.textDim} />
          <Text style={styles.centeredText}>
            {t('errors.loadFailed').replace('{what}', t('deleteAccount.loadWhat'))}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={loadVerdict} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ── Blocked · unused pack credits (rules 1 & 2) ────────────────────────────

  if (phase === 'blocked_pack') {
    const credits = verdict?.packCredits ?? 0;
    // Rule 2: every cancellable class is a pack class, so `packCredits` is 0 —
    // cancelling would just return credits and land back on rule 1.
    const body =
      credits === 0
        ? t('deleteAccount.blockedPack.bodyPackClasses')
        : credits === 1
          ? t('deleteAccount.blockedPack.bodyOne')
          : t('deleteAccount.blockedPack.body').replace('{n}', String(credits));

    return (
      <Screen title={t('deleteAccount.title')}>
        <ScrollView contentContainerStyle={styles.content}>
          <BlockedHeader icon="gift-outline" title={t('deleteAccount.blockedPack.title')} body={body} />

          {credits > 0 && (verdict?.cancellableBookings ?? 0) > 0 && (
            <NoteCard text={t('deleteAccount.blockedPack.packClassNote')} />
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() =>
              openGustavoEmail({
                subject: t('deleteAccount.blockedPack.emailSubject'),
                body: t('deleteAccount.blockedPack.emailBody'),
                noMailAppTitle: t('common.noMailAppTitle'),
                noMailAppBody: t('common.noMailAppBody'),
              })
            }
          >
            <MaterialCommunityIcons name="email-outline" size={18} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('common.writeToGustavo')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            activeOpacity={0.7}
            onPress={() => Linking.openURL(TERMS_URL[locale])}
          >
            <MaterialCommunityIcons name="open-in-new" size={16} color={Colors.textMuted} />
            <Text style={styles.ghostBtnText}>{t('deleteAccount.blockedPack.policyCta')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Screen>
    );
  }

  // ── Blocked · cancellable classes (rule 3) ─────────────────────────────────

  if (phase === 'blocked_bookings') {
    const n = verdict?.cancellableBookings ?? 0;
    const body =
      n === 1
        ? t('deleteAccount.blockedBookings.bodyOne')
        : t('deleteAccount.blockedBookings.body').replace('{n}', String(n));

    return (
      <Screen title={t('deleteAccount.title')}>
        <ScrollView contentContainerStyle={styles.content}>
          <BlockedHeader
            icon="calendar-clock"
            title={t('deleteAccount.blockedBookings.title')}
            body={body}
          />
          <NoteCard text={t('deleteAccount.blockedBookings.packNote')} />

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => router.replace('/(tabs)/(home)')}
          >
            <MaterialCommunityIcons name="calendar-outline" size={18} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('deleteAccount.blockedBookings.cta')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </Screen>
    );
  }

  // ── Confirmation (rule 4) ──────────────────────────────────────────────────

  const submitting = phase === 'submitting';
  const imminent = verdict?.imminentBookings ?? 0;
  const canDelete = confirmEmailMatches(typed, email) && !submitting;

  return (
    <Screen title={t('deleteAccount.title')} locked={submitting}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents={submitting ? 'none' : 'auto'} style={submitting && styles.blocked}>
          <View style={styles.warnHeader}>
            <View style={styles.warnIcon}>
              <MaterialCommunityIcons name="alert-circle-outline" size={24} color={Colors.error} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.title}>{t('deleteAccount.confirm.title')}</Text>
              <Text style={styles.subtitle}>{t('deleteAccount.confirm.subtitle')}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('deleteAccount.confirm.erasesTitle')}</Text>
          <View style={styles.card}>
            <EraseRow icon="calendar-remove-outline" text={t('deleteAccount.confirm.eraseBookings')} />
            <View style={styles.divider} />
            <EraseRow icon="database-remove-outline" text={t('deleteAccount.confirm.eraseCredits')} />
            <View style={styles.divider} />
            <EraseRow icon="star-off-outline" text={t('deleteAccount.confirm.eraseReviews')} />
            <View style={styles.divider} />
            <EraseRow icon="credit-card-off-outline" text={t('deleteAccount.confirm.erasePayments')} />
          </View>

          {imminent > 0 && (
            <View style={styles.warnCard}>
              <MaterialCommunityIcons
                name="clock-alert-outline"
                size={19}
                color={Colors.warning}
                style={styles.noteIcon}
              />
              <Text style={styles.warnCardText}>
                {imminent === 1
                  ? t('deleteAccount.confirm.imminentOne')
                  : t('deleteAccount.confirm.imminent').replace('{n}', String(imminent))}
              </Text>
            </View>
          )}

          <Text style={styles.inputLabel}>
            {t('deleteAccount.confirm.typeEmail').replace('{email}', email)}
          </Text>
          <TextInput
            style={[styles.input, submitError === 'mismatch' && styles.inputError]}
            value={typed}
            onChangeText={(v) => {
              setTyped(v);
              if (submitError) setSubmitError(null);
            }}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)}
            placeholder={t('deleteAccount.confirm.placeholder')}
            placeholderTextColor={Colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
            inputMode="email"
          />

          {submitError != null && (
            <Text style={styles.errorText}>
              {submitError === 'mismatch'
                ? t('deleteAccount.confirm.mismatch')
                : submitError === 'rate_limited'
                  ? t('deleteAccount.errRateLimited')
                  : t('deleteAccount.errGeneric')}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.dangerBtn, !canDelete && styles.dangerBtnDisabled]}
          onPress={handleDelete}
          disabled={!canDelete}
          activeOpacity={0.85}
        >
          {submitting ? (
            <>
              <ActivityIndicator size="small" color={Colors.error} />
              <Text style={styles.dangerBtnText}>{t('deleteAccount.confirm.deleting')}</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
              <Text style={styles.dangerBtnText}>{t('deleteAccount.confirm.cta')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ghostBtn}
          onPress={() => router.back()}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Text style={styles.ghostBtnText}>{t('deleteAccount.confirm.keepCta')}</Text>
        </TouchableOpacity>

        <Animated.View style={keyboardSpacer} />
      </ScrollView>
    </Screen>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function Screen({
  title,
  locked = false,
  children,
}: {
  title: string;
  /** In-flight deletion: no way off the screen until the teardown has run. */
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerShown: true,
          title,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerBackVisible: !locked,
          gestureEnabled: !locked,
        }}
      />
      {children}
    </View>
  );
}

function BlockedHeader({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
}) {
  return (
    <View style={styles.blockedHeader}>
      <View style={styles.blockedIcon}>
        <MaterialCommunityIcons name={icon} size={28} color={Colors.warning} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.blockedBody}>{body}</Text>
    </View>
  );
}

function NoteCard({ text }: { text: string }) {
  return (
    <View style={styles.noteCard}>
      <MaterialCommunityIcons
        name="information-outline"
        size={18}
        color={Colors.textDim}
        style={styles.noteIcon}
      />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function EraseRow({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  text: string;
}) {
  return (
    <View style={styles.eraseRow}>
      <MaterialCommunityIcons name={icon} size={19} color={Colors.textDim} />
      <Text style={styles.eraseText}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[4],
    paddingBottom: Spacing[8],
    gap: Spacing[3],
  },
  flex1: {
    flex: 1,
  },
  blocked: {
    opacity: 0.5,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[5],
    gap: Spacing[4],
  },
  centeredText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  blockedHeader: {
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[4],
  },
  blockedIcon: {
    width: 62,
    height: 62,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  blockedBody: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  warnHeader: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'flex-start',
  },
  warnIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  title: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  subtitle: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: 3,
  },
  sectionTitle: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginTop: Spacing[3],
    marginLeft: 2,
  },
  card: {
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing[4],
  },
  eraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3] + 2,
  },
  eraseText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    flex: 1,
  },
  noteCard: {
    flexDirection: 'row',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainer,
    padding: Spacing[4],
  },
  noteIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  noteText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    flex: 1,
  },
  warnCard: {
    flexDirection: 'row',
    gap: Spacing[3],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningBg,
    padding: Spacing[4],
  },
  warnCardText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    flex: 1,
  },
  inputLabel: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    marginTop: Spacing[3],
    marginLeft: 2,
  },
  input: {
    height: 50,
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceContainer,
    color: Colors.text,
    fontFamily: FontFamily.body,
    fontSize: 15,
  },
  inputError: {
    borderColor: Colors.errorBorder,
  },
  errorText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.error,
    marginLeft: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 50,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    marginTop: Spacing[2],
  },
  primaryBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '700',
    color: Colors.onPrimary,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 50,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorBg,
    marginTop: Spacing[3],
  },
  dangerBtnDisabled: {
    opacity: 0.45,
  },
  dangerBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.error,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    height: 46,
  },
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
});
