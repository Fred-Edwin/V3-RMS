'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, AlertTriangle } from 'lucide-react';
import { EmptyState, Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { BroadcastRecord } from '@/types/comms';

interface Props {
  onSelect: (broadcast: BroadcastRecord) => void;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  });
}

export function BroadcastList({ onSelect }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const lastReceivedBroadcast = useCommsStore((s) => s.lastReceivedBroadcast);

  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await commsService.getBroadcasts(accessToken, { page: 1, perPage: 30 });
      setBroadcasts(result.data);
      setPage(1);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !hasMore || loadingMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await commsService.getBroadcasts(accessToken, { page: nextPage, perPage: 30 });
      setBroadcasts((prev) => [...prev, ...result.data]);
      setPage(nextPage);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, hasMore, loadingMore, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (lastReceivedBroadcast) void load();
  }, [lastReceivedBroadcast, load]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) void loadMore();
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner />
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <EmptyState
        icon={<Megaphone size={32} />}
        heading="No broadcasts"
        body="Broadcasts sent by managers and directors will appear here"
      />
    );
  }

  const pendingAckCount = broadcasts.filter((b) => b.requiresAck && !b.myAcknowledgedAt && b.sender.id !== currentUserId).length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Urgency banner — orange */}
      {pendingAckCount > 0 && (
        <div className="bg-[#FFF7ED] border-b border-[#FED7AA] px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#EA580C] shrink-0" />
          <p className="text-sm text-[#9A3412] font-medium">
            {pendingAckCount} broadcast{pendingAckCount > 1 ? 's' : ''} require{pendingAckCount === 1 ? 's' : ''} your acknowledgement
          </p>
        </div>
      )}

      <ul>
        {broadcasts.map((b) => {
          const isSender = b.sender.id === currentUserId;
          const isUnread = !b.myReadAt && !isSender;

          return (
            <li key={b.id} className="border-b border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => onSelect(b)}
                className="relative w-full flex items-start gap-3 px-4 py-3.5 text-left bg-white hover:bg-[#F5F0E8] transition-colors"
              >
                {/* Unread left accent */}
                {isUnread && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2C1810] rounded-r-sm" />
                )}

                {/* Icon */}
                <div className="mt-0.5 w-9 h-9 rounded-full bg-[#EDE7DC] flex items-center justify-center shrink-0">
                  <Megaphone size={15} className="text-[#2C1810]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${isUnread ? 'font-semibold text-[#1C1917]' : 'font-medium text-[#44403C]'}`}>
                      {b.subject}
                    </span>
                    <span className="text-xs text-[#8B7355] shrink-0">{formatDate(b.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-[#8B7355]">{b.sender.name}</span>

                    {/* Sender delivery stats chip — blue */}
                    {isSender ? (
                      <span className="inline-flex items-center rounded-full bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD] text-[10px] font-semibold px-2 py-0.5">
                        {b.readCount}/{b.totalRecipients} read
                      </span>
                    ) : (
                      <>
                        {isUnread && (
                          <span className="inline-flex items-center rounded-full bg-[#2C1810] text-[#F5F0E8] text-[10px] font-semibold px-2 py-0.5">
                            New
                          </span>
                        )}
                        {b.requiresAck && !b.myAcknowledgedAt && (
                          <span className="inline-flex items-center rounded-full bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA] text-[10px] font-semibold px-2 py-0.5">
                            Ack required
                          </span>
                        )}
                        {b.requiresAck && b.myAcknowledgedAt && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] text-[10px] font-semibold px-2 py-0.5">
                            ✓ Acknowledged
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={sentinelRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      )}
    </div>
  );
}
