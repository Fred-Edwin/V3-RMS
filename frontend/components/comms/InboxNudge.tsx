'use client';

import Link from 'next/link';
import { MessageSquare, ChevronRight, Bell } from 'lucide-react';
import { useCommsStore } from '@/store/commsStore';

/**
 * Ambient inbox awareness card for dashboard pages.
 * Shows nothing when there are no unread messages.
 * Formal notices (require acknowledgement) render with higher urgency.
 */
export function InboxNudge() {
  const dmCount = useCommsStore((s) => s.unreadDmCount);
  const broadcastCount = useCommsStore((s) => s.unreadBroadcastCount);
  const noticeCount = useCommsStore((s) => s.unreadNoticeCount);

  const totalUnread = dmCount + broadcastCount + noticeCount;

  // Nothing to show
  if (totalUnread === 0) return null;

  // Formal notices take priority — they require acknowledgement
  if (noticeCount > 0) {
    return (
      <Link
        href="/app/inbox"
        className="flex items-center gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 transition-colors hover:bg-[#FEF3C7] active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FCD34D]/40">
          <Bell size={16} className="text-[#92400E]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-[#78350F]">
            {noticeCount === 1
              ? '1 formal notice requires your acknowledgement'
              : `${noticeCount} formal notices require your acknowledgement`}
          </p>
          {(dmCount + broadcastCount) > 0 && (
            <p className="text-caption text-[#92400E]">
              +{dmCount + broadcastCount} other unread {dmCount + broadcastCount === 1 ? 'message' : 'messages'}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="shrink-0 text-[#92400E]" />
      </Link>
    );
  }

  // Regular unread messages
  const parts: string[] = [];
  if (dmCount > 0) parts.push(`${dmCount} DM${dmCount > 1 ? 's' : ''}`);
  if (broadcastCount > 0) parts.push(`${broadcastCount} broadcast${broadcastCount > 1 ? 's' : ''}`);
  const summary = parts.join(' · ');

  return (
    <Link
      href="/app/inbox"
      className="flex items-center gap-3 rounded-xl border border-[#C4B49A]/40 bg-[#F5F0E8] px-4 py-3 transition-colors hover:bg-[#EDE7DC] active:scale-[0.99]"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2C1810]/10">
        <MessageSquare size={16} className="text-[#2C1810]" />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#9B3A2A] px-1 text-[10px] font-bold leading-none text-white">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold text-[#2C1810]">
          {totalUnread === 1 ? '1 unread message' : `${totalUnread} unread messages`}
        </p>
        <p className="text-caption text-stone-500">{summary}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-[#2C1810]" />
    </Link>
  );
}
