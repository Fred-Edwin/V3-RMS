import * as React from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import type { PurchaseFile } from '../types';
import { usePurchasing } from './use-purchasing';

/** One purchase file, reloaded after any Purchasing write made on this screen. `id = null` loads nothing. */
export function useOrder(id: string | null) {
  const { service, data: tick, can, role, ready } = usePurchasing();
  const loader = useLoader<PurchaseFile>(id && ready ? `order:${id}` : null, () => service.getOrder(id as string), 'We could not load this order.');
  const reloadRef = React.useRef(loader.reload);
  reloadRef.current = loader.reload;
  React.useEffect(() => {
    if (id && ready) void reloadRef.current();
  }, [tick, service, id, ready]);
  return { ...loader, service, can, role };
}

/**
 * The order behind a drawer that opens from a list row or from the file: `orderId = null` is closed. The last order stays
 * available while the drawer slides shut, but never one for a different id (so a drawer cannot flash the wrong order).
 */
export function useSheetOrder(orderId: string | null): PurchaseFile | null {
  const { data } = useOrder(orderId);
  const last = React.useRef<PurchaseFile | null>(null);
  if (data) last.current = data;
  if (data) return data;
  return orderId === null || last.current?.id === orderId ? last.current : null;
}

/** True below the sheet breakpoint, so a drawer becomes a bottom sheet on a phone (Paper steps 05 and 06). */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = (): void => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return narrow;
}
