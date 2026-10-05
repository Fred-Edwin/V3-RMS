import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type { Capability } from '../lib/capabilities';
import { useEffectiveRole } from './use-demo-view';

interface PermissionsPayload {
  role: string;
  isDepartmentHead: boolean;
  capabilities: Capability[];
}

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface PermissionsState {
  /** Whose capabilities these are; a different user starts again. */
  userId: string | null;
  capabilities: Capability[];
  status: Status;
  /** `userId` is the scope key: the user's id, plus `#ROLE` while a System Admin previews that role (demo only). */
  load: (userId: string, asRole?: string) => Promise<void>;
  clear: () => void;
}

const CACHE_KEY = 'central-store-permissions';

/** The last answer for this user, so a refresh does not flash an empty sidebar. Never trusted for security: the server decides. */
function readCache(userId: string): Capability[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; capabilities?: Capability[] };
    return parsed.userId === userId && Array.isArray(parsed.capabilities) ? parsed.capabilities : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, capabilities: Capability[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, capabilities }));
  } catch {
    // Private windows and blocked storage: the sidebar simply waits for the server.
  }
}

let inFlight: Promise<void> | null = null;

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  userId: null,
  capabilities: [],
  status: 'idle',
  clear: () => set({ userId: null, capabilities: [], status: 'idle' }),
  load: async (userId, asRole) => {
    if (get().userId === userId && (get().status === 'ready' || get().status === 'loading')) return inFlight ?? undefined;
    const cached = readCache(userId);
    set({ userId, capabilities: cached ?? [], status: cached ? 'ready' : 'loading' });
    inFlight = (async () => {
      try {
        const token = useAuthStore.getState().accessToken ?? undefined;
        const data = await apiClient.get<PermissionsPayload>(`/inventory/permissions/me${asRole ? `?asRole=${encodeURIComponent(asRole)}` : ''}`, token);
        if (get().userId !== userId) return;
        writeCache(userId, data.capabilities);
        set({ capabilities: data.capabilities, status: 'ready' });
      } catch {
        if (get().userId !== userId) return;
        set({ status: cached ? 'ready' : 'error' });
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
}));

/**
 * What the signed-in person may do in the Central Store, from the server's table. `ready` is false until the first answer (or a
 * cached one) arrives, so screens can wait instead of flashing a "not available" card. `can` is stable between renders.
 */
export function usePermissions() {
  const realUserId = useAuthStore((s) => s.user?.id ?? null);
  const { role: previewRole, previewing } = useEffectiveRole();
  const userId = realUserId && previewing && previewRole ? `${realUserId}#${previewRole}` : realUserId;
  const accessToken = useAuthStore((s) => s.accessToken);
  const capabilities = usePermissionsStore((s) => s.capabilities);
  const status = usePermissionsStore((s) => s.status);
  const storeUserId = usePermissionsStore((s) => s.userId);
  const load = usePermissionsStore((s) => s.load);

  useEffect(() => {
    if (userId && accessToken) void load(userId, previewing ? previewRole : undefined);
  }, [userId, accessToken, load, previewing, previewRole]);

  const mine = storeUserId === userId;
  const can = useCallback((capability: Capability): boolean => mine && capabilities.includes(capability), [mine, capabilities]);
  return { can, ready: mine && status === 'ready', failed: mine && status === 'error', capabilities: mine ? capabilities : [] };
}
