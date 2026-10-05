import { create } from 'zustand';

import { useAuthStore } from '@/store/authStore';

/**
 * Demo only (decisions.md, "One screen set, mock first"): the System Admin can view the Central Store as another role. This
 * changes what the screens show (sidebar, buttons, phone or desktop layout) and which mock actor writes; it never logs in as
 * anyone. Remembered in this browser only, wrapped in try/catch because storage can be blocked.
 */
export const DEMO_ROLES = ['STORE_MANAGER', 'STORE_ATTENDANT', 'ACCOUNTANT', 'DIRECTOR', 'MANAGER', 'SYSTEM_ADMIN'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
  ACCOUNTANT: 'Accountant',
  DIRECTOR: 'Director',
  MANAGER: 'Branch Manager',
  SYSTEM_ADMIN: 'System Admin',
};

const KEY = 'central-store-demo-view';

function read(): DemoRole | null {
  try {
    const raw = localStorage.getItem(KEY);
    return DEMO_ROLES.find((r) => r === raw) ?? null;
  } catch {
    return null;
  }
}

interface DemoViewState {
  viewAs: DemoRole | null;
  hydrated: boolean;
  hydrate: () => void;
  setViewAs: (role: DemoRole | null) => void;
}

export const useDemoViewStore = create<DemoViewState>((set, get) => ({
  viewAs: null,
  hydrated: false,
  hydrate: () => {
    if (!get().hydrated) set({ viewAs: read(), hydrated: true });
  },
  setViewAs: (role) => {
    try {
      if (role) localStorage.setItem(KEY, role);
      else localStorage.removeItem(KEY);
    } catch {
      // Blocked storage: the choice lasts until the page reloads.
    }
    set({ viewAs: role });
  },
}));

/** The role the screens act as: the previewed role for a System Admin, otherwise the real role. */
export function useEffectiveRole(): { role: string | undefined; realRole: string | undefined; previewing: boolean } {
  const realRole = useAuthStore((s) => s.user?.role);
  const viewAs = useDemoViewStore((s) => s.viewAs);
  const previewing = realRole === 'SYSTEM_ADMIN' && viewAs !== null && viewAs !== 'SYSTEM_ADMIN';
  return { role: previewing ? viewAs : realRole, realRole, previewing };
}
