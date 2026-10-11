import * as React from 'react';

import { useLoader } from '../../_shared/hooks/use-async';
import type { PurchasingService } from '../services/purchasing-service';
import { usePurchasing } from './use-purchasing';

/**
 * One Attendant read (Home, My orders, History…), reloaded after any Purchasing write made on the phone. `key = null` loads nothing
 * (the screen is waiting for the permissions table or for a search of one character). A reload of data already on screen keeps it.
 */
export function useAttendantData<T>(key: string | null, read: (service: PurchasingService) => Promise<T>, fallbackMessage: string) {
  const { service, data: tick, ready, can, role } = usePurchasing();
  const loader = useLoader<T>(key !== null && ready ? key : null, () => read(service), fallbackMessage);
  const reloadRef = React.useRef(loader.reload);
  reloadRef.current = loader.reload;
  const seen = React.useRef(tick);
  React.useEffect(() => {
    if (seen.current === tick) return;
    seen.current = tick;
    void reloadRef.current();
  }, [tick]);
  return { ...loader, service, can, role, ready };
}
