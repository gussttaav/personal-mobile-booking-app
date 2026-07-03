import * as Calendar from 'expo-calendar';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE } from '@/constants/config';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';
import type { TranslationKey } from '@/lib/i18n/strings';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'checking' | 'requesting' | 'adding' | 'success' | 'denied' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function eventTitleKey(sessionType: string): TranslationKey {
  if (sessionType === 'session2h') return 'addToCalendar.eventTitle2h';
  if (sessionType === 'free15min') return 'addToCalendar.eventTitle15';
  return 'addToCalendar.eventTitle1h'; // session1h + pack
}

async function pickWritableCalendarId(): Promise<string> {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal.id;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const found =
    cals.find((c) => c.allowsModifications && c.source?.type === 'local') ??
    cals.find((c) => c.allowsModifications);
  if (!found) throw new Error('No writable calendar found');
  return found.id;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AddToCalendarScreen() {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();

  const params = useLocalSearchParams<{
    startIso: string;
    endIso: string;
    sessionType: string;
    joinToken: string;
  }>();

  const startIso = params.startIso ?? '';
  const endIso = params.endIso ?? '';
  const sessionType = params.sessionType ?? 'session1h';
  const joinToken = params.joinToken ?? '';

  const [phase, setPhase] = useState<Phase>('checking');
  // Guard against re-running writeEvent if the user rapidly retaps
  const writingRef = useRef(false);

  async function writeEvent() {
    if (writingRef.current) return;
    writingRef.current = true;
    setPhase('adding');
    try {
      const calendarId = await pickWritableCalendarId();
      const title = t(eventTitleKey(sessionType));
      const joinUrl = `${API_BASE}/${locale}/sesion/${joinToken}`;
      const notes = `${t('addToCalendar.joinLine')}\n${joinUrl}`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await Calendar.createEventAsync(calendarId, {
        title,
        startDate: new Date(startIso),
        endDate: new Date(endIso),
        timeZone,
        notes,
        location: joinUrl,
      });
      setPhase('success');
    } catch {
      setPhase('error');
    } finally {
      writingRef.current = false;
    }
  }

  // On mount: check permission → branch into the right phase.
  useEffect(() => {
    let active = true;
    (async () => {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (!active) return;
      if (status === 'granted') {
        writeEvent();
      } else if (status === 'denied') {
        setPhase('denied');
      } else {
        setPhase('requesting');
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGrantAccess() {
    const res = await Calendar.requestCalendarPermissionsAsync();
    if (res.status === 'granted') {
      writeEvent();
    } else {
      setPhase('denied');
      if (!res.canAskAgain) {
        Linking.openSettings();
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing[6]) }]}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color={Colors.primary} />
        </View>
        <Text style={styles.headerTitle}>{t('addToCalendar.title')}</Text>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={20} color={Colors.textDim} />
        </TouchableOpacity>
      </View>

      {/* Phase content */}
      {(phase === 'checking' || phase === 'adding') && (
        <View style={styles.centeredBlock}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingLabel}>
            {phase === 'adding' ? t('addToCalendar.adding') : t('addToCalendar.checking')}
          </Text>
        </View>
      )}

      {phase === 'requesting' && (
        <View style={styles.stateBlock}>
          <View style={styles.stateIconWrap}>
            <MaterialCommunityIcons name="calendar-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>{t('addToCalendar.requestTitle')}</Text>
          <Text style={styles.stateDesc}>{t('addToCalendar.requestDesc')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleGrantAccess} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('addToCalendar.requestBtn')}</Text>
          </TouchableOpacity>
          <Pressable style={styles.textBtn} onPress={() => router.back()}>
            <Text style={styles.textBtnText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      )}

      {phase === 'success' && (
        <View style={styles.stateBlock}>
          <View style={[styles.stateIconWrap, styles.stateIconSuccess]}>
            <MaterialCommunityIcons name="check-circle-outline" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.stateTitle}>{t('addToCalendar.successTitle')}</Text>
          <Text style={styles.stateDesc}>{t('addToCalendar.successDesc')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('addToCalendar.done')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {phase === 'denied' && (
        <View style={styles.stateBlock}>
          <View style={[styles.stateIconWrap, styles.stateIconWarning]}>
            <MaterialCommunityIcons name="calendar-remove-outline" size={32} color={Colors.warning} />
          </View>
          <Text style={[styles.stateTitle, styles.stateTitleWarning]}>{t('addToCalendar.deniedTitle')}</Text>
          <Text style={styles.stateDesc}>{t('addToCalendar.deniedDesc')}</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.primaryBtnWarning]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="open-in-new" size={15} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{t('addToCalendar.openSettings')}</Text>
          </TouchableOpacity>
          <Pressable style={styles.textBtn} onPress={() => router.back()}>
            <Text style={styles.textBtnText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.stateBlock}>
          <View style={[styles.stateIconWrap, styles.stateIconError]}>
            <MaterialCommunityIcons name="calendar-alert" size={32} color={Colors.error} />
          </View>
          <Text style={[styles.stateTitle, styles.stateTitleError]}>{t('addToCalendar.errorTitle')}</Text>
          <Text style={styles.stateDesc}>{t('addToCalendar.errorDesc')}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={writeEvent} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t('addToCalendar.retry')}</Text>
          </TouchableOpacity>
          <Pressable style={styles.textBtn} onPress={() => router.back()}>
            <Text style={styles.textBtnText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: Colors.surfaceLow,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[2],
  },

  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: Spacing[4],
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginBottom: Spacing[5],
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Centered spinner for checking / adding phases
  centeredBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[8],
    gap: Spacing[4],
  },
  loadingLabel: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Card-style content block for all named phases
  stateBlock: {
    alignItems: 'center',
    paddingTop: Spacing[3],
    gap: Spacing[3],
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[2],
    boxShadow: '0px 0px 28px rgba(78, 222, 163, 0.22)',
  } as any,
  stateIconSuccess: {
    boxShadow: '0px 0px 32px rgba(78, 222, 163, 0.30)',
  } as any,
  stateIconWarning: {
    backgroundColor: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.28)',
    boxShadow: '0px 0px 24px rgba(251, 191, 36, 0.18)',
  } as any,
  stateIconError: {
    backgroundColor: Colors.errorBg,
    borderColor: Colors.errorBorder,
    boxShadow: 'none',
  } as any,
  stateTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  stateTitleWarning: {
    color: Colors.warning,
  },
  stateTitleError: {
    color: Colors.error,
  },
  stateDesc: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: Spacing[2],
  },

  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    boxShadow: '0px 0px 22px rgba(78, 222, 163, 0.30)',
  } as any,
  primaryBtnWarning: {
    backgroundColor: Colors.warning,
    boxShadow: '0px 0px 18px rgba(251, 191, 36, 0.25)',
  } as any,
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },

  textBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
  },
  textBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
});
