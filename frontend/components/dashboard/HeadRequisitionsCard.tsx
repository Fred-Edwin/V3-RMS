'use client';

import Link from 'next/link';
import { ClipboardList } from 'lucide-react';

import { useAuthStore } from '@/store/authStore';

/**
 * A department head's shortcut from the floor dashboard to their Requisitions home (UX walk F12). Heads only: everyone else sees
 * nothing, because the Requisitions row is in their menu only when they are a head.
 */
export function HeadRequisitionsCard() {
  const isDepartmentHead = useAuthStore((state) => state.isDepartmentHead);
  if (!isDepartmentHead) return null;

  return (
    <Link
      href="/app/requisitions"
      className="flex items-center gap-3 rounded-xl border border-[#EEDDCC] bg-[#F8F2EC] px-4 py-3 transition-colors hover:bg-[#EEDDCC] focus-visible:outline-none focus-visible:shadow-focus"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEDDCC]">
        <ClipboardList size={18} className="text-[#693C1B]" />
      </div>
      <div className="min-w-0">
        <p className="text-label-md font-semibold text-[#693C1B]">Requisitions</p>
        <p className="text-body-sm text-[#693C1B] opacity-70">Ask the Central Store for what your department needs</p>
      </div>
    </Link>
  );
}
