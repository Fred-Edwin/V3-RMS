import { create } from 'zustand';

import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '../../_shared/hooks/use-permissions';
import { createPurchasingApiService } from '../services/purchasing-api-service';
import type { PurchasingService } from '../services/purchasing-service';

/** Goes up after every write (done or refused), so every open list and file reloads, the way the screens did on the mock's changes. */
const useDataVersion = create<{ version: number }>(() => ({ version: 0 }));
const bump = (): void => useDataVersion.setState((s) => ({ version: s.version + 1 }));

const WRITES = [
  'createOrder',
  'updateOrder',
  'discardOrder',
  'submitOrder',
  'approveOrder',
  'returnOrder',
  'sendOrder',
  'cancelOrder',
  'recordDeposit',
  'receiveOrder',
  'addInvoice',
  'settleDispute',
  'voidInvoice',
  'recordPayment',
  'reversePayment',
  'addDocument',
] as const satisfies ReadonlyArray<keyof PurchasingService>;

/** The HTTP service with a version bump after each write. A refused write bumps too: the order may have moved on under the person. */
function createLiveService(): PurchasingService {
  const api = createPurchasingApiService();
  const service: PurchasingService = { ...api };
  for (const name of WRITES) {
    const write = api[name] as (...args: unknown[]) => Promise<unknown>;
    (service as unknown as Record<string, unknown>)[name] = async (...args: unknown[]): Promise<unknown> => {
      try {
        return await write(...args);
      } finally {
        bump();
      }
    };
  }
  return service;
}

const service = createLiveService();

/**
 * The service every Purchasing screen uses: the live API (docs/API_CONTRACT.md §31). What each button does is decided by the
 * server's table through `usePermissions()` and by each order's own `can`. `data` is a number that changes after every write, so
 * screens can list it as a dependency and reload.
 */
export function usePurchasing(): { service: PurchasingService; data: number; ready: boolean; can: ReturnType<typeof usePermissions>['can']; role: string | undefined } {
  const { can, ready } = usePermissions();
  const role = useAuthStore((s) => s.user?.role);
  const data = useDataVersion((s) => s.version);
  return { service, data, ready, can, role };
}
