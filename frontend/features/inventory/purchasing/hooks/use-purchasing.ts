import { useMemo, useSyncExternalStore } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useEffectiveRole } from '../../_shared/hooks/use-demo-view';
import { usePermissions } from '../../_shared/hooks/use-permissions';
import { PEOPLE } from '../mock/fixtures';
import { createMockPurchasingService } from '../mock/mock-service';
import { mockStore } from '../mock/store';
import type { PurchasingService } from '../services/purchasing-service';

/**
 * The service every Purchasing screen uses. Today it is the in-browser mock acting as the effective role (the System Admin's
 * previewed role, or the real one); the capabilities come from the server's table through `usePermissions()`, so the mock
 * obeys the same rules as the buttons. Swap the body of this hook for an HTTP service when the back-end exists.
 *
 * `data` is a new object whenever the mock's data changes (by any role), so screens can list it as a dependency and reload.
 */
export function usePurchasing(): { service: PurchasingService; data: unknown; ready: boolean; can: ReturnType<typeof usePermissions>['can']; role: string | undefined } {
  const { can, ready } = usePermissions();
  const { role, previewing } = useEffectiveRole();
  const userName = useAuthStore((s) => s.user?.name);
  const store = mockStore();
  const data = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.get(),
    () => store.get()
  );

  const service = useMemo(() => {
    const person = role && role in PEOPLE ? PEOPLE[role as keyof typeof PEOPLE] : PEOPLE.SYSTEM_ADMIN;
    // Someone using their own account keeps their own name on what they do; a previewed role acts as the demo person.
    const actor = previewing || !userName ? { ...person } : { ...person, name: userName };
    return createMockPurchasingService(store, { actor, can }, { latencyMs: 250 });
  }, [store, role, previewing, can, userName]);

  return { service, data, ready, can, role };
}
