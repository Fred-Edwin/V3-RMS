'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  BarChart2,
  Bike,
  Building2,
  Calendar,
  CalendarOff,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Percent,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Tags,
  Trash2,
  Truck,
  UserCircle,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { BottomNav, ConfirmDialog, DirectorSidebarNav, MobileLayout, SidebarLayout, SidebarNav, type NavSection, type NavTab } from '@/components/ui';
import { env } from '@/lib/env';
import { ShellProvider } from '@/lib/shell-context';

// Paths that belong to the Phase 7 credit accounts feature.
// When env.creditAccounts is false these are stripped from nav and their pages redirect away.
const CREDIT_PATHS = new Set([
  '/app/admin/house-accounts',
  '/app/admin/corporate-accounts',
  '/app/director/corporate-accounts',
  '/app/director/outstanding-balances',
  '/app/manage/customer-credit',
  '/app/manage/outstanding-balances',
  '/app/manage/my-tab',
]);
import { performLogout } from '@/lib/logout';
import { useAuthStore } from '@/store/authStore';
import { useCommsSocket } from '@/hooks/useCommsSocket';
import { useMessageToast } from '@/hooks/useMessageToast';
import { useCommsStore } from '@/store/commsStore';
import type { AppRole } from '@/types/auth';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

type MobileRole = 'WAITER' | 'CHEF' | 'BARISTA' | 'MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN' | 'ACCOUNTANT' | 'HR_MANAGER' | 'STEWARD' | 'HOUSEKEEPING' | 'STORE_ATTENDANT' | 'STORE_MANAGER';

interface MobileRoleNavConfig {
  tabs: NavTab[];
  overflowTabs: NavTab[];
}

const mobileRoleTabs: Record<MobileRole, MobileRoleNavConfig> = {
  MANAGER: {
    tabs: [
      { label: 'Dashboard', href: '/app/manage/dashboard', icon: LayoutDashboard },
      { label: 'Orders', href: '/app/orders', icon: ShoppingCart },
      { label: 'History', href: '/app/history', icon: Clock },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
    ],
    overflowTabs: [
      { label: 'Analytics', href: '/app/manage/reports', icon: BarChart2 },
      { label: 'Staff', href: '/app/manage/staff', icon: Users },
      { label: 'Menu', href: '/app/manage/menu', icon: UtensilsCrossed },
      { label: 'Shifts', href: '/app/manage/shifts', icon: Calendar },
      { label: 'Delivery Zones', href: '/app/manage/delivery-zones', icon: Bike },
      { label: 'Incidents', href: '/app/manage/incidents', icon: AlertTriangle },
      { label: 'Customer Credit', href: '/app/manage/customer-credit', icon: CreditCard },
      { label: 'Outstanding', href: '/app/manage/outstanding-balances', icon: AlertTriangle },
      { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
      { label: 'Payslips', href: '/app/manage/payslips', icon: FileText },
      { label: 'Leave', href: '/app/manage/reports?tab=Leave', icon: CalendarOff },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  DIRECTOR: {
    tabs: [
      { label: 'Dashboard', href: '/app/director', icon: LayoutDashboard },
      { label: 'Analytics', href: '/app/director/analytics', icon: BarChart2 },
      { label: 'Incidents', href: '/app/director/incidents', icon: ShieldAlert },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
    ],
    overflowTabs: [
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
      { label: 'Branch Settings', href: '/app/director/settings', icon: Settings2 },
      { label: 'Discounts', href: '/app/admin/discounts', icon: Percent },
      { label: 'Corporate', href: '/app/director/corporate-accounts', icon: Building2 },
      { label: 'Outstanding', href: '/app/director/outstanding-balances', icon: AlertTriangle },
      { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
      { label: 'Payroll', href: '/app/hr/payroll', icon: FileText },
      { label: 'Leave', href: '/app/director/analytics?tab=Leave', icon: CalendarOff },
    ],
  },
  ACCOUNTANT: {
    tabs: [
      { label: 'Dashboard', href: '/app/accountant', icon: LayoutDashboard },
      { label: 'Reconcile', href: '/app/accountant/reconciliation', icon: Clock },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [
      { label: 'Credit Accounts', href: '/app/accountant/credit', icon: CreditCard },
      { label: 'My Payments', href: '/app/payslips', icon: FileText },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
    ],
  },
  SYSTEM_ADMIN: {
    tabs: [
      { label: 'Branches', href: '/app/admin', icon: Settings2 },
      { label: 'Menu', href: '/app/admin/menu', icon: UtensilsCrossed },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [
      { label: 'House Accts', href: '/app/admin/house-accounts', icon: CreditCard },
      { label: 'Corporate', href: '/app/admin/corporate-accounts', icon: Building2 },
    ],
  },
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
  HR_MANAGER: {
    tabs: [
      { label: 'HR', href: '/app/hr', icon: Users },
      { label: 'Staff', href: '/app/hr/staff', icon: UserCircle },
      { label: 'Leave', href: '/app/hr/leave', icon: Calendar },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
    ],
    overflowTabs: [
      { label: 'Calendar', href: '/app/hr/leave/calendar', icon: Calendar },
      { label: 'Attendance', href: '/app/hr/attendance', icon: BarChart2 },
      { label: 'Shifts', href: '/app/hr/shifts', icon: Calendar },
      { label: 'Payroll', href: '/app/hr/payroll', icon: FileText },
      { label: 'Contracts', href: '/app/hr/contract-types', icon: ScrollText },
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
  // Mobile-only per feature plan §8.0 — no sidebarSectionsByRole entry, so this
  // role never qualifies for usesDualShell/useSidebarOnlyShell below and always
  // renders the plain MobileLayout branch.
  STORE_ATTENDANT: {
    tabs: [
      { label: 'Dashboard', href: '/app/inventory/attendant-dashboard', icon: LayoutDashboard },
      { label: 'Stock', href: '/app/inventory/stock', icon: Package },
      { label: 'Receiving', href: '/app/inventory/receiving', icon: Truck },
      { label: 'Prep', href: '/app/inventory/prep', icon: Coffee },
    ],
    overflowTabs: [
      { label: 'Purchases', href: '/app/inventory/purchase-orders', icon: ClipboardList },
      { label: 'Stock Count', href: '/app/inventory/stock-counts', icon: ClipboardCheck },
      { label: 'Waste Log', href: '/app/inventory/waste', icon: Trash2 },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  // Desktop is the primary shell for this role (usesDualShell below); this
  // is the narrow-viewport nav for Session 8's real Manager mobile screens
  // (feature plan §8.1). Dashboard is the landing tab, matching
  // lib/role-home.ts (STORE_MANAGER lands on /app/inventory/dashboard on
  // both shells) — its mobile design is a stat-card grid + tap-through
  // panels into the real screens below, not the desktop table reflowed.
  STORE_MANAGER: {
    tabs: [
      { label: 'Dashboard', href: '/app/inventory/dashboard', icon: LayoutDashboard },
      { label: 'Stock', href: '/app/inventory/stock', icon: Package },
      { label: 'Purchases', href: '/app/inventory/purchase-orders', icon: ClipboardList },
      { label: 'Reports', href: '/app/inventory/reports', icon: FileBarChart },
    ],
    overflowTabs: [
      { label: 'Item Catalog', href: '/app/inventory/catalog', icon: Tags },
      { label: 'Suppliers', href: '/app/inventory/suppliers', icon: Users },
      { label: 'Prep', href: '/app/inventory/prep', icon: Coffee },
      { label: 'Stock Count', href: '/app/inventory/stock-counts', icon: ClipboardCheck },
      { label: 'Waste Log', href: '/app/inventory/waste', icon: Trash2 },
      { label: 'Store Staff', href: '/app/inventory/staff', icon: UserCircle },
      { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
      { label: 'Payslips', href: '/app/payslips', icon: FileText },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
};

const sidebarSectionsByRole: Partial<Record<AppRole, NavSection[]>> = {
  MANAGER: [
    {
      label: 'Operations',
      items: [
        { label: 'Dashboard', href: '/app/manage/dashboard', icon: LayoutDashboard },
        { label: 'Orders', href: '/app/orders', icon: ShoppingCart },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Analytics', href: '/app/manage/reports', icon: BarChart2 },
        { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Staff', href: '/app/manage/staff', icon: Users },
        { label: 'Menu', href: '/app/manage/menu', icon: UtensilsCrossed },
        { label: 'Shifts', href: '/app/manage/shifts', icon: Calendar },
        { label: 'Delivery Zones', href: '/app/manage/delivery-zones', icon: Bike },
        { label: 'Payslips', href: '/app/manage/payslips', icon: FileText },
      ],
    },
    {
      label: 'Credit',
      items: [
        { label: 'Customer Credit', href: '/app/manage/customer-credit', icon: CreditCard },
        { label: 'Outstanding Balances', href: '/app/manage/outstanding-balances', icon: AlertTriangle },
        { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
      ],
    },
    {
      label: 'Other Income',
      items: [
        { label: 'Record Income', href: '/app/other-income/new', icon: Banknote },
        { label: 'Income Entries', href: '/app/other-income/history', icon: Clock },
      ],
    },
    {
      items: [
        { label: 'Incidents', href: '/app/manage/incidents', icon: AlertTriangle },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  DIRECTOR: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/app/director', icon: LayoutDashboard },
        { label: 'Analytics', href: '/app/director/analytics', icon: BarChart2 },
        { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Incident Log', href: '/app/director/incidents', icon: ShieldAlert },
        { label: 'Discounts', href: '/app/admin/discounts', icon: Percent },
        { label: 'Branch Settings', href: '/app/director/settings', icon: Settings2 },
        { label: 'Payroll', href: '/app/hr/payroll', icon: FileText },
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
      label: 'Other Income',
      items: [
        { label: 'Categories & Entries', href: '/app/director/other-income', icon: Tags },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  ACCOUNTANT: [
    {
      label: 'Financials',
      items: [
        { label: 'Dashboard', href: '/app/accountant', icon: LayoutDashboard },
        { label: 'Reconciliation', href: '/app/accountant/reconciliation', icon: Clock },
        { label: 'Other Income', href: '/app/other-income/history', icon: Banknote },
        { label: 'My Payments', href: '/app/payslips', icon: FileText },
      ],
    },
    {
      label: 'Credit Accounts',
      items: [
        { label: 'Credit Accounts', href: '/app/accountant/credit', icon: CreditCard },
      ],
    },
    {
      label: 'Communications',
      items: [{ label: 'Inbox', href: '/app/inbox', icon: MessageSquare }],
    },
    {
      label: 'Leave',
      items: [{ label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff }],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  SYSTEM_ADMIN: [
    {
      label: 'Admin',
      items: [
        { label: 'Branches & Users', href: '/app/admin', icon: Settings2 },
        { label: 'Menu', href: '/app/admin/menu', icon: UtensilsCrossed },
        { label: 'House Accounts', href: '/app/admin/house-accounts', icon: CreditCard },
        { label: 'Corporate Accounts', href: '/app/admin/corporate-accounts', icon: Building2 },
      ],
    },
    {
      label: 'Communications',
      items: [{ label: 'Inbox', href: '/app/inbox', icon: MessageSquare }],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  WAITER: [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { label: 'New Order', href: '/app/orders/new', icon: ShoppingCart },
        { label: 'Orders', href: '/app/orders', icon: ClipboardList },
        { label: 'Shifts', href: '/app/shifts', icon: Calendar },
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Performance', href: '/app/performance', icon: BarChart2 },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
    {
      label: 'Other Income',
      items: [
        { label: 'Record Income', href: '/app/other-income/new', icon: Banknote },
        { label: 'Income History', href: '/app/other-income/history', icon: Clock },
      ],
    },
  ],
  CHEF: [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Kitchen', href: '/app/kitchen', icon: ChefHat },
        { label: 'Shifts', href: '/app/shifts', icon: Calendar },
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Performance', href: '/app/performance', icon: BarChart2 },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
  BARISTA: [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Barista', href: '/app/barista', icon: Coffee },
        { label: 'Shifts', href: '/app/shifts', icon: Calendar },
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Performance', href: '/app/performance', icon: BarChart2 },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
  HR_MANAGER: [
    {
      label: 'HR',
      items: [
        { label: 'HR Overview', href: '/app/hr', icon: LayoutDashboard },
        { label: 'Staff Profiles', href: '/app/hr/staff', icon: Users },
        { label: 'Contract Types', href: '/app/hr/contract-types', icon: ScrollText },
        { label: 'Leave Requests', href: '/app/hr/leave', icon: Calendar },
        { label: 'Leave Calendar', href: '/app/hr/leave/calendar', icon: Calendar },
        { label: 'Attendance', href: '/app/hr/attendance', icon: BarChart2 },
        { label: 'Shifts', href: '/app/hr/shifts', icon: Calendar },
        { label: 'Payroll', href: '/app/hr/payroll', icon: FileText },
        { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  STEWARD: [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Shifts', href: '/app/shifts', icon: Calendar },
        { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
  HOUSEKEEPING: [
    {
      label: 'Navigation',
      items: [
        { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
        { label: 'Shifts', href: '/app/shifts', icon: Calendar },
        { label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff },
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Inbox', href: '/app/inbox', icon: MessageSquare },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
  // Session 7 — Manager desktop screens (feature plan §8.1). Order follows
  // the session plan's screen list: landing dashboard, then Stock on Hand
  // (read) separate from Item Catalog (admin/setup) per the two screens'
  // distinct purposes, though they share underlying table plumbing.
  STORE_MANAGER: [
    {
      label: 'Central Store',
      items: [
        { label: 'Dashboard', href: '/app/inventory/dashboard', icon: LayoutDashboard },
        { label: 'Stock on Hand', href: '/app/inventory/stock', icon: Package },
        { label: 'Item Catalog', href: '/app/inventory/catalog', icon: Tags },
        { label: 'Suppliers', href: '/app/inventory/suppliers', icon: Users },
        { label: 'Purchases', href: '/app/inventory/purchase-orders', icon: ClipboardList },
      ],
    },
    {
      label: 'Prep',
      items: [
        { label: 'Prep Entry', href: '/app/inventory/prep', icon: Coffee },
      ],
    },
    {
      label: 'Counting',
      items: [
        { label: 'Stock Count', href: '/app/inventory/stock-counts', icon: ClipboardCheck },
        { label: 'Waste Log', href: '/app/inventory/waste', icon: Trash2 },
      ],
    },
    {
      label: 'Insights',
      items: [{ label: 'Reports', href: '/app/inventory/reports', icon: FileBarChart }],
    },
    {
      label: 'Team',
      items: [{ label: 'Store Staff', href: '/app/inventory/staff', icon: UserCircle }],
    },
    {
      label: 'Communications',
      items: [{ label: 'Inbox', href: '/app/inbox', icon: MessageSquare }],
    },
    {
      label: 'Leave',
      items: [{ label: 'My Leave', href: '/app/hr/my-leave', icon: CalendarOff }],
    },
    {
      label: 'Account',
      items: [
        { label: 'Payslips', href: '/app/payslips', icon: FileText },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
};

export default function AppLayout({ children }: AppShellLayoutProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const isDepartmentHead = useAuthStore((state) => state.isDepartmentHead);

  // Attach comms socket listeners for real-time inbox updates
  useCommsSocket();
  // Fire arrival toasts for incoming messages
  useMessageToast();

  // Total unread count for Inbox badge — derived from all three channels
  const unreadInbox = useCommsStore((s) => s.unreadDmCount + s.unreadBroadcastCount + s.unreadNoticeCount);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist sidebar collapsed state across page navigations
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored === 'true') setSidebarCollapsed(true);
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const isDisplayRoute = pathname.startsWith('/app/kitchen') || pathname.startsWith('/app/barista');
  const isDisplayOnlyRole = role === 'KITCHEN_DISPLAY' || role === 'BARISTA_DISPLAY';
  const isDesktopPreviewEnabled = env.roleDesktopPreview && process.env.NODE_ENV !== 'production';

  const sidebarSections = useMemo(() => {
    const baseSections = role ? (sidebarSectionsByRole[role] ?? []) : [];
    // A department head keeps their full base-role nav and gains one entry for
    // the department shift scheduler (marker model, 2026-09-03).
    const sections = isDepartmentHead
      ? [
          ...baseSections,
          {
            label: 'Department',
            items: [{ label: 'Department Shifts', href: '/app/department/shifts', icon: Calendar }],
          },
        ]
      : baseSections;
    const filtered = env.creditAccounts
      ? sections
      : sections
          .map((section) => ({ ...section, items: section.items.filter((item) => !CREDIT_PATHS.has(item.href)) }))
          .filter((section) => section.items.length > 0);
    // Inject unread badge on the Inbox nav item
    return filtered.map((section) => ({
      ...section,
      items: section.items.map((item) =>
        item.href === '/app/inbox' && unreadInbox > 0
          ? { ...item, badge: unreadInbox }
          : item,
      ),
    }));
  }, [role, isDepartmentHead, unreadInbox]);

  const mobileNavConfig = useMemo(() => {
    if (!role || !(role in mobileRoleTabs)) return null;
    const config = mobileRoleTabs[role as MobileRole];
    // A department head's base-role tabs plus one "Dept Shifts" overflow entry.
    const withDeptHead: MobileRoleNavConfig = isDepartmentHead
      ? {
          tabs: config.tabs,
          overflowTabs: [
            { label: 'Dept Shifts', href: '/app/department/shifts', icon: Calendar },
            ...config.overflowTabs,
          ],
        }
      : config;
    const filtered = env.creditAccounts
      ? withDeptHead
      : {
          tabs: withDeptHead.tabs.filter((t) => !CREDIT_PATHS.has(t.href)),
          overflowTabs: withDeptHead.overflowTabs.filter((t) => !CREDIT_PATHS.has(t.href)),
        };
    // Inject unread badge on the Inbox tab
    return {
      tabs: filtered.tabs.map((t) =>
        t.href === '/app/inbox' && unreadInbox > 0 ? { ...t, badge: unreadInbox } : t,
      ),
      overflowTabs: filtered.overflowTabs.map((t) =>
        t.href === '/app/inbox' && unreadInbox > 0 ? { ...t, badge: unreadInbox } : t,
      ),
    };
  }, [role, isDepartmentHead, unreadInbox]);

  const handleConfirmLogout = async (): Promise<void> => {
    setIsLoggingOut(true);
    try {
      await performLogout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
      setLogoutOpen(false);
    }
  };

  // Show a minimal loading indicator while session hydration is in progress
  if (!role && !isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-crema">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-amber-700" />
          <p className="text-body-sm text-stone-500">Loading…</p>
        </div>
      </div>
    );
  }

  if (!role || (isDisplayRoute && isDisplayOnlyRole)) {
    return <>{children}</>;
  }

  // Top header strip with app name + collapse toggle
  const SidebarHeader = () => (
    <div className="h-14 shrink-0 flex items-center border-b border-[#2C1810]/40 px-2 gap-2">
      {!sidebarCollapsed && (
        <span className="flex-1 px-2 text-[#F5F0E8] font-bold text-sm tracking-wide truncate">
          Wendo RMS
        </span>
      )}
      <button
        type="button"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-[#8B6B5A] hover:bg-[#2C1810] hover:text-[#F5F0E8] transition-colors shrink-0"
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  );

  // Logout button at the very bottom
  const SidebarFooter = () => (
    <div className="border-t border-[#2C1810]/40 p-2 flex justify-center">
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          title="Logout"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-[#8B6B5A] hover:bg-[#2C1810] hover:text-[#F5F0E8] transition-colors"
        >
          <LogOut size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-[#C4B49A] hover:bg-[#2C1810] hover:text-[#F5F0E8] transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          Logout
        </button>
      )}
    </div>
  );

  const sidebar =
    role === 'DIRECTOR' ? (
      <div className="flex h-full flex-col">
        <SidebarHeader />
        <DirectorSidebarNav collapsed={sidebarCollapsed} />
        <SidebarFooter />
      </div>
    ) : (
      <div className="flex h-full flex-col">
        <SidebarHeader />
        <SidebarNav sections={sidebarSections} activeHref={pathname} collapsed={sidebarCollapsed} />
        <SidebarFooter />
      </div>
    );

  const usesDualShell =
    role === 'MANAGER' ||
    role === 'DIRECTOR' ||
    role === 'SYSTEM_ADMIN' ||
    role === 'ACCOUNTANT' ||
    role === 'HR_MANAGER' ||
    role === 'STORE_MANAGER';

  const useSidebarOnlyShell =
    !usesDualShell &&
    (isDesktopPreviewEnabled && (role === 'WAITER' || role === 'CHEF' || role === 'BARISTA'));

  const mobileShell = (
    <MobileLayout
      className="lg:hidden"
      bottomNav={
        mobileNavConfig ? (
          <BottomNav
            tabs={mobileNavConfig.tabs}
            overflowTabs={mobileNavConfig.overflowTabs}
            activeHref={pathname}
          />
        ) : undefined
      }
    >
      <ShellProvider value="mobile">{children}</ShellProvider>
    </MobileLayout>
  );

  return (
    <>
      {usesDualShell ? (
        <>
          {/* Desktop: sidebar shell (hidden on mobile via SidebarLayout) */}
          <SidebarLayout
            sidebar={sidebar}
            collapsedSidebar={sidebarCollapsed}
            sidebarClassName="bg-[#1A0F0A] border-r border-[#2C1810]/40"
          ><ShellProvider value="desktop">{children}</ShellProvider></SidebarLayout>
          {/* Mobile: bottom nav shell */}
          {mobileShell}
        </>
      ) : useSidebarOnlyShell ? (
        <SidebarLayout
          sidebar={sidebar}
          collapsedSidebar={sidebarCollapsed}
          sidebarClassName="bg-[#1A0F0A] border-r border-[#2C1810]/40"
        >{children}</SidebarLayout>
      ) : (
        <MobileLayout
          bottomNav={
            mobileNavConfig ? (
              <BottomNav
                tabs={mobileNavConfig.tabs}
                overflowTabs={mobileNavConfig.overflowTabs}
                activeHref={pathname}
              />
            ) : undefined
          }
        >
          <ShellProvider value="mobile">{children}</ShellProvider>
        </MobileLayout>
      )}

      <ConfirmDialog
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => void handleConfirmLogout()}
        title="Log out?"
        description="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        isLoading={isLoggingOut}
      />
    </>
  );
}
