'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart2,
  Bike,
  Calendar,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShoppingCart,
  UserCircle,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { BottomNav, ConfirmDialog, MobileLayout, SidebarLayout, SidebarNav, type NavSection, type NavTab } from '@/components/ui';
import { env } from '@/lib/env';
import { performLogout } from '@/lib/logout';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

const mobileRoleTabs: Record<'WAITER' | 'CHEF' | 'BARISTA', NavTab[]> = {
  WAITER: [
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'New Order', href: '/app/orders/new', icon: ShoppingCart },
    { label: 'Orders', href: '/app/orders', icon: ClipboardList },
    { label: 'History', href: '/app/history', icon: Clock },
    { label: 'Profile', href: '/app/profile', icon: UserCircle },
  ],
  CHEF: [
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Kitchen', href: '/app/kitchen', icon: ChefHat },
    { label: 'History', href: '/app/history', icon: Clock },
    { label: 'Profile', href: '/app/profile', icon: UserCircle },
  ],
  BARISTA: [
    { label: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Barista', href: '/app/barista', icon: Coffee },
    { label: 'History', href: '/app/history', icon: Clock },
    { label: 'Profile', href: '/app/profile', icon: UserCircle },
  ],
};

const sidebarSectionsByRole: Partial<Record<AppRole, NavSection[]>> = {
  MANAGER: [
    {
      label: 'Operations',
      items: [
        { label: 'Dashboard', href: '/app/manage/dashboard', icon: LayoutDashboard },
        { label: 'Orders', href: '/app/manage/dashboard', icon: ShoppingCart },
      ],
    },
    {
      label: 'Manage',
      items: [
        { label: 'Staff', href: '/app/manage/staff', icon: Users },
        { label: 'Menu', href: '/app/manage/menu', icon: UtensilsCrossed },
        { label: 'Shifts', href: '/app/manage/shifts', icon: Calendar },
        { label: 'Delivery Zones', href: '/app/manage/delivery-zones', icon: Bike },
      ],
    },
    {
      items: [{ label: 'Reports', href: '/app/manage/reports', icon: BarChart2 }],
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isDisplayRoute = pathname.startsWith('/app/kitchen') || pathname.startsWith('/app/barista');
  const isDisplayOnlyRole = role === 'KITCHEN_DISPLAY' || role === 'BARISTA_DISPLAY';
  const isDesktopPreviewEnabled = env.roleDesktopPreview && process.env.NODE_ENV !== 'production';

  const sidebarSections = useMemo(() => (role ? sidebarSectionsByRole[role] ?? [] : []), [role]);

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

  const useSidebarShell =
    role === 'MANAGER' ||
    role === 'DIRECTOR' ||
    role === 'SYSTEM_ADMIN' ||
    (isDesktopPreviewEnabled && (role === 'WAITER' || role === 'CHEF' || role === 'BARISTA'));

  return (
    <>
      {useSidebarShell ? (
        <SidebarLayout sidebar={sidebar}>{children}</SidebarLayout>
      ) : (
        <MobileLayout
          bottomNav={
            role === 'WAITER' || role === 'CHEF' || role === 'BARISTA' ? (
              <BottomNav tabs={mobileRoleTabs[role]} activeHref={pathname} />
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
