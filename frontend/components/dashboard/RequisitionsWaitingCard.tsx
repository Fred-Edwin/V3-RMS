'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

/**
 * The Branch Manager's "Needs your action" row for requisitions: how many lists are waiting (ready to approve, or already sent by at
 * least one department). Shows nothing when none wait. The count comes from the same R2 badge as the sidebar, so they always agree.
 */
export function RequisitionsWaitingCard({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Link
      href="/app/branch/requisitions"
      className="flex items-center gap-3 rounded-xl border border-[#EEDDCC] bg-[#F8F2EC] px-4 py-3 transition-colors hover:bg-[#EEDDCC] focus-visible:outline-none focus-visible:shadow-focus"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEDDCC]">
        <ClipboardList size={18} className="text-[#693C1B]" />
      </div>
      <div className="min-w-0">
        <p className="text-label-md font-semibold text-[#693C1B]">{count === 1 ? '1 requisition waiting' : `${count} requisitions waiting`}</p>
        <p className="text-body-sm text-[#693C1B] opacity-70">Open the queue to review and approve</p>
      </div>
    </Link>
  );
}
