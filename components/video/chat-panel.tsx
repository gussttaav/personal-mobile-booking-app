// In-session chat panel (S15 Pass B) — the "chat abierto" bottom sheet from
// docs/design/screens/Sala de Video.dc.html (STATE 4). Pure presentational: all state
// comes from props (owned by lib/use-chat-session.ts). Rendered as an absolute overlay so
// the live video stays active/visible above the sheet ("vídeo activo con panel de chat").

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { useLocale } from '@/lib/i18n/locale-context';
import type { ChatMessage } from '@/types/api';

const MAX_TEXT = 1000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return '';
  }
}

function MessageBubble({
  message,
  own,
  youLabel,
}: {
  message: ChatMessage;
  own: boolean;
  youLabel: string;
}) {
  const name = own ? youLabel : message.senderName || 'Gustavo';
  const time = formatTime(message.sentAt);
  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowTutor]}>
      {!own && (
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account" size={16} color={Colors.secondary} />
        </View>
      )}
      <View style={styles.bubbleCol}>
        <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleTutor]}>
          <Text style={[styles.bubbleText, own && styles.bubbleTextOwn]}>{message.text}</Text>
        </View>
        <Text style={[styles.meta, own ? styles.metaOwn : styles.metaTutor]}>
          {time ? `${name} · ${time}` : name}
        </Text>
      </View>
    </View>
  );
}

export function ChatPanel({
  visible,
  onClose,
  messages,
  currentEmail,
  onSend,
  sending,
  sendError,
}: {
  visible: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentEmail: string | undefined;
  onSend: (text: string) => Promise<boolean>;
  sending: boolean;
  sendError: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useLocale();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // SDK 54's Android edge-to-edge default does NOT resize/pan the window for the keyboard,
  // and this panel is an absolute overlay (kept so the live video stays visible above it) —
  // so KeyboardAvoidingView can't lift it, and the raw Keyboard API under-reports the height
  // on some Android OEMs (it excludes the gesture-nav region). Reanimated's useAnimatedKeyboard
  // is edge-to-edge-aware and reports the true inset; lift the sheet by max(keyboard, safe-area
  // bottom) so it clears the keyboard when open and the gesture bar when closed. Reanimated is
  // already compiled in (Reanimated 4) — no native dep / no rebuild.
  const keyboard = useAnimatedKeyboard();
  // Animated bottom padding INSIDE the sheet: the sheet background stays flush to the screen
  // bottom (extends behind the keyboard when open), while its content — including the input
  // row — is pushed up to clear the keyboard when open, or the gesture bar when closed.
  const sheetAnimStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const canSend = draft.trim().length > 0 && !sending;
  const submit = useCallback(async () => {
    if (!canSend) return;
    // wait-for-broadcast: clear the input only once the POST succeeds (the bubble appears
    // when the echo lands). On failure keep the text so the user can retry.
    const ok = await onSend(draft);
    if (ok) setDraft('');
  }, [canSend, draft, onSend]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Tap the still-visible (dimmed) video above the sheet to close. */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('room.chat.close')}
      />
      <View style={styles.kav}>
        <Animated.View style={[styles.sheet, sheetAnimStyle]}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.header}>
            <MaterialCommunityIcons name="message-text-outline" size={18} color={Colors.primary} />
            <Text style={styles.headerTitle}>{t('room.chat.headerTitle')}</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('room.chat.close')}
            >
              <MaterialCommunityIcons name="close" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('room.chat.empty')}</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.list}
              data={messages}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  own={!!currentEmail && item.senderEmail === currentEmail}
                  youLabel={t('room.chat.you')}
                />
              )}
              contentContainerStyle={styles.listContent}
              onContentSizeChange={scrollToEnd}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {sendError && <Text style={styles.sendError}>{t('room.chat.sendError')}</Text>}

          {/* Bottom clearance (keyboard / gesture bar) lives on the sheet's animated padding. */}
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={t('room.chat.inputPlaceholder')}
                placeholderTextColor={Colors.textDim}
                multiline
                maxLength={MAX_TEXT}
                onSubmitEditing={submit}
                blurOnSubmit={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={submit}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('room.chat.send')}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color={Colors.onPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    // A DEFINITE height (not maxHeight) so the message FlatList's flex:1 has a height to
    // distribute — with only maxHeight the auto-sized sheet gives the flex child 0 height and
    // the list disappears. 80% ≈ the design's chat-open sheet; the animated bottom padding
    // shrinks the list area when the keyboard is up.
    height: '80%',
    backgroundColor: Colors.surfaceContainer,
    borderTopLeftRadius: Radius['5xl'],
    borderTopRightRadius: Radius['5xl'],
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0 -18px 50px rgba(0, 0, 0, 0.5)',
  },

  grabberWrap: {
    alignItems: 'center',
    paddingTop: Spacing[2],
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderVariant,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2] + 2,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2] + 2,
    paddingBottom: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    flex: 1,
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  list: {
    // Absorbs the sheet's height changes (keyboard padding grows/shrinks) and scrolls,
    // keeping the header pinned at top and the input above the keyboard.
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
    gap: Spacing[3],
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2] + 1,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowTutor: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCol: {
    maxWidth: '74%',
  },
  bubble: {
    paddingVertical: 9,
    paddingHorizontal: Spacing[3],
    borderWidth: 1,
  },
  bubbleTutor: {
    backgroundColor: Colors.surfaceHigh,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    borderBottomRightRadius: Radius['3xl'],
    borderBottomLeftRadius: Radius.sm,
  },
  bubbleOwn: {
    backgroundColor: 'rgba(78, 222, 163, 0.16)',
    borderColor: 'rgba(78, 222, 163, 0.28)',
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    borderBottomRightRadius: Radius.sm,
    borderBottomLeftRadius: Radius['3xl'],
  },
  bubbleText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.text,
  },
  bubbleTextOwn: {
    color: '#d4f3e3',
  },
  meta: {
    ...TypeScale.caption,
    fontSize: 10,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    marginTop: 5,
  },
  metaOwn: {
    textAlign: 'right',
    marginRight: Spacing[1],
  },
  metaTutor: {
    marginLeft: Spacing[1],
  },

  sendError: {
    ...TypeScale.caption,
    fontFamily: FontFamily.body,
    color: Colors.error,
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[2],
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2] + 2,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: Colors.surfaceLowest,
    borderWidth: 1,
    borderColor: 'rgba(78, 222, 163, 0.3)',
    borderRadius: Radius['4xl'],
    paddingHorizontal: Spacing[4],
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
  },
  input: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.text,
    maxHeight: 96,
    padding: 0,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(78, 222, 163, 0.4)',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
