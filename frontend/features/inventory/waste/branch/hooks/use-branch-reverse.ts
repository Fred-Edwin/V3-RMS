'use client';

import * as React from 'react';

import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY } from '../../_shared/lib/branch-waste-copy';
import type { BranchWasteEntry, WasteReversalReason } from '../../_shared/types/waste-contract';
import { branchWasteApi } from '../services/branch-waste-api';

/**
 * The reversal form of the phone sheet (W5; no PIN): a reason that starts unchosen and is required, a note that "Other, add a note"
 * makes required (G14), one request at a time. A server refusal (not yours, window passed, already reversed) is shown inside the
 * sheet; the entry stays. The form resets whenever a different entry is opened.
 */
export function useBranchReverse(entry: BranchWasteEntry | null, onDone: (e: BranchWasteEntry) => void) {
  const [reason, setReason] = React.useState<WasteReversalReason | null>(null);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setReason(null);
    setNote('');
    setError(null);
    setBusy(false);
  }, [entry?.id]);

  const needsNote = reason === 'OTHER' && note.trim() === '';
  const submit = async (): Promise<void> => {
    if (!entry || !reason || needsNote || busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await branchWasteApi.reverse(entry.id, { reason, ...(reason === 'OTHER' ? { note: note.trim() } : {}) }));
    } catch (err) {
      setError(scwErrorMessage(err, BRANCH_WASTE_ERROR_COPY, BRANCH_WASTE_STATES_COPY.reversePhone.error));
      setBusy(false);
    }
  };
  return { reason, setReason, note, setNote, busy, error, needsNote, submit, ready: reason !== null && !needsNote };
}
