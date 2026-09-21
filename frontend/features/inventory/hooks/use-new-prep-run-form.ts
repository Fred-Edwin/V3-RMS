import { useCallback, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { createPrepRun } from '../services/prep-api-service';
import type { CreatePrepRunInput, PrepRunDetail } from '../types/prep';

/**
 * New Prep Run (`ZAR-0`/`ZIY-0` + confirm sheet `ZKJ-0`) — a single
 * "Confirm run" write, no draft/sign split. Flow 3 is explicit that a prep
 * run carries no signature step ("No signature — the ledger records who and
 * when"), unlike Goods Receipt's draft-then-sign flow, so this hook is
 * simpler than `use-goods-receipt-form.ts` — one create call, no PIN.
 */
export function useNewPrepRunForm() {
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const confirmRun = useCallback(async (input: CreatePrepRunInput): Promise<PrepRunDetail | null> => {
    setConfirming(true);
    setConfirmError(null);
    try {
      return await createPrepRun(input);
    } catch (err) {
      setConfirmError(formatApiErrorMessage(err, 'Could not record this prep run.'));
      return null;
    } finally {
      setConfirming(false);
    }
  }, []);

  return { confirmRun, confirming, confirmError, setConfirmError };
}
