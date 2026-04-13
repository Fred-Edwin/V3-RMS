'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { EmptyState, Spinner } from '@/components/ui';
import { commsService } from '@/services/commsService';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';
import type { FormalNoticeRecord } from '@/types/comms';

interface Props {
  onSelect: (notice: FormalNoticeRecord) => void;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function NoticeList({ onSelect }: Props) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const lastReceivedNotice = useCommsStore((s) => s.lastReceivedNotice);

  const [notices, setNotices] = useState<FormalNoticeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const result = await commsService.getNotices(accessToken, { page: 1, perPage: 30 });
      setNotices(result.data);
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
      const result = await commsService.getNotices(accessToken, { page: nextPage, perPage: 30 });
      setNotices((prev) => [...prev, ...result.data]);
      setPage(nextPage);
      setHasMore(result.pagination.page < result.pagination.totalPages);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, hasMore, loadingMore, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (lastReceivedNotice) void load();
  }, [lastReceivedNotice, load]);

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

  if (notices.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={32} />}
        heading="No formal notices"
        body="Official HR notices will appear here"
      />
    );
  }

  // Count notices issued TO the current user that are pending ack
  const pendingCount = notices.filter(
    (n) => !n.myAcknowledgedAt && n.issuer.id !== currentUserId,
  ).length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Urgency banner — espresso */}
      {pendingCount > 0 && (
        <div className="bg-[#F5F0E8] border-b border-[#E8E0D5] px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-[#2C1810] shrink-0" />
          <p className="text-sm text-[#2C1810] font-medium">
            {pendingCount} notice{pendingCount > 1 ? 's' : ''} require{pendingCount === 1 ? 's' : ''} your acknowledgement
          </p>
        </div>
      )}

      <ul>
        {notices.map((n) => {
          const isPending = !n.myAcknowledgedAt;
          return (
            <li key={n.id} className="border-b border-[#E8E0D5]">
              <button
                type="button"
                onClick={() => onSelect(n)}
                className="relative w-full flex items-start gap-3 px-4 py-3.5 text-left bg-white hover:bg-[#F5F0E8] transition-colors"
              >
                {/* Pending left accent — espresso */}
                {isPending && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2C1810] rounded-r-sm" />
                )}

                {/* Icon box */}
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isPending ? 'bg-[#EDE7DC] border border-[#D6D3D1]' : 'bg-[#F0FDF4] border border-[#BBF7D0]'
                }`}>
                  <FileText size={15} className={isPending ? 'text-[#2C1810]' : 'text-[#16A34A]'} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${isPending ? 'font-semibold text-[#1C1917]' : 'font-medium text-[#44403C]'}`}>
                      {n.subject}
                    </span>
                    <span className="text-xs text-[#8B7355] shrink-0">{formatDate(n.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#8B7355]">{n.issuer.name}</span>
                    {isPending ? (
                      <span className="inline-flex items-center rounded-full bg-[#EDE7DC] text-[#2C1810] border border-[#D6D3D1] text-[10px] font-semibold px-2 py-0.5">
                        Action required
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0] text-[10px] font-semibold px-2 py-0.5">
                        ✓ Acknowledged
                      </span>
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
