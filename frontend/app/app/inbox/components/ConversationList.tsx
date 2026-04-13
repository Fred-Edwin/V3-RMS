'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { EmptyState, Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { DirectConversationRecord } from '@/types/comms';
import { avatarColour, initials } from './InboxShell';

interface Props {
  activeConversationId: string | null;
  onSelect: (conv: DirectConversationRecord) => void;
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ConversationList({ activeConversationId, onSelect }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const lastReceivedDm = useCommsStore((s) => s.lastReceivedDm);
  const typingUsers = useCommsStore((s) => s.typingUsers);

  const [conversations, setConversations] = useState<DirectConversationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await commsService.getConversations(accessToken, { limit: 30 });
      setConversations(result.conversations);
      setNextCursor(result.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await commsService.getConversations(accessToken, { limit: 30, cursor: nextCursor });
      setConversations((prev) => [...prev, ...result.conversations]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, nextCursor, loadingMore]);

  useEffect(() => { void load(); }, [load]);

  // Refresh list when a new DM arrives
  useEffect(() => {
    if (lastReceivedDm) void load();
  }, [lastReceivedDm, load]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor) void loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle size={32} />}
        heading="No conversations"
        body="Tap the button below to start a conversation"
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <ul>
        {conversations.map((conv) => {
          const isActive = conv.id === activeConversationId;
          const isUnread = conv.unreadCount > 0;
          const typingName = typingUsers[conv.id];

          const preview = typingName
            ? null // show typing indicator below
            : conv.lastMessage
              ? conv.lastMessage.isDeleted
                ? 'Message deleted'
                : conv.lastMessage.bodyHtml.replace(/<[^>]*>/g, '').trim().slice(0, 60)
              : 'No messages yet';

          const name = conv.otherParticipant.name;
          const colourClass = avatarColour(name);
          const abbr = initials(name);

          return (
            <li key={conv.id} className="border-b border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => onSelect(conv)}
                className={`relative w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  isActive ? 'bg-[#EDE7DC] border-l-[3px] border-[#2C1810]' : 'bg-white hover:bg-[#F5F0E8]'
                }`}
              >
                {/* Unread left accent (when not active) */}
                {isUnread && !isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2C1810] rounded-r-sm" />
                )}

                {/* Avatar with presence dot placeholder */}
                <div className="relative shrink-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${colourClass}`}>
                    {abbr}
                  </div>
                  {/* Presence dot — hidden until backend supports online presence */}
                  {/* <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" /> */}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${isUnread ? 'font-semibold text-[#1C1917]' : 'font-medium text-[#44403C]'}`}>
                      {name}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs text-[#8B7355] shrink-0">
                        {formatRelativeTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    {typingName ? (
                      <p className="text-xs text-[#2C1810] italic">typing…</p>
                    ) : (
                      <p className={`text-xs truncate ${isUnread ? 'text-[#44403C] font-medium' : 'text-[#8B7355]'}`}>
                        {preview}
                      </p>
                    )}
                    {isUnread && (
                      <span className="shrink-0 bg-[#2C1810] text-[#F5F0E8] text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      )}
    </div>
  );
}
