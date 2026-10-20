'use client';

import * as React from 'react';

import { ApiError } from '@/types/api';

import { newIdempotencyKey } from '../lib/device-and-keys';
import { conductError, waitSecondsOf } from '../lib/conduct-words';

/**
 * Runs one signed act (sign, record not signed, decide, issue): one try at a time, the server's words if it is refused, and a countdown
 * when the code is paused. A pause is never a lockout: the field stays usable and the button waits only for the seconds the server gave.
 * The idempotency key is made once for the open screen and used again for a retry after a lost answer (the same request twice returns
 * the first result); it is renewed after any answer the server gave, because the body can differ on the next try (a corrected code).
 */
export type ActProblem = { kind: 'wrong' | 'slowed' | 'notSet' | 'refused'; message: string };

export function useSignedAct() {
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<ActProblem | null>(null);
  const [wait, setWait] = React.useState(0);
  const key = React.useRef(newIdempotencyKey());

  React.useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  const run = React.useCallback(
    async <T,>(send: (idempotencyKey: string) => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
      setBusy(true);
      setProblem(null);
      try {
        const value = await send(key.current);
        return { ok: true, value };
      } catch (error) {
        const code = error instanceof ApiError ? error.code : '';
        const seconds = waitSecondsOf(error);
        if (seconds > 0) setWait(seconds);
        const kind: ActProblem['kind'] = code === 'PIN_INVALID' ? 'wrong' : code === 'PIN_SLOWED' ? 'slowed' : code === 'PIN_NOT_SET' ? 'notSet' : 'refused';
        setProblem({ kind, message: kind === 'slowed' && seconds > 0 ? `Wait ${seconds} seconds, then try again.` : conductError(error, 'That did not go through. Nothing was changed.') });
        // The server answered (it did not time out), so a fresh key keeps the next try from being read as a changed copy of this one.
        if (error instanceof ApiError && error.statusCode !== 0) key.current = newIdempotencyKey();
        return { ok: false };
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const clear = React.useCallback(() => setProblem(null), []);
  return { busy, problem, wait, run, clear };
}
