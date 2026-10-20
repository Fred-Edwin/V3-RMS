'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { openSession } from '../../_shared/lib/unlock-session';
import { payslipWrites } from '../../_shared/services/payslip-services';
import type { Unlocked } from '../../_shared/types/payslip-types';
import { problemOf, type CodeProblem } from '../lib/unlock-logic';

/**
 * Sends a code and opens the unlock. One try at a time. A pause (`slowed`, or the wait that comes with a wrong code) counts down on its
 * own and the field stays usable: a pause is never a lockout. Returns `true` through `onOpen` only when the server said yes.
 */
export function useCodeEntry(onOpen: () => void) {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<CodeProblem | null>(null);
  const [wait, setWait] = React.useState(0);
  const onOpenRef = React.useRef(onOpen);
  onOpenRef.current = onOpen;

  React.useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const attempt = React.useCallback(
    async (send: () => Promise<Unlocked>) => {
      if (!userId || busy) return;
      setBusy(true);
      setProblem(null);
      try {
        const result = await send();
        openSession(userId, result.unlockToken, result.expiresAt, result.idleSeconds);
        onOpenRef.current();
      } catch (error) {
        const next = problemOf(error);
        setProblem(next);
        if ((next.kind === 'wrong' || next.kind === 'slowed') && next.waitSeconds) setWait(next.waitSeconds);
      } finally {
        setBusy(false);
      }
    },
    [userId, busy]
  );

  return {
    busy,
    problem,
    wait,
    clearProblem: () => setProblem(null),
    unlock: (code: string) => attempt(() => payslipWrites.unlock(code)),
    setCode: (code: string) => attempt(() => payslipWrites.setCode(code)),
  };
}
