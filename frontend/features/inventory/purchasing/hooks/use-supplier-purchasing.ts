import * as React from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import type { SupplierPurchasing } from '../types';
import { usePurchasing } from './use-purchasing';

/**
 * What the supplier page shows from Purchasing: what we owe, and the supplier's orders (`GET /inventory/purchasing/suppliers/:id/orders`,
 * which needs `suppliers.read`). Reloads after every Purchasing write.
 */
export function useSupplierPurchasing(supplierId: string | null | undefined) {
  const { service, data: tick, ready, can } = usePurchasing();
  const allowed = can('suppliers.read');
  const loader = useLoader<SupplierPurchasing>(supplierId && ready && allowed ? `supplier-purchasing:${supplierId}` : null, () => service.getSupplierPurchasing(supplierId as string), 'We could not load this supplier’s orders.');
  const reloadRef = React.useRef(loader.reload);
  reloadRef.current = loader.reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);
  return { supplierId: supplierId ?? null, ...loader, service, can, tick, ready };
}
