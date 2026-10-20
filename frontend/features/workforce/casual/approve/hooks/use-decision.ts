'use client';

import * as React from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { newKey } from '../../_shared/lib/draft-store';
import { casualWrites } from '../../_shared/services/casual-services';
import type { Sheet } from '../../_shared/types/casual-types';

/** Words for the refusals an approver can meet (API_CONTRACT §42); anything else shows the server's own sentence. */
function words(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No signal. Nothing was changed. Try again when you are back online.';
  switch (error.code) {
    case 'PIN_INVALID':
      return 'That PIN is not right.';
    case 'SELF_APPROVAL':
      return 'You recorded this sheet. The Director approves it.';
    case 'ALREADY_DECIDED':
    case 'SHEET_NOT_WAITING':
      return 'Someone else decided this sheet. Check it again.';
    case 'CHANGED_UNDERNEATH':
      return 'This changed while you were looking. Check it again.';
    case 'RATE_CHANGED':
      return 'The daily rate changed. Check the amounts.';
    case 'ALREADY_SIGNED':
      return 'A worker has already signed. This sheet cannot be voided; add a correction line on a later sheet.';
    case 'NETWORK':
      return 'No signal. Nothing was changed. Try again when you are back online.';
    default:
      return formatApiErrorMessage(error, 'That did not go through. Nothing was changed.');
  }
}

/**
 * Approve, send back or void one sheet. One idempotency key per open dialog, so a lost answer can be retried without deciding twice.
 * A stale sheet or a rate change is re-read through `onStale`; a wrong PIN keeps the dialog open.
 */
export function useDecision(sheet: Sheet, onDone: (next: Sheet, message: string) => void, onStale: () => void) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const key = React.useRef(newKey());

  const run = React.useCallback(
    async (call: (version: number, idempotencyKey: string) => Promise<Sheet>, done: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        onDone(await call(sheet.version, key.current), done);
        key.current = newKey();
        return true;
      } catch (e) {
        setError(words(e));
        if (e instanceof ApiError && ['CHANGED_UNDERNEATH', 'RATE_CHANGED', 'ALREADY_DECIDED', 'SHEET_NOT_WAITING'].includes(e.code)) onStale();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [sheet.version, onDone, onStale]
  );

  const id = sheet.id ?? '';
  return {
    busy,
    error,
    clearError: () => setError(null),
    approve: (pin: string) => run((version, idempotencyKey) => casualWrites.approve(id, { pin, version, expectedTotal: sheet.total, idempotencyKey }), 'Approved. The head is told.'),
    sendBack: (reason: string) => run((version, idempotencyKey) => casualWrites.sendBack(id, { reason, version, idempotencyKey }), 'Sent back. The head is told.'),
    voidSheet: (reason: string, pin: string) => run((version, idempotencyKey) => casualWrites.void(id, { reason, pin, version, idempotencyKey }), 'Voided. The head records the day again.'),
  };
}
