import { useCallback, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { createGoodsReceipt, signGoodsReceipt, updateGoodsReceipt } from '../services/receiving-api-service';
import type {
  CreateGoodsReceiptInput,
  GoodsReceiptDetail,
  SignGoodsReceiptInput,
  UpdateGoodsReceiptInput,
} from '../types/receiving';

export type SignErrorKind = 'pin-not-set' | 'pin-incorrect' | 'already-signed-or-empty' | 'not-found' | 'unknown';

export interface ClassifiedSignError {
  kind: SignErrorKind;
  message: string;
}

/**
 * Classifies the sign endpoint's failure modes. Both PIN failures are plain
 * 401s with no distinguishing `code` — the backend's exact message string is
 * the only signal (confirmed: `apiClient` carries `payload.error.message`
 * through unmodified), so matching on message text is correct here, not a
 * workaround. See milestone-2-s6-frontend-goods-receipt-prompt.md.
 */
function classifySignError(err: unknown): ClassifiedSignError {
  if (err instanceof ApiError) {
    if (err.statusCode === 401 && /no pin is set/i.test(err.message)) {
      return { kind: 'pin-not-set', message: 'No PIN is set for this account. Ask an administrator to set one before signing.' };
    }
    if (err.statusCode === 401) {
      return { kind: 'pin-incorrect', message: 'Incorrect PIN. Try again.' };
    }
    if (err.statusCode === 409) {
      return { kind: 'already-signed-or-empty', message: 'This receipt was already signed or has no lines. Refresh to see its current state.' };
    }
    if (err.statusCode === 404) {
      return { kind: 'not-found', message: 'No Central Store is configured, or the supplier could not be found.' };
    }
  }
  return { kind: 'unknown', message: formatApiErrorMessage(err, 'Could not sign this receipt.') };
}

function toUpdateInput(input: CreateGoodsReceiptInput): UpdateGoodsReceiptInput {
  const { supplierId: _supplierId, ...rest } = input;
  return rest;
}

/**
 * New Goods Receipt (`UQE-0`) — draft save/update + sign, combined because
 * both share the same in-progress `receiptId`: saveDraft's create-vs-update
 * branch reads it, and sign writes into it once a draft exists.
 */
export function useGoodsReceiptForm() {
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<ClassifiedSignError | null>(null);

  const saveDraft = useCallback(
    async (input: CreateGoodsReceiptInput): Promise<GoodsReceiptDetail | null> => {
      setSavingDraft(true);
      setDraftError(null);
      try {
        const saved = receiptId
          ? await updateGoodsReceipt(receiptId, toUpdateInput(input))
          : await createGoodsReceipt(input);
        setReceiptId(saved.id);
        return saved;
      } catch (err) {
        setDraftError(formatApiErrorMessage(err, 'Could not save this draft.'));
        return null;
      } finally {
        setSavingDraft(false);
      }
    },
    [receiptId]
  );

  const sign = useCallback(
    async (id: string, input: SignGoodsReceiptInput): Promise<{ ok: true; receipt: GoodsReceiptDetail } | { ok: false; error: ClassifiedSignError }> => {
      setSigning(true);
      setSignError(null);
      try {
        const receipt = await signGoodsReceipt(id, input);
        return { ok: true, receipt };
      } catch (err) {
        const classified = classifySignError(err);
        setSignError(classified);
        return { ok: false, error: classified };
      } finally {
        setSigning(false);
      }
    },
    []
  );

  return { receiptId, saveDraft, savingDraft, draftError, sign, signing, signError, setSignError };
}
