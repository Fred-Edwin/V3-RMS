import * as React from 'react';

import { useIdempotencyKey } from '../../../_shared/hooks/use-idempotency-key';
import { scwErrorCode, scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { BRANCH_DAY_ERROR_COPY } from '../../_shared/lib/branch-day-copy';
import type { SignState } from '../components/phone-parts';

/**
 * One PIN-signed write (the opening recount, the evening count). One idempotency key per form, so a double tap or Enter twice writes
 * once. A wrong PIN clears the box and says so under it (the box takes focus back); any other refusal is a line above the button and
 * the form is kept. `onCode` lets a screen react to a code (ALREADY_COUNTED goes to "Count sent").
 */
export function useSign<R>(write: (pin: string, idempotencyKey: string) => Promise<R>, onDone: (result: R) => void, onCode?: (code: string) => boolean): SignState {
  const { key } = useIdempotencyKey();
  const [pin, setPinState] = React.useState('');
  const [pinError, setPinError] = React.useState<string | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const busy = React.useRef(false);
  const writeRef = React.useRef(write);
  const doneRef = React.useRef(onDone);
  const codeRef = React.useRef(onCode);
  React.useEffect(() => {
    writeRef.current = write;
    doneRef.current = onDone;
    codeRef.current = onCode;
  });

  const setPin = React.useCallback((next: string) => {
    setPinState(next);
    setPinError(null);
    setProblem(null);
  }, []);

  const submit = React.useCallback(() => {
    if (busy.current || pin.length !== 4) return;
    busy.current = true;
    setSaving(true);
    setPinError(null);
    setProblem(null);
    writeRef
      .current(pin, key())
      .then((result) => doneRef.current(result))
      .catch((err: unknown) => {
        const code = scwErrorCode(err);
        if (code === 'INVALID_PIN') {
          setPinState('');
          setPinError(BRANCH_DAY_ERROR_COPY.INVALID_PIN);
        } else if (code && codeRef.current?.(code)) {
          // The screen took it (it moved on).
        } else setProblem(scwErrorMessage(err, BRANCH_DAY_ERROR_COPY, 'Could not send this. Nothing was written. Try again.'));
      })
      .finally(() => {
        busy.current = false;
        setSaving(false);
      });
  }, [pin, key]);

  return { pin, setPin, pinError, problem, saving, ready: pin.length === 4 && !saving, submit };
}
