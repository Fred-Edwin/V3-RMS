'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, BarChart2, Building2, CreditCard, GitBranch, LayoutDashboard, LineChart, LogOut, Tags, UserCircle } from 'lucide-react';
import { env } from '@/lib/env';
import { branchService, type BranchDto } from '@/services/branchService';
import { useAuthStore } from '@/store/authStore';
import { SidebarNav } from './SidebarNav';
import type { NavSection } from './SidebarNav';

// Credit account paths hidden when creditAccounts feature flag is off
const CREDIT_PATHS = new Set([
  '/app/director/corporate-accounts',
  '/app/director/outstanding-balances',
  '/app/manage/my-tab',
]);

interface DirectorSidebarNavProps {
  onLogout: () => void;
}

export function DirectorSidebarNav({ onLogout }: DirectorSidebarNavProps): JSX.Element {
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [branches, setBranches] = useState<BranchDto[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    branchService.listBranches(accessToken).then((data) => {
      // Exclude the hub (Central Kitchen) — supply facility, not a customer-facing branch
      setBranches(data.filter((b) => b.isActive && !b.isHub));
    }).catch(() => {
      // Non-critical — sidebar still renders without branch sub-links
    });
  }, [accessToken]);

  const sections = useMemo<NavSection[]>(() => {
    const all: NavSection[] = [
      {
        label: 'Overview',
        items: [
          { label: 'Dashboard', href: '/app/director', icon: LayoutDashboard },
          { label: 'Analytics', href: '/app/director/analytics', icon: LineChart },
        ],
      },
      ...(branches.length > 0
        ? [
            {
              label: 'Branches',
              items: branches.map((branch) => ({
                label: branch.name,
                href: `/app/director/branches/${branch.id}`,
                icon: GitBranch,
              })),
            },
          ]
        : []),
      {
        label: 'Other Income',
        items: [
          { label: 'Categories & Entries', href: '/app/director/other-income', icon: Tags },
        ],
      },
      {
        label: 'Credit',
        items: [
          { label: 'Corporate Accounts', href: '/app/director/corporate-accounts', icon: Building2 },
          { label: 'Outstanding Balances', href: '/app/director/outstanding-balances', icon: AlertTriangle },
          { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
        ],
      },
      {
        items: [{ label: 'Analytics', href: '/app/director/analytics', icon: BarChart2 }],
      },
      {
        label: 'Account',
        items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
      },
    ];

    if (env.creditAccounts) return all;

    // Strip credit feature paths when flag is off
    return all
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !CREDIT_PATHS.has(item.href)),
      }))
      .filter((section) => section.items.length > 0);
  }, [branches]);

  return (
    <div className="flex h-full flex-col">
      <SidebarNav sections={sections} activeHref={pathname} />
      <div className="border-t border-stone-200 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-label-md font-medium text-stone-700 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-900"
        >
          <LogOut size={18} className="text-stone-500" />
          Logout
        </button>
      </div>
    </div>
  );
}
