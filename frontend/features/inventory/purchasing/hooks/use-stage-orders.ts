import * as React from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import type { OrderRow, Stage } from '../types';
import { usePurchasing } from './use-purchasing';

/** The orders at one stage, reloaded whenever the mock's data changes (by any role). */
export function useStageOrders(stage: Stage) {
  const { service, data: tick, can, ready } = usePurchasing();
  const loader = useLoader<{ orders: OrderRow[]; total: number; valueTotal: string }>(ready ? `orders:${stage}` : null, () => service.listOrders({ stage }), 'We could not load the orders.');
  const reloadRef = React.useRef(loader.reload);
  reloadRef.current = loader.reload;
  React.useEffect(() => {
    void reloadRef.current();
  }, [tick, service]);
  return { ...loader, can };
}
