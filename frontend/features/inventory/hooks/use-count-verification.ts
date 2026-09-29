import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { approveCount, decideCountLine, returnCount } from '../services/count-api-service';
import type {
  ApproveCountResult,
  CountReasonValue,
  DecideLineInput,
  VerifierCountLine,
  VerifierCountView,
} from '../types/count';
import { useVerifierCount } from './use-counts';

/** What stands between the Store Manager and "Approve & sign" — derived from the lines, so it reacts to every click. */
export interface VerificationState {
  /** Counted variance lines with no decision yet. */
  undecided: VerifierCountLine[];
  queried: VerifierCountLine[];
  /** Accepted lines that still need a reason (above threshold, or "Other" with no note). */
  needsReason: VerifierCountLine[];
  /** Accepted, non-zero: these become ADJUSTMENT rows. */
  adjusting: VerifierCountLine[];
  canApprove: boolean;
  canSendBack: boolean;
}

const isVariance = (l: VerifierCountLine): boolean => l.variance !== null && Number.parseFloat(l.variance) !== 0;

export function deriveVerification(view: VerifierCountView | null): VerificationState {
  const lines = view?.lines ?? [];
  const counted = lines.filter((l) => l.countedQty !== null);
  const queried = lines.filter((l) => l.decision === 'QUERIED');
  const undecided = counted.filter((l) => isVariance(l) && l.decision === 'PENDING');
  const accepted = counted.filter((l) => isVariance(l) && l.decision === 'ACCEPTED');
  const needsReason = accepted.filter((l) => l.reasonRequired && (!l.reason || (l.reason === 'OTHER' && !(l.reasonNote ?? '').trim())));
  return {
    undecided,
    queried,
    needsReason,
    adjusting: accepted,
    canApprove: view?.status === 'SUBMITTED' && queried.length === 0 && undecided.length === 0 && needsReason.length === 0,
    canSendBack: view?.status === 'SUBMITTED' && queried.length > 0,
  };
}

export type VerifyActionError = { kind: 'decide' | 'return'; message: string } | null;

/**
 * One count's verification. Decisions apply optimistically (the button state
 * change is instant) and reconcile with the server's refreshed view; a failed
 * decision rolls back and raises the kit banner. PATCHes run one at a time so
 * quick successive clicks can't land out of order.
 */
export function useCountVerification(countId: string | null) {
  const { count, status, error, reload } = useVerifierCount(countId);
  const [view, setView] = useState<VerifierCountView | null>(null);
  const [actionError, setActionError] = useState<VerifyActionError>(null);
  const [sendingBack, setSendingBack] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<{ kind: 'pin' | 'other'; message: string } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    setView(null);
    setActionError(null);
  }, [countId]);
  useEffect(() => {
    if (count && count.id === countId) setView(count);
  }, [count, countId]);

  const patchLine = useCallback((lineId: string, patch: Partial<VerifierCountLine>) => {
    setView((prev) => (prev ? { ...prev, lines: prev.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)) } : prev));
  }, []);

  const decide = useCallback(
    (line: VerifierCountLine, input: DecideLineInput) => {
      if (!countId) return;
      const before: Partial<VerifierCountLine> = {
        decision: line.decision,
        reason: line.reason,
        reasonNote: line.reasonNote,
        queryNote: line.queryNote,
      };
      const accepting = input.decision === 'ACCEPTED';
      patchLine(line.lineId, {
        decision: input.decision,
        reason: accepting ? (input.reason ?? null) : null,
        reasonNote: accepting && input.reason ? (input.reasonNote ?? null) : null,
        queryNote: input.decision === 'QUERIED' ? (input.queryNote ?? null) : null,
      });
      setActionError(null);
      queue.current = queue.current.then(async () => {
        try {
          await decideCountLine(countId, line.lineId, input);
        } catch (err) {
          patchLine(line.lineId, before);
          setActionError({ kind: 'decide', message: formatApiErrorMessage(err, "Couldn't save that decision") });
        }
      });
    },
    [countId, patchLine],
  );

  const sendBack = useCallback(
    async (note: string): Promise<boolean> => {
      if (!countId) return false;
      setSendingBack(true);
      setActionError(null);
      try {
        await queue.current; // let every pending decision land first
        const result = await returnCount(countId, note);
        setView(result.count);
        return true;
      } catch (err) {
        setActionError({ kind: 'return', message: formatApiErrorMessage(err, "Couldn't send back — try again") });
        return false;
      } finally {
        setSendingBack(false);
      }
    },
    [countId],
  );

  const approve = useCallback(
    async (pin: string): Promise<ApproveCountResult | null> => {
      if (!countId) return null;
      setApproving(true);
      setApproveError(null);
      try {
        await queue.current;
        const result = await approveCount(countId, pin);
        setView(result.count);
        return result;
      } catch (err) {
        const message = formatApiErrorMessage(err, "Couldn't sign — try again");
        const wrongPin = err instanceof ApiError && /pin/i.test(err.message);
        setApproveError({ kind: wrongPin ? 'pin' : 'other', message: wrongPin ? 'Incorrect PIN' : "Couldn't sign — try again" });
        if (!wrongPin) void reload();
        return null;
      } finally {
        setApproving(false);
      }
    },
    [countId, reload],
  );

  const state = useMemo(() => deriveVerification(view), [view]);
  const clearApproveError = useCallback(() => setApproveError(null), []);

  return {
    view,
    status,
    error,
    reload,
    decide,
    sendBack,
    sendingBack,
    approve,
    approving,
    approveError,
    clearApproveError,
    actionError,
    clearActionError: useCallback(() => setActionError(null), []),
    state,
  };
}

export type { CountReasonValue };
