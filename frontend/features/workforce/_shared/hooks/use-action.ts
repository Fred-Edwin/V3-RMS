'use client';

import { useCallback, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';

/**
 * Runs one write from a Workforce screen: busy while it goes, the server's own words if it is refused, and a "what happened" line when it
 * works. A refusal is shown as a message in the dialog (never a thrown error), including `FIELD_NOT_ALLOWED`, `SELF_APPROVAL` and the
 * Organisation refusals (`POSITION_HELD`, `DEPARTMENT_HAS_PEOPLE`), which the server sends in plain English. The caller reloads in `onDone`.
 */
export interface FileAction {
  busy: boolean;
  error: string | null;
  clearError: () => void;
  /** Runs `write`; true when it worked. `done` is the line to show afterwards. */
  run: (write: () => Promise<unknown>, done?: string) => Promise<boolean>;
}

export function useAction(onDone: (message: string | null) => void): FileAction {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const run = useCallback(
    async (write: () => Promise<unknown>, done?: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await write();
        onDone(done ?? null);
        return true;
      } catch (err) {
        setError(formatApiErrorMessage(err, 'That did not go through. Nothing was changed.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onDone]
  );
  return { busy, error, clearError, run };
}
