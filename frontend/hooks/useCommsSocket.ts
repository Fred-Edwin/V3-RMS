'use client';

import { useCallback, useEffect } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { NewDirectMessagePayload, NewBroadcastPayload, NewFormalNoticePayload, TypingPayload } from '@/types/comms';

/**
 * Attaches comms socket listeners once from the app shell layout.
 * Updates commsStore with incoming messages so any page can react.
 */
export function useCommsSocket(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeConversationId = useCommsStore((s) => s.activeConversationId);

  const setLastReceivedDm = useCommsStore((s) => s.setLastReceivedDm);
  const setLastReceivedBroadcast = useCommsStore((s) => s.setLastReceivedBroadcast);
  const setLastReceivedNotice = useCommsStore((s) => s.setLastReceivedNotice);
  const incrementUnreadDm = useCommsStore((s) => s.incrementUnreadDm);
  const incrementUnreadBroadcast = useCommsStore((s) => s.incrementUnreadBroadcast);
  const incrementUnreadNotice = useCommsStore((s) => s.incrementUnreadNotice);
  const setTypingUser = useCommsStore((s) => s.setTypingUser);
  const clearTypingUser = useCommsStore((s) => s.clearTypingUser);

  const handleDm = useCallback(
    (payload: NewDirectMessagePayload) => {
      setLastReceivedDm(payload);
      // Only increment unread if the user isn't currently viewing that conversation
      if (activeConversationId !== payload.conversationId) {
        incrementUnreadDm();
      }
    },
    // activeConversationId intentionally in deps — badge should only suppress when conversation is open
    [activeConversationId, incrementUnreadDm, setLastReceivedDm],
  );

  const handleBroadcast = useCallback(
    (payload: NewBroadcastPayload) => {
      setLastReceivedBroadcast(payload);
      incrementUnreadBroadcast();
    },
    [incrementUnreadBroadcast, setLastReceivedBroadcast],
  );

  const handleNotice = useCallback(
    (payload: NewFormalNoticePayload) => {
      setLastReceivedNotice(payload);
      incrementUnreadNotice();
    },
    [incrementUnreadNotice, setLastReceivedNotice],
  );

  const handleTypingStart = useCallback(
    (payload: TypingPayload) => {
      setTypingUser(payload.conversationId, payload.userName);
    },
    [setTypingUser],
  );

  const handleTypingStop = useCallback(
    (payload: { conversationId: string; userId: string }) => {
      clearTypingUser(payload.conversationId);
    },
    [clearTypingUser],
  );

  useEffect(() => {
    if (!accessToken) return;

    connectSocket(accessToken);
    const socket = getSocket();
    if (!socket) return;

    socket.on('comms:dm_received', handleDm);
    socket.on('comms:broadcast_received', handleBroadcast);
    socket.on('comms:notice_received', handleNotice);
    // Safe no-ops if backend doesn't emit these yet
    socket.on('comms:typing_start', handleTypingStart);
    socket.on('comms:typing_stop', handleTypingStop);

    return () => {
      socket.off('comms:dm_received', handleDm);
      socket.off('comms:broadcast_received', handleBroadcast);
      socket.off('comms:notice_received', handleNotice);
      socket.off('comms:typing_start', handleTypingStart);
      socket.off('comms:typing_stop', handleTypingStop);
    };
  }, [accessToken, handleDm, handleBroadcast, handleNotice, handleTypingStart, handleTypingStop]);
}
