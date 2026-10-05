import * as React from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import { SUPPLIERS } from '../mock/fixtures';
import type { SupplierPurchasing } from '../types';
import { usePurchasing } from './use-purchasing';

/**
 * The demo supplier behind a real supplier page. The supplier page is real (real ids); the purchasing figures are the mock's, which
 * knows its own ids, so they are matched by name (the real name may carry a prefix, such as "S6 Test Kagumo Poultry Farm"). A real
 * supplier with no match has no demo purchases: its orders and statement are simply empty.
 */
export function mockSupplierIdFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return SUPPLIERS.find((s) => n === s.name.toLowerCase() || n.includes(s.name.toLowerCase()))?.id ?? null;
}

/** What the supplier page shows from Purchasing: what we owe, and the supplier's orders. Reloads whenever the mock's data changes. */
export function useSupplierPurchasing(supplierName: string | null | undefined) {
  const { service, data: tick, ready, can } = usePurchasing();
  const mockId = mockSupplierIdFor(supplierName);
  const allowed = can('payables.read') || can('orders.read');
  const loader = useLoader<SupplierPurchasing>(mockId && ready && allowed ? `supplier-purchasing:${mockId}` : null, () => service.getSupplierPurchasing(mockId as string), 'We could not load this supplier’s orders.');
  const reloadRef = React.useRef(loader.reload);
  reloadRef.current = loader.reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);
  return { mockId, ...loader, service, can, tick, ready };
}
