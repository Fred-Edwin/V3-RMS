'use client';

import { useEffect, useRef } from 'react';
import { useCommsStore } from '@/store/commsStore';
import { useToastStore } from '@/store/toastStore';

/**
 * Watches incoming comms socket events and fires an arrival toast.
 * Mount once from the app shell — reads from commsStore which is already
 * populated by useCommsSocket.
 */
export function useMessageToast(): void {
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  const lastDm = useCommsStore((s) => s.lastReceivedDm);
  const lastBroadcast = useCommsStore((s) => s.lastReceivedBroadcast);
  const lastNotice = useCommsStore((s) => s.lastReceivedNotice);

  // Track what we've already toasted so re-renders don't re-fire
  const toastedDmId = useRef<string | null>(null);
  const toastedBroadcastId = useRef<string | null>(null);
  const toastedNoticeId = useRef<string | null>(null);

  // DM arrival
  useEffect(() => {
    if (!lastDm) return;
    const key = `${lastDm.conversationId}:${lastDm.message.id}`;
    if (toastedDmId.current === key) return;
    toastedDmId.current = key;

    const id = addToast({
      variant: 'info',
      title: `💬 ${lastDm.message.senderName}`,
      message: 'Sent you a message — tap to reply.',
    });
    setTimeout(() => removeToast(id), 5000);
  }, [lastDm, addToast, removeToast]);

  // Broadcast arrival
  useEffect(() => {
    if (!lastBroadcast) return;
    const key = lastBroadcast.broadcastId;
    if (toastedBroadcastId.current === key) return;
    toastedBroadcastId.current = key;

    const id = addToast({
      variant: 'info',
      title: `📢 ${lastBroadcast.senderName}`,
      message: lastBroadcast.subject,
    });
    setTimeout(() => removeToast(id), 6000);
  }, [lastBroadcast, addToast, removeToast]);

  // Formal notice — highest urgency, warning variant, longer duration
  useEffect(() => {
    if (!lastNotice) return;
    const key = lastNotice.noticeId;
    if (toastedNoticeId.current === key) return;
    toastedNoticeId.current = key;

    const id = addToast({
      variant: 'warning',
      title: '🔴 Formal Notice',
      message: `From ${lastNotice.issuerName}: "${lastNotice.subject}" — go to Inbox to acknowledge.`,
    });
    setTimeout(() => removeToast(id), 10000);
  }, [lastNotice, addToast, removeToast]);
}
