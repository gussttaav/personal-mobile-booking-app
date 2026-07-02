// In-session chat Realtime lifecycle (S15 Pass B).
//
// SCOPE FENCE: this hook + the lib/supabase.ts client it drives are for in-session CHAT
// ONLY. Payment confirmation is deliberately POLL-ONLY (see lib/payment-confirmation.ts /
// CLAUDE.md). Do NOT reuse this hook or the Supabase client for payments or introduce a
// general Realtime path off the back of it.
//
// Owns the whole subscription so the chat panel's open/close is pure UI — the channel
// stays subscribed while the panel is closed (to collect backlog and drive the unread
// badge). Layered onto the Pass A video session as a separate concern; it touches nothing
// in the Zoom lifecycle. Teardown is idempotent and released both on unmount (covers every
// video exit path, since they all unmount the room) and imperatively via the returned
// `teardown` so the room's own teardown() releases the socket immediately on Leave.

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from './api-client';
import { getStoredSession } from './auth';
import { mergeMessages } from './chat';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ChatMessage } from '../types/api';

const MAX_TEXT = 1000;

export type ChatStatus = 'idle' | 'connecting' | 'open' | 'error';

export interface UseChatSession {
  messages: ChatMessage[];
  status: ChatStatus;
  /** The signed-in user's email — the panel compares it to senderEmail for own-vs-tutor. */
  currentEmail: string | undefined;
  /** Trim + ≤1000-char send; POST only (the bubble appears when the broadcast echoes).
   *  Resolves true when the POST succeeded (caller can clear its input), false on failure. */
  send: (text: string) => Promise<boolean>;
  sending: boolean;
  /** True after a failed send; cleared on the next attempt. The caller keeps the text for retry. */
  sendError: boolean;
  unreadCount: number;
  /** Tell the hook whether the panel is on screen: opening zeroes unread and suppresses further counting. */
  setPanelVisible: (visible: boolean) => void;
  /** Idempotent — releases the Realtime channel. Also runs on unmount. */
  teardown: () => void;
}

export function useChatSession({
  eventId,
  enabled,
}: {
  eventId: string;
  enabled: boolean;
}): UseChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const toreDownRef = useRef(false);
  const sendingRef = useRef(false);
  const panelVisibleRef = useRef(false);

  const currentEmail = getStoredSession()?.user.email;

  const teardown = useCallback(() => {
    if (toreDownRef.current) return;
    toreDownRef.current = true;
    if (channelRef.current) {
      // removeChannel unsubscribes and drops the socket subscription.
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  const setPanelVisible = useCallback((visible: boolean) => {
    panelVisibleRef.current = visible;
    if (visible) setUnreadCount(0);
  }, []);

  const send = useCallback(
    async (raw: string): Promise<boolean> => {
      const text = raw.trim().slice(0, MAX_TEXT);
      if (!text || sendingRef.current) return false;
      sendingRef.current = true;
      setSending(true);
      setSendError(false);
      try {
        // Source of truth is the POST; the message renders when its own broadcast echoes
        // back (deduped by id in mergeMessages) — no optimistic bubble.
        await api.postChatSession({ eventId, text });
        return true;
      } catch {
        // Never silently drop — surface the failure; the caller keeps the text for retry.
        setSendError(true);
        return false;
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (!enabled || !eventId) return;

    let cancelled = false;
    toreDownRef.current = false;
    setStatus('connecting');

    // Fetch the handshake backlog and merge it in. Called once up front (also yields the
    // channelName to subscribe with) and again on every SUBSCRIBED (reconnect / gap recovery).
    async function fetchBacklog(): Promise<string | null> {
      try {
        const res = await api.getChatSessionChannel({ eventId });
        if (cancelled) return null;
        setMessages((prev) => mergeMessages(prev, res.initialMessages));
        return res.channelName;
      } catch {
        if (!cancelled) setStatus('error');
        return null;
      }
    }

    (async () => {
      const channelName = await fetchBacklog();
      if (cancelled || !channelName) return;

      const channel = supabase.channel(channelName);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'message' }, ({ payload }) => {
          if (cancelled) return;
          const incoming = payload as ChatMessage;
          setMessages((prev) => mergeMessages(prev, [incoming]));
          // Count unread only while the panel is closed and only for the other party.
          if (!panelVisibleRef.current && incoming.senderEmail !== currentEmail) {
            setUnreadCount((n) => n + 1);
          }
        })
        .subscribe((subStatus) => {
          if (cancelled) return;
          if (subStatus === 'SUBSCRIBED') {
            setStatus('open');
            // Reconcile: recover any broadcast missed in the snapshot→subscribe gap or during
            // a socket drop (SUBSCRIBED fires on first subscribe AND on reconnect). Dedup makes
            // the re-merge safe.
            void fetchBacklog();
          } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
            setStatus('error');
          }
        });
    })();

    return () => {
      cancelled = true;
      teardown();
    };
    // currentEmail is derived synchronously and stable for the session; teardown is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, enabled]);

  return {
    messages,
    status,
    currentEmail,
    send,
    sending,
    sendError,
    unreadCount,
    setPanelVisible,
    teardown,
  };
}
