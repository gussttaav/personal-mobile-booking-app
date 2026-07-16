import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GOOGLE_REVIEW_URL } from '@/constants/config';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useT } from '@/lib/i18n/locale-context';
import { api, ApiError } from '@/lib/api-client';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'rating' | 'comment' | 'google' | 'thanks';
type Rating = 1 | 2 | 3 | 4 | 5;

const RATING_LABEL_KEY = {
  1: 'review.rating1',
  2: 'review.rating2',
  3: 'review.rating3',
  4: 'review.rating4',
  5: 'review.rating5',
} as const;

const MAX_COMMENT = 1000;

/** The only route `returnTo` may redirect the exit to (S20 · Historial de reservas). */
const HISTORY_ROUTE = '/(tabs)/(profile)/history' as const;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const t = useT();
  const { eventId, returnTo } = useLocalSearchParams<{ eventId?: string; returnTo?: string }>();
  const safeEventId = eventId ?? '';

  const [phase, setPhase] = useState<Phase>('rating');

  // Rating step
  const [rating, setRating] = useState<Rating | null>(null);
  const [ratingSaved, setRatingSaved] = useState(false); // a rating POST has succeeded
  const [showGoogleReview, setShowGoogleReview] = useState(false);

  // Comment step
  const [comment, setComment] = useState('');

  // Shared async UI
  const [busy, setBusy] = useState(false); // in-flight network for the current action
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false); // guards against concurrent submits

  const topPad = Math.max(insets.top, Spacing[2]);
  const footerPB = Math.max(insets.bottom, Spacing[4]);

  // ── Rating: POST fires on star tap so the rating is saved the moment it's picked
  // (the user may then leave freely). Re-tapping a different star re-POSTs; the
  // backend upserts, so that's safe.
  async function selectRating(value: Rating) {
    if (busyRef.current) return;
    setRating(value);
    setError(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await api.postReview({ kind: 'rating', eventId: safeEventId, rating: value });
      setShowGoogleReview('showGoogleReview' in res ? res.showGoogleReview : false);
      setRatingSaved(true);
    } catch (err) {
      setRatingSaved(false);
      setError(reviewErrorMessage(err, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function goAfterComment() {
    setPhase(showGoogleReview ? 'google' : 'thanks');
  }

  // ── Comment: optional. Only POST when there's actual text; either way advance.
  async function submitComment() {
    if (busyRef.current) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      goAfterComment();
      return;
    }
    setError(null);
    busyRef.current = true;
    setBusy(true);
    try {
      await api.postReview({ kind: 'comment', eventId: safeEventId, comment: trimmed });
      goAfterComment();
    } catch (err) {
      setError(reviewErrorMessage(err, t));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function skipComment() {
    if (busyRef.current) return;
    setError(null);
    goAfterComment();
  }

  // ── Google: record the outcome (best-effort — a failed POST must not trap the
  // user), then proceed. Accept also opens the review URL.
  async function respondGoogle(action: 'accept' | 'decline') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await api.postReview({ kind: 'google', action });
    } catch {
      // Outcome record is best-effort; never block the user on it.
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    if (action === 'accept') {
      Linking.openURL(GOOGLE_REVIEW_URL).catch(() => {
        // If the URL can't open, still land the user on thanks.
      });
    }
    setPhase('thanks');
  }

  // Where the flow lands when it finishes. Callers may redirect it via `returnTo`
  // (S20 sends the user back to their history), but only to a known route — never
  // to an arbitrary param-supplied path.
  function exitToHome() {
    if (returnTo === HISTORY_ROUTE) {
      router.replace(HISTORY_ROUTE);
      return;
    }
    router.replace('/(tabs)/(home)');
  }

  // ── THANKS — full-screen ──────────────────────────────────────────────────
  if (phase === 'thanks') {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={[styles.thanksScroll, { paddingTop: topPad + Spacing[10] }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.thanksHeroCircle}>
            <MaterialCommunityIcons name="check" size={46} color={Colors.primary} />
          </View>
          <Text style={styles.thanksTitle}>{t('review.thanksTitle')}</Text>
          <Text style={styles.thanksBody}>{t('review.thanksBody')}</Text>

          {rating != null && (
            <View style={styles.recapPill}>
              <StarRow count={rating} size={14} />
              <Text style={styles.recapText}>{t('review.thanksRecap')}</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={exitToHome} activeOpacity={0.85}>
            <MaterialCommunityIcons name="home-outline" size={18} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('review.goHome')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── RATING / COMMENT / GOOGLE — share the app-bar chrome ──────────────────
  const stepNum = phase === 'rating' ? 1 : 2;

  return (
    <View style={styles.root}>
      {/* App bar */}
      <View style={[styles.appBar, { paddingTop: topPad }]}>
        {phase === 'comment' ? (
          <TouchableOpacity
            style={styles.appBarBtn}
            onPress={() => {
              setError(null);
              setPhase('rating');
            }}
            hitSlop={10}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.appBarBtn}
            onPress={phase === 'google' ? () => respondGoogle('decline') : exitToHome}
            hitSlop={10}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={22} color={Colors.text} />
          </TouchableOpacity>
        )}

        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>{t('review.appBarTitle')}</Text>
        </View>

        {phase === 'google' ? (
          <View style={styles.appBarBtn} />
        ) : (
          <View style={styles.stepChip}>
            <Text style={styles.stepChipText}>
              {t('review.stepOfTwo').replace('{n}', String(stepNum))}
            </Text>
          </View>
        )}
      </View>

      {/* ── RATING ─────────────────────────────────────────────────────────── */}
      {phase === 'rating' && (
        <>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.centeredBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.iconCircle, ratingSaved && styles.iconCircleActive]}>
              <MaterialCommunityIcons
                name={ratingSaved ? 'star' : 'star-outline'}
                size={26}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.title}>{t('review.ratingTitle')}</Text>
            <Text style={styles.subtitle}>{t('review.ratingSubtitle')}</Text>

            <View style={styles.starPicker}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = rating != null && n <= rating;
                return (
                  <TouchableOpacity
                    key={n}
                    onPress={() => selectRating(n as Rating)}
                    disabled={busy}
                    hitSlop={4}
                    activeOpacity={0.7}
                    style={styles.starTapTarget}
                  >
                    <MaterialCommunityIcons
                      name={filled ? 'star' : 'star-outline'}
                      size={42}
                      color={filled ? Colors.primary : Colors.borderVariant}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {busy ? (
              <Text style={styles.ratingHint}>{t('review.ratingSaving')}</Text>
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : rating != null ? (
              <Text style={styles.ratingLabel}>{t(RATING_LABEL_KEY[rating])}</Text>
            ) : (
              <Text style={styles.ratingHint}>{t('review.ratingHint')}</Text>
            )}
          </ScrollView>

          <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
            <TouchableOpacity
              style={[styles.primaryBtn, !ratingSaved && styles.primaryBtnDisabled]}
              onPress={() => setPhase('comment')}
              disabled={!ratingSaved || busy}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.primaryBtnText, !ratingSaved && styles.primaryBtnTextDisabled]}
              >
                {t('review.continue')}
              </Text>
              {ratingSaved && (
                <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.onPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── COMMENT ────────────────────────────────────────────────────────── */}
      {phase === 'comment' && (
        <>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.commentBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {rating != null && (
              <View style={styles.recapRow}>
                <StarRow count={rating} size={16} />
                <Text style={styles.recapLabelText}>{t(RATING_LABEL_KEY[rating])}</Text>
              </View>
            )}

            <View style={styles.savedPill}>
              <MaterialCommunityIcons name="check" size={14} color={Colors.primary} />
              <Text style={styles.savedPillText}>{t('review.savedPill')}</Text>
            </View>

            <Text style={styles.title}>{t('review.commentTitle')}</Text>
            <Text style={styles.subtitle}>
              <Text style={styles.subtitleDim}>{t('review.commentSubtitlePrefix')} </Text>
              {t('review.commentSubtitle')}
            </Text>

            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                placeholder={t('review.commentPlaceholder')}
                placeholderTextColor={Colors.textDim}
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={MAX_COMMENT}
                textAlignVertical="top"
                editable={!busy}
              />
              <Text style={styles.counter}>
                {t('review.commentCounter').replace('{n}', String(comment.length))}
              </Text>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </ScrollView>

          <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
            <TouchableOpacity
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              onPress={submitComment}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>{t('review.sendReview')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, busy && styles.ghostBtnDisabled]}
              onPress={skipComment}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('review.skip')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── GOOGLE ─────────────────────────────────────────────────────────── */}
      {phase === 'google' && (
        <>
          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.centeredBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.savedPill}>
              <MaterialCommunityIcons name="check" size={14} color={Colors.primary} />
              <Text style={styles.savedPillText}>{t('review.savedPill')}</Text>
            </View>

            <View style={styles.googleCard}>
              <View style={styles.googleLogoCircle}>
                <MaterialCommunityIcons name="google" size={26} color="#4285F4" />
              </View>
              <StarRow count={5} size={18} color="#fbbf24" gap={3} />
              <Text style={[styles.title, styles.googleCardTitle]}>{t('review.googleTitle')}</Text>
              <Text style={[styles.subtitle, styles.googleCardBody]}>{t('review.googleBody')}</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.googleCta, busy && styles.primaryBtnDisabled]}
                onPress={() => respondGoogle('accept')}
                disabled={busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={Colors.onPrimary} />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>{t('review.googleCta')}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color={Colors.onPrimary} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.stickyFooter, { paddingBottom: footerPB }]}>
            <TouchableOpacity
              style={[styles.ghostBtn, busy && styles.ghostBtnDisabled]}
              onPress={() => respondGoogle('decline')}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Text style={styles.ghostBtnText}>{t('review.googleSkip')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

// ── Star row ──────────────────────────────────────────────────────────────────

function StarRow({
  count,
  size,
  color = Colors.primary,
  gap = 2,
}: {
  count: number;
  size: number;
  color?: string;
  gap?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', gap }}>
      {Array.from({ length: count }, (_, i) => (
        <MaterialCommunityIcons key={i} name="star" size={size} color={color} />
      ))}
    </View>
  );
}

// ── Error mapping ───────────────────────────────────────────────────────────

function reviewErrorMessage(err: unknown, t: (k: any) => string): string {
  if (err instanceof ApiError && err.code === 'REVIEW_BOOKING_NOT_FOUND') {
    return t('review.errorNotFound');
  }
  return t('review.errorGeneric');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex1: {
    flex: 1,
  },

  // ── App bar ───────────────────────────────────────────────────────────────
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingBottom: Spacing[2],
  },
  appBarBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  appBarTitle: {
    ...TypeScale.label,
    fontFamily: FontFamily.headline,
    fontWeight: '700',
    color: Colors.text,
  },
  stepChip: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  stepChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // ── Shared body ───────────────────────────────────────────────────────────
  centeredBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[6],
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[5],
    boxShadow: '0 0 26px rgba(78,222,163,0.20)',
  },
  iconCircleActive: {
    boxShadow: '0 0 30px rgba(78,222,163,0.32)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.headline,
    letterSpacing: -0.44,
    lineHeight: 28,
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing[2],
    maxWidth: 300,
  },
  subtitleDim: {
    color: Colors.textDim,
  },

  // ── Star picker ───────────────────────────────────────────────────────────
  starPicker: {
    flexDirection: 'row',
    gap: Spacing[1],
    marginTop: Spacing[6],
    marginBottom: Spacing[3],
  },
  starTapTarget: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingHint: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '500',
    color: Colors.textDim,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    letterSpacing: -0.15,
    color: Colors.primary,
  },
  errorText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.error,
    textAlign: 'center',
    marginTop: Spacing[2],
  },

  // ── Comment ───────────────────────────────────────────────────────────────
  commentBody: {
    flexGrow: 1,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[6],
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[5],
  },
  recapLabelText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing[1],
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    marginBottom: Spacing[5],
  },
  savedPillText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  textAreaWrap: {
    marginTop: Spacing[4],
    borderRadius: Radius['2xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    padding: 14,
    paddingBottom: 30,
    minHeight: 130,
  },
  textArea: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.text,
    minHeight: 96,
    padding: 0,
  },
  counter: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // ── Google card ───────────────────────────────────────────────────────────
  googleCard: {
    width: '100%',
    borderRadius: Radius['4xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[6],
    alignItems: 'center',
    boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
  },
  googleLogoCircle: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[4],
    boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
  },
  googleCardTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: Spacing[3],
  },
  googleCardBody: {
    maxWidth: 260,
  },
  googleCta: {
    width: '100%',
    marginTop: Spacing[5],
    marginBottom: 0,
  },

  // ── Thanks ────────────────────────────────────────────────────────────────
  thanksScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    paddingBottom: 140,
  },
  thanksHeroCircle: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 50px rgba(78,222,163,0.35)',
  },
  thanksTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FontFamily.headline,
    letterSpacing: -0.52,
    lineHeight: 31,
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing[6],
  },
  thanksBody: {
    ...TypeScale.body,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing[3],
    maxWidth: 300,
  },
  recapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[6],
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recapText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // ── Buttons / footer ──────────────────────────────────────────────────────
  stickyFooter: {
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    gap: Spacing[2],
  },
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    boxShadow: '0 0 26px rgba(78,222,163,0.35)',
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
    boxShadow: 'none',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
    lineHeight: 20,
  },
  primaryBtnTextDisabled: {
    color: Colors.textDim,
  },
  ghostBtn: {
    height: 48,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnDisabled: {
    opacity: 0.4,
  },
  ghostBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
