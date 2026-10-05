'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  BarChart2,
  Calendar,
  CalendarOff,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  FileText,
  LayoutDashboard,
  MessageSquare,
  ShoppingCart,
  UserCircle,
} from 'lucide-react';
import { BottomNav, MobileLayout, type NavTab } from '@/components/ui';
import { ShellProvider } from '@/lib/shell-context';
import { useAuthStore } from '@/store/authStore';
import { useCommsStore } from '@/store/commsStore';

/**
 * The legacy phone layout for the FLOOR STAFF only: the old bottom tabs and "More" overflow, kept exactly as they were. Every other
 * role now uses the one shell at every width (`components/app/shell/app-shell.tsx`, a menu drawer on phones). The floor staff stay
 * here until their screens are rebuilt. It lives beside the layout, not in `components/app/shell/`, because it is built on the
 * frozen `components/ui/` design system, which the new shell must not import. When the last floor role moves into the shell,
 * delete this folder, `BottomNav` and `MobileLayout`.
 */

type MobileRole = 'WAITER' | 'CHEF' | 'BARISTA' | 'STEWARD' | 'HOUSEKEEPING';

interface MobileRoleNavConfig {
  tabs: NavTab[];
  overflowTabs: NavTab[];
}

const mobileRoleTabs: Record<MobileRole, MobileRoleNavConfig> = {
  WAITER: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'New Order', href: '/app/orders/new', icon: ShoppingCart },
      { label: 'Orders', href: '/app/orders', icon: ClipboardList },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
    ],
    overflowTabs: [
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'Other Income', href: '/app/other-income/new', icon: Banknote },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'History', href: '/app/history', icon: Clock },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  CHEF: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Kitchen', href: '/app/kitchen', icon: ChefHat },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'History', href: '/app/history', icon: Clock },
    ],
    overflowTabs: [
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  BARISTA: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Barista', href: '/app/barista', icon: Coffee },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'History', href: '/app/history', icon: Clock },
    ],
    overflowTabs: [
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  STEWARD: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
    ],
  },
  HOUSEKEEPING: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
    ],
  },
};

interface LegacyPhoneShellProps {
  children: React.ReactNode;
  className?: string;
}

export function LegacyPhoneShell({ children, className }: LegacyPhoneShellProps): JSX.Element {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.role);
  const isDepartmentHead = useAuthStore((state) => state.isDepartmentHead);
  // Total unread count for the Inbox badge — derived from all three channels
  const unreadInbox = useCommsStore((s) => s.unreadDmCount + s.unreadBroadcastCount + s.unreadNoticeCount);

  const mobileNavConfig = useMemo(() => {
    if (!role || !(role in mobileRoleTabs)) return null;
    const config = mobileRoleTabs[role as MobileRole];
    // A department head's base-role tabs plus "Dept Shifts" and "Requisitions" overflow entries.
    const withDeptHead: MobileRoleNavConfig = isDepartmentHead
      ? {
          tabs: config.tabs,
          overflowTabs: [
            { label: 'Dept Shifts', href: '/app/department/shifts', icon: Calendar },
            { label: 'Requisitions', href: '/app/requisitions', icon: ClipboardList },
            ...config.overflowTabs,
          ],
        }
      : config;
    // Inject unread badge on the Inbox tab
    return {
      tabs: withDeptHead.tabs.map((t) => (t.href === '/app/inbox' && unreadInbox > 0 ? { ...t, badge: unreadInbox } : t)),
      overflowTabs: withDeptHead.overflowTabs.map((t) => (t.href === '/app/inbox' && unreadInbox > 0 ? { ...t, badge: unreadInbox } : t)),
    };
  }, [role, isDepartmentHead, unreadInbox]);

  return (
    <MobileLayout
      className={className}
      bottomNav={mobileNavConfig ? <BottomNav tabs={mobileNavConfig.tabs} overflowTabs={mobileNavConfig.overflowTabs} activeHref={pathname} /> : undefined}
    >
      <ShellProvider value="mobile">{children}</ShellProvider>
    </MobileLayout>
  );
}
