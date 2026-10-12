'use client';

/**
 * Dev-only auth bypass for manually verifying the Inventory Milestone One
 * screens without a running backend — this session builds against a mock
 * service layer and never waits on the backend (session brief), but real
 * login still needs the API. Sets fake auth state directly via
 * `useAuthStore.setAuth`, then links to each of the six screens.
 *
 * Not shipped UI — same category as `/dev/wds`.
 */
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

const ROLES: Array<{ label: string; user: AuthUser; isDepartmentHead?: boolean }> = [
  {
    label: 'Store Manager',
    user: {
      id: 'dev-store-manager',
      name: 'Joseph Mwangi',
      email: 'manager@dev.test',
      role: 'STORE_MANAGER',
      organizationId: 'org-hub',
      organizationName: 'Wendo Hub',
    },
  },
  {
    label: 'Store Attendant',
    user: {
      id: 'dev-store-attendant',
      name: 'Sarah Achieng',
      email: 'attendant@dev.test',
      role: 'STORE_ATTENDANT',
      organizationId: 'org-hub',
      organizationName: 'Wendo Hub',
    },
  },
  {
    label: 'Department Head (Kitchen)',
    user: {
      id: 'dev-kitchen-head',
      name: 'Grace Wanjiru',
      email: 'kitchen-head@dev.test',
      role: 'CHEF',
      organizationId: 'org-branch-1',
      organizationName: 'Nyeri Town',
      departmentTag: 'KITCHEN',
      isDepartmentHead: true,
    },
    isDepartmentHead: true,
  },
  {
    label: 'Department Head (Barista)',
    user: {
      id: 'dev-dept-head',
      name: 'Grace Wanjiru',
      email: 'barista-head@dev.test',
      role: 'BARISTA',
      organizationId: 'org-branch-1',
      organizationName: 'Wendo Nyeri Town',
      departmentTag: 'BARISTA',
      isDepartmentHead: true,
    },
    isDepartmentHead: true,
  },
  {
    label: 'Accountant',
    user: {
      id: 'dev-accountant',
      name: 'Peter Kamau',
      email: 'accountant@dev.test',
      role: 'ACCOUNTANT',
      organizationId: 'org-hub',
      organizationName: 'Wendo Hub',
    },
  },
  {
    label: 'Waiter (permission-denied case)',
    user: {
      id: 'dev-waiter',
      name: 'John Otieno',
      email: 'waiter@dev.test',
      role: 'WAITER',
      organizationId: 'org-branch-1',
      organizationName: 'Wendo Nyeri Town',
    },
  },
];

const SCREENS = [
  { label: 'Item catalog', href: '/app/inventory/catalog' },
  { label: 'Suppliers', href: '/app/inventory/suppliers' },
  { label: 'Restock levels (department)', href: '/app/inventory/restock-levels' },
  { label: 'Requisitions (head)', href: '/app/requisitions' },
];

function fakeAccessToken(user: AuthUser, isDepartmentHead: boolean): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const payload = btoa(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: user.role,
      organizationId: user.organizationId,
      departmentTag: user.departmentTag ?? null,
      isDepartmentHead,
    })
  );
  return `${header}.${payload}.`;
}

export default function InventoryPreviewPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  return (
    <div className="min-h-screen bg-wds-canvas p-8">
      <h1 className="mb-6 font-wds-sans text-wds-h1 text-wds-text-ink">Inventory Milestone One — dev preview</h1>
      <div className="flex flex-col gap-6">
        {ROLES.map((role) => (
          <div key={role.label} className="rounded-wds-md border border-wds-border bg-wds-surface p-4">
            <div className="mb-3 font-wds-sans text-wds-body font-medium text-wds-text-ink">{role.label}</div>
            <div className="flex flex-wrap gap-2">
              {SCREENS.map((screen) => (
                <button
                  key={screen.href}
                  type="button"
                  data-testid={`preview-${role.user.role}${role.isDepartmentHead ? '-dept-head' : ''}-${screen.href}`}
                  onClick={() => {
                    setAuth({ user: role.user, accessToken: fakeAccessToken(role.user, role.isDepartmentHead ?? false) });
                    router.push(screen.href);
                  }}
                  className="rounded-wds-sm border border-wds-border-strong bg-wds-surface px-3 py-1.5 font-wds-sans text-wds-caption text-wds-text-ink hover:bg-wds-neutral-50"
                >
                  {screen.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
