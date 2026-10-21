'use client';

import { useCallback, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { needsYouWrites } from '../services/needs-you-services';

/** "Send a reminder": one per item per day. A repeat (403 REMINDER_ALREADY_SENT) reads as sent, not as a fault. */
export function useRemind(onSent: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());

  const send = useCallback(
    async (id: string): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await needsYouWrites.remind(id);
        setSent((prev) => new Set(prev).add(id));
        onSent();
      } catch (err) {
        if (err instanceof ApiError && err.code === 'REMINDER_ALREADY_SENT') {
          setSent((prev) => new Set(prev).add(id));
          onSent();
        } else {
          setError(formatApiErrorMessage(err, 'The reminder was not sent. Try again.'));
        }
      } finally {
        setBusy(false);
      }
    },
    [onSent]
  );

  return { busy, error, sent, send };
}
