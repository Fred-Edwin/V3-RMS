'use client';

import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/app/shell/app-shell';
import { FLOOR_ROLES, isBareRoute, usesAppShell } from '@/components/app/shell/nav-table';
import { usePermissions } from '@/features/inventory';
import { SecurityGate } from '@/features/workforce/security';
import { PourReveal } from '@/components/app/shell/feedback/pour-reveal';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import { useCommsSocket } from '@/hooks/useCommsSocket';
import { useMessageToast } from '@/hooks/useMessageToast';

interface AppShellLayoutProps {
  children: React.ReactNode;
}

/**
 * Routing only. Which links a role sees lives in `components/app/shell/nav-table.ts`; the sidebar and top bar are `AppShell`.
 * This layout just decides which frame a page gets:
 *   - no role yet, the kitchen/barista display screens, and print documents: the page bare;
 *   - every human role (desktop roles, the Store Attendant and all floor staff): the one shell at every width, a sidebar on desktop
 *     and a menu drawer on phones, with a short bottom bar for the floor staff.
 */
export default function AppLayout({ children }: AppShellLayoutProps): JSX.Element {
  const role = useAuthStore((state) => state.role);
  // Segment 6a: a person who must choose a new password, or whose phone is not confirmed yet, answers that before the app. The kitchen and
  // bar display screens are devices, not people, and skip it.
  const asksSecurity = Boolean(role) && role !== 'KITCHEN_DISPLAY' && role !== 'BARISTA_DISPLAY';
  return (
    <SecurityGate enabled={asksSecurity}>
      <AppFrame>{children}</AppFrame>
    </SecurityGate>
  );
}

function AppFrame({ children }: AppShellLayoutProps): JSX.Element {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.role);
  const isDepartmentHead = useAuthStore((state) => state.isDepartmentHead);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  // A floor-staff person who is not a head may still belong to a department; only the server knows (the token marks heads only).
  const asksMembership = Boolean(role) && FLOOR_ROLES.includes(role as AppRole) && !isDepartmentHead;
  const membership = usePermissions(asksMembership);
  const isDepartmentMember = asksMembership && membership.isMember;

  // Attach comms socket listeners for real-time inbox updates
  useCommsSocket();
  // Fire arrival toasts for incoming messages
  useMessageToast();

  const isDisplayRoute = pathname.startsWith('/app/kitchen') || pathname.startsWith('/app/barista');
  const isDisplayOnlyRole = role === 'KITCHEN_DISPLAY' || role === 'BARISTA_DISPLAY';

  // Auth/session hydration gate — real wait here is an API refresh-token
  // round trip (~200ms-1s on a normal connection, see authStore's
  // hydrateSession), not an instant synchronous read. Approved in Paper
  // (Loading mark explorations) before being built — see PourReveal's own
  // doc comment for the full design rationale and motion notes.
  if (!role && !isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <PourReveal />
      </div>
    );
  }

  if (!role || (isDisplayRoute && isDisplayOnlyRole) || isBareRoute(pathname)) {
    return <>{children}</>;
  }

  // Until the server says whether this floor-staff person belongs to a department, hold the loading mark (no flash of the old tabs).
  if (asksMembership && !membership.ready && !membership.failed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wds-canvas">
        <PourReveal />
      </div>
    );
  }

  if (usesAppShell(role, isDepartmentHead, isDepartmentMember)) {
    return <AppShell mode="responsive">{children}</AppShell>;
  }

  // Every human role is in the shell; anything else (an unknown role) gets the page bare.
  return <>{children}</>;
}
