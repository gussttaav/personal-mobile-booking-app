import { useCallback, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api-client';
import { getStoredSession } from '@/lib/auth';
import { BookingRow } from '@/components/BookingRow';
import { Card } from '@/components/Card';
import { CreditBalanceCard } from '@/components/CreditBalanceCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useT } from '@/lib/i18n/locale-context';
import type { Booking, GetCreditsResponse } from '@/types/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatDuration(startsAt: string, endsAt: string): string {
  const mins = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000;
  if (mins < 60) return `${mins} min`;
  if (mins === 120) return '2 horas';
  return '1 hora';
}

function classLabel(startsAt: string): string {
  const start = new Date(startsAt);
  const now = new Date();
  const todayStr = now.toDateString();
  const tomorrowStr = new Date(now.getTime() + 86400000).toDateString();
  if (start.toDateString() === todayStr) return 'Hoy';
  if (start.toDateString() === tomorrowStr) return 'Mañana';
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

// ── Types ─────────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'with-classes' | 'empty';

interface HomeData {
  nextClass: Booking | null;
  upcomingList: Booking[];
  credits: GetCreditsResponse | null;
  // True if the user owns/owned a pack — drives the depleted-credit nudge.
  // Derived robustly: GET /api/credits nulls `packSize` once a pack is fully
  // consumed, so we ALSO infer ownership from any pack booking on record.
  ownedPack: boolean;
  userName: string;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InicioScreen() {
  const [state, setState] = useState<ScreenState>('loading');
  const [data, setData] = useState<HomeData>({
    nextClass: null,
    upcomingList: [],
    credits: null,
    ownedPack: false,
    userName: '',
  });

  // Tracks the first load so we only show the skeleton on cold mount; later
  // focus refreshes (e.g. returning from a completed booking) update silently.
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setState('loading');
    try {
      const [bookingsRes, creditsRes] = await Promise.all([
        api.getMyBookings(),
        api.getCredits(),
      ]);

      const now = Date.now();
      const upcoming = bookingsRes.bookings
        .filter((b) => new Date(b.startsAt).getTime() > now - 60 * 60 * 1000)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

      // Active or future classes
      const futureOrActive = upcoming.filter(
        (b) => new Date(b.endsAt).getTime() > now,
      );

      const nextClass = futureOrActive[0] ?? null;
      const upcomingList = futureOrActive.slice(1, 6);

      const userName = creditsRes.name || getStoredSession()?.user.name || '';

      // Pack ownership: live packSize OR any pack booking (the credits endpoint
      // nulls packSize once the pack is depleted, so bookings are the backstop).
      const ownedPack =
        creditsRes.packSize != null ||
        bookingsRes.bookings.some((b) => b.sessionType === 'pack' || b.packSize != null);

      if (futureOrActive.length === 0 && creditsRes.credits === 0) {
        setData({ nextClass: null, upcomingList: [], credits: creditsRes, ownedPack, userName });
        setState('empty');
      } else {
        setData({ nextClass, upcomingList, credits: creditsRes, ownedPack, userName });
        setState('with-classes');
      }
    } catch {
      // On error, fall to empty state so the screen never crashes
      const fallbackName = getStoredSession()?.user.name ?? '';
      setData({ nextClass: null, upcomingList: [], credits: null, ownedPack: false, userName: fallbackName });
      setState('empty');
    }
  }, []);

  // Reload whenever the tab gains focus so a freshly-made booking shows up.
  useFocusEffect(
    useCallback(() => {
      load(!hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [load]),
  );

  if (state === 'loading') return <LoadingSkeleton />;
  if (state === 'empty') return <EmptyState userName={data.userName} />;
  return <WithClasses data={data} />;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

// Ambient emerald glow at the top of the screen — vertical green→transparent
// fade approximating the design's radial-gradient halo.
function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.16)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

function LoadingSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <TopGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[2] }]}
        scrollEnabled={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <SkeletonBlock width={100} height={14} />
            <SkeletonBlock width={160} height={28} style={{ marginTop: 6 }} />
          </View>
          <SkeletonBlock width={44} height={44} borderRadius={22} />
        </View>

        <SkeletonBlock width="100%" height={200} style={{ marginBottom: Spacing[3] }} />
        <SkeletonBlock width="100%" height={140} style={{ marginBottom: Spacing[5] }} />

        <SkeletonBlock width={140} height={18} style={{ marginBottom: Spacing[3] }} />
        <SkeletonBlock width="100%" height={72} style={{ marginBottom: Spacing[2] }} />
        <SkeletonBlock width="100%" height={72} style={{ marginBottom: Spacing[2] }} />
      </ScrollView>
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ userName }: { userName: string }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const name = userName.split(' ')[0] || '';

  return (
    <View style={styles.screen}>
      <TopGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[2] }]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greetingLine}>Te damos la bienvenida</Text>
            <Text style={styles.greetingName}>
              {name ? `Hola, ${name}` : 'Hola'}
            </Text>
          </View>
          {name ? (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(userName)}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.emptyHero}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="calendar-plus" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('home.empty.title')}</Text>
          <Text style={styles.emptySubtext}>{t('home.empty.subtitle')}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/(tabs)/(booking)/session-type')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus" size={20} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>Reservar primera clase</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.crossSell}>
          <View style={styles.crossSellTopRow}>
            <View style={styles.crossSellIconBox}>
              <MaterialCommunityIcons name="gift-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.crossSellContent}>
              <View style={styles.crossSellHeader}>
                <Text style={styles.crossSellTitle}>Ahorra con un pack</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>-15%</Text>
                </View>
              </View>
              <Text style={styles.crossSellBody}>
                Compra 5 o 10 clases por adelantado y reserva con crédito cuando quieras.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.crossSellBtn}
            onPress={() => router.push('/(tabs)/(packs)/packs')}
            activeOpacity={0.8}
          >
            <Text style={styles.crossSellBtnText}>Ver packs</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.trustBadge}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color={Colors.textDim} />
          <Text style={styles.trustText}>Cancela gratis hasta 24 h antes</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ── With-classes state ────────────────────────────────────────────────────────

function WithClasses({ data }: { data: HomeData }) {
  const insets = useSafeAreaInsets();
  const { nextClass, upcomingList, credits, ownedPack, userName } = data;
  const firstName = userName.split(' ')[0] || '';

  return (
    <View style={styles.screen}>
      <TopGlow />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing[2] }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greetingLine}>{greeting()}</Text>
            <Text style={styles.greetingName}>Hola, {firstName || userName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(userName)}</Text>
          </View>
        </View>

        {/* Next class card */}
        {nextClass != null && <NextClassCard booking={nextClass} />}

        {/* Credits balance — shown for anyone who has owned a pack, including a
            depleted 0-credit pack so the repurchase nudge stays visible. Ownership
            is `ownedPack` (live packSize OR a pack booking) because the credits
            endpoint nulls packSize once the pack is fully consumed.
            The 0-credits-AND-no-classes case never reaches here (it's the 'empty' branch). */}
        {credits != null && ownedPack && (
          <CreditBalanceCard
            data={credits}
            onReserve={() => router.push({ pathname: '/(tabs)/(booking)/schedule', params: { mode: 'credit' } })}
            onBuyMore={() => router.push('/(tabs)/(packs)/packs')}
          />
        )}

        {/* Upcoming list */}
        {upcomingList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Próximas clases</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{upcomingList.length}</Text>
              </View>
            </View>
            {upcomingList.map((b) => (
              <BookingRow
                key={b.token}
                booking={b}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/(home)/booking-detail',
                    params: {
                      token: b.token,
                      joinToken: b.joinToken,
                      sessionType: b.sessionType,
                      startsAt: b.startsAt,
                      endsAt: b.endsAt,
                      ...(b.packSize !== undefined ? { packSize: String(b.packSize) } : {}),
                    },
                  })
                }
              />
            ))}
          </View>
        )}

        {/* Reserve CTA */}
        <TouchableOpacity
          style={styles.reserveOtherBtn}
          onPress={() => router.push('/(tabs)/(booking)/session-type')}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.textMuted} />
          <Text style={styles.reserveOtherText}>Reservar otra clase</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ── Next class card (inline — unique to this screen) ─────────────────────────

function NextClassCard({ booking }: { booking: Booking }) {
  const status = getClassStatus(booking.startsAt, booking.endsAt);
  const isJoinable = status === 'imminent' || status === 'active';
  const startLabel = classLabel(booking.startsAt);
  const startTime = formatTime(booking.startsAt);
  const endTime = formatTime(booking.endsAt);
  const duration = formatDuration(booking.startsAt, booking.endsAt);

  return (
    <Card glowing style={styles.nextClassCard}>
      {/* Card header row */}
      <View style={styles.nextClassTop}>
        <Text style={styles.nextClassOverline}>TU PRÓXIMA CLASE</Text>
        {status !== 'upcoming' && (
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>
              {status === 'active'
                ? 'Sala lista'
                : `Empieza en ${minutesUntil(booking.startsAt)} min`}
            </Text>
          </View>
        )}
      </View>

      {/* Time */}
      <View style={styles.timeRow}>
        <Text style={styles.timeMain}>
          {startLabel} · {startTime}
        </Text>
        <Text style={styles.timeMuted}> – {endTime}</Text>
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{duration} · con Gustavo</Text>
        {status === 'active' && (
          <>
            <Text style={styles.metaSep}> · </Text>
            <Text style={styles.metaActive}>Sala lista</Text>
          </>
        )}
      </View>

      {/* Join button — always visible, disabled until the class is joinable */}
      <TouchableOpacity
        style={[styles.joinBtn, !isJoinable && styles.joinBtnDisabled]}
        onPress={() => router.push('/video-prejoin')}
        disabled={!isJoinable}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name="video-outline"
          size={20}
          color={isJoinable ? Colors.onPrimary : Colors.textDim}
        />
        <Text style={[styles.joinBtnText, !isJoinable && styles.joinBtnTextDisabled]}>
          Unirse a la clase
        </Text>
      </TouchableOpacity>

      {/* Secondary actions */}
      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={styles.detailBtn}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/(home)/booking-detail',
              params: {
                token: booking.token,
                joinToken: booking.joinToken,
                sessionType: booking.sessionType,
                startsAt: booking.startsAt,
                endsAt: booking.endsAt,
                ...(booking.packSize !== undefined ? { packSize: String(booking.packSize) } : {}),
              },
            })
          }
          activeOpacity={0.7}
        >
          <Text style={styles.detailBtnText}>Ver detalle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={() => router.push('/add-to-calendar')}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="calendar-check-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  content: {
    padding: Spacing[4],
    paddingBottom: Spacing[10],
    gap: Spacing[3],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  headerText: {
    gap: 2,
  },
  greetingLine: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  greetingName: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.42,
    lineHeight: 24,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: 'rgba(78, 222, 163, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: FontFamily.headline,
    color: Colors.textMuted,
    fontWeight: '700',
  },

  // Next class card
  nextClassCard: {
    gap: Spacing[2],
  },
  nextClassTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nextClassOverline: {
    ...TypeScale.overline,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    textTransform: 'uppercase',
    lineHeight: 15,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.successBg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingHorizontal: Spacing[2],
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  statusChipText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  timeMain: {
    ...TypeScale.h2,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  timeMuted: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.textDim,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  metaSep: {
    ...TypeScale.bodySm,
    color: Colors.textDim,
  },
  metaActive: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  joinBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    backgroundColor: Colors.primary,
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3] + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[1],
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 26, color: 'rgba(78, 222, 163, 0.45)' },
    ],
  },
  joinBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onPrimary,
    fontSize: 16,
  },
  joinBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
    boxShadow: [],
  },
  joinBtnTextDisabled: {
    color: Colors.textDim,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[1],
  },
  detailBtn: {
    flex: 1,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  detailBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  calendarBtn: {
    width: 48,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section header
  section: {
    gap: Spacing[2],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[1],
  },
  sectionTitle: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  countBadge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    ...TypeScale.badge,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Reserve other button
  reserveOtherBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing[3] + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing[1],
  },
  reserveOtherText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  // Empty state
  emptyHero: {
    alignItems: 'center',
    borderRadius: Radius['4xl'],
    backgroundColor: 'rgba(78, 222, 163, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.22)',
    paddingTop: 30,
    paddingHorizontal: 22,
    paddingBottom: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(78, 222, 163, 0.10)',
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 30, color: 'rgba(78, 222, 163, 0.25)' },
    ],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 24,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing[2],
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: Spacing[5],
  },
  primaryBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing[3] + 3,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 26, color: 'rgba(78, 222, 163, 0.4)' },
    ],
  },
  primaryBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onPrimary,
    fontSize: 15,
  },
  crossSell: {
    gap: Spacing[3],
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[4],
  },
  crossSellTopRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'flex-start',
  },
  crossSellIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(78, 222, 163, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  crossSellContent: {
    flex: 1,
    gap: 4,
  },
  crossSellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  crossSellTitle: {
    ...TypeScale.h4,
    fontSize: 14,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  discountBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  discountBadgeText: {
    ...TypeScale.badge,
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  crossSellBody: {
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    lineHeight: 19,
  },
  crossSellBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.primaryDim,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossSellBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  trustBadge: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[2],
  },
  trustText: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
});
