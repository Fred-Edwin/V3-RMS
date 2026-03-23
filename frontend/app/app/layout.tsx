'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart2,
  Bike,
  Building2,
  Calendar,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  Printer,
  Settings2,
  ShoppingCart,
  Store,
  Truck,
  UserCircle,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { BottomNav, ConfirmDialog, MobileLayout, SidebarLayout, SidebarNav, type NavSection, type NavTab } from '@/components/ui';
import { env } from '@/lib/env';

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
import type { AppRole } from '@/types/auth';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

type MobileRole = 'WAITER' | 'CHEF' | 'BARISTA' | 'MANAGER' | 'DIRECTOR' | 'SYSTEM_ADMIN';

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
      { label: 'Reports', href: '/app/manage/reports', icon: BarChart2 },
    ],
    overflowTabs: [
      { label: 'Staff', href: '/app/manage/staff', icon: Users },
      { label: 'Menu', href: '/app/manage/menu', icon: UtensilsCrossed },
      { label: 'Shifts', href: '/app/manage/shifts', icon: Calendar },
      { label: 'Delivery Zones', href: '/app/manage/delivery-zones', icon: Bike },
      { label: 'Incidents', href: '/app/manage/incidents', icon: AlertTriangle },
      { label: 'Settings', href: '/app/manage/settings', icon: Printer },
      { label: 'Customer Credit', href: '/app/manage/customer-credit', icon: CreditCard },
      { label: 'Outstanding', href: '/app/manage/outstanding-balances', icon: AlertTriangle },
      { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  DIRECTOR: {
    tabs: [
      { label: 'Dashboard', href: '/app/director', icon: LayoutDashboard },
      { label: 'Corporate', href: '/app/director/corporate-accounts', icon: Building2 },
      { label: 'Outstanding', href: '/app/director/outstanding-balances', icon: AlertTriangle },
      { label: 'My Tab', href: '/app/manage/my-tab', icon: CreditCard },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [],
  },
  SYSTEM_ADMIN: {
    tabs: [
      { label: 'Branches', href: '/app/admin', icon: Settings2 },
      { label: 'Menu', href: '/app/admin/menu', icon: UtensilsCrossed },
      { label: 'House Accts', href: '/app/admin/house-accounts', icon: CreditCard },
      { label: 'Corporate', href: '/app/admin/corporate-accounts', icon: Building2 },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
    overflowTabs: [],
  },
  WAITER: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'New Order', href: '/app/orders/new', icon: ShoppingCart },
      { label: 'Orders', href: '/app/orders', icon: ClipboardList },
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
    ],
    overflowTabs: [
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'History', href: '/app/history', icon: Clock },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  CHEF: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Kitchen', href: '/app/kitchen', icon: ChefHat },
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'History', href: '/app/history', icon: Clock },
    ],
    overflowTabs: [
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
  BARISTA: {
    tabs: [
      { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { label: 'Barista', href: '/app/barista', icon: Coffee },
      { label: 'Shifts', href: '/app/shifts', icon: Calendar },
      { label: 'History', href: '/app/history', icon: Clock },
    ],
    overflowTabs: [
      { label: 'Performance', href: '/app/performance', icon: BarChart2 },
      { label: 'Profile', href: '/app/profile', icon: UserCircle },
    ],
  },
};

const sidebarSectionsByRole: Partial<Record<AppRole, NavSection[]>> = {
  STORE_MANAGER: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/app/store/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Ingredients', href: '/app/store/ingredients', icon: Package },
        { label: 'Suppliers', href: '/app/store/suppliers', icon: Store },
        { label: 'Deliveries', href: '/app/store/deliveries/new', icon: Truck },
        { label: 'Requisitions', href: '/app/store/requisitions', icon: PackageCheck },
        { label: 'Stocktake', href: '/app/store/stocktake', icon: ClipboardList },
      ],
    },
    {
      label: 'Account',
      items: [{ label: 'Profile', href: '/app/profile', icon: UserCircle }],
    },
  ],
  MANAGER: [
    {
      label: 'Operations',
      items: [
        { label: 'Dashboard', href: '/app/manage/dashboard', icon: LayoutDashboard },
        { label: 'Orders', href: '/app/orders', icon: ShoppingCart },
        { label: 'History', href: '/app/history', icon: Clock },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Stock', href: '/app/manage/inventory', icon: Package },
        { label: 'Requisitions', href: '/app/manage/requisitions', icon: PackageCheck },
        { label: 'Stocktake', href: '/app/manage/stocktake', icon: ClipboardList },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Staff', href: '/app/manage/staff', icon: Users },
        { label: 'Menu', href: '/app/manage/menu', icon: UtensilsCrossed },
        { label: 'Shifts', href: '/app/manage/shifts', icon: Calendar },
        { label: 'Delivery Zones', href: '/app/manage/delivery-zones', icon: Bike },
        { label: 'Settings', href: '/app/manage/settings', icon: Printer },
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
      items: [
        { label: 'Reports', href: '/app/manage/reports', icon: BarChart2 },
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
      items: [{ label: 'Dashboard', href: '/app/director', icon: LayoutDashboard }],
    },
    {
      label: 'Inventory',
      items: [
        { label: 'Inventory', href: '/app/admin/inventory', icon: Package },
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
      items: [{ label: 'Reports', href: '/app/director', icon: BarChart2 }],
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
        { label: 'Performance', href: '/app/performance', icon: BarChart2 },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
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
        { label: 'Performance', href: '/app/performance', icon: BarChart2 },
        { label: 'History', href: '/app/history', icon: Clock },
        { label: 'Profile', href: '/app/profile', icon: UserCircle },
      ],
    },
  ],
};

export default function AppLayout({ children }: AppShellLayoutProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isDisplayRoute = pathname.startsWith('/app/kitchen') || pathname.startsWith('/app/barista');
  const isDisplayOnlyRole = role === 'KITCHEN_DISPLAY' || role === 'BARISTA_DISPLAY';
  const isDesktopPreviewEnabled = env.roleDesktopPreview && process.env.NODE_ENV !== 'production';

  const sidebarSections = useMemo(() => {
    const sections = role ? (sidebarSectionsByRole[role] ?? []) : [];
    if (env.creditAccounts) return sections;
    return sections
      .map((section) => ({ ...section, items: section.items.filter((item) => !CREDIT_PATHS.has(item.href)) }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  const mobileNavConfig = useMemo(() => {
    if (!role || !(role in mobileRoleTabs)) return null;
    const config = mobileRoleTabs[role as MobileRole];
    if (env.creditAccounts) return config;
    return {
      tabs: config.tabs.filter((t) => !CREDIT_PATHS.has(t.href)),
      overflowTabs: config.overflowTabs.filter((t) => !CREDIT_PATHS.has(t.href)),
    };
  }, [role]);

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

  const sidebar = (
    <div className="flex h-full flex-col">
      <SidebarNav sections={sidebarSections} activeHref={pathname} />
      <div className="border-t border-stone-200 p-3">
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-label-md font-medium text-stone-700 transition-colors duration-fast hover:bg-stone-100 hover:text-stone-900"
        >
          <LogOut size={18} className="text-stone-500" />
          Logout
        </button>
      </div>
    </div>
  );

  const usesDualShell =
    role === 'MANAGER' ||
    role === 'DIRECTOR' ||
    role === 'SYSTEM_ADMIN' ||
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
      {children}
    </MobileLayout>
  );

  return (
    <>
      {usesDualShell ? (
        <>
          {/* Desktop: sidebar shell (hidden on mobile via SidebarLayout) */}
          <SidebarLayout sidebar={sidebar}>{children}</SidebarLayout>
          {/* Mobile: bottom nav shell */}
          {mobileShell}
        </>
      ) : useSidebarOnlyShell ? (
        <SidebarLayout sidebar={sidebar}>{children}</SidebarLayout>
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
          {children}
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
