'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Building2, CreditCard, FileText, GitBranch, LayoutDashboard, LineChart, MessageSquare, Percent, Settings2, ShieldAlert, Tags, UserCircle } from 'lucide-react';
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
  collapsed?: boolean;
}

export function DirectorSidebarNav({ collapsed }: DirectorSidebarNavProps): JSX.Element {
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
          { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
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
        label: 'Operations',
        items: [
          { label: 'Incident Log', href: '/app/director/incidents', icon: ShieldAlert },
          { label: 'Discounts', href: '/app/admin/discounts', icon: Percent },
          { label: 'Branch Settings', href: '/app/director/settings', icon: Settings2 },
          { label: 'Payslips', href: '/app/hr/payslips', icon: FileText },
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
    <SidebarNav sections={sections} activeHref={pathname} collapsed={collapsed} />
  );
}
