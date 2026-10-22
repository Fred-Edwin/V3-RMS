'use client';

import * as React from 'react';

import { isListedBank } from '../../_shared/lib/kenyan-banks';
import { peopleWrites } from '../../_shared/services/people-writes';
import type { EmployeeFile } from '../../_shared/types/people-types';
import { useFileAction } from '../../file/hooks/use-file-action';
import { ownNumbersBody, ownNumbersFrom, touchesBank, validateOwnNumbers, type OwnNumbersForm } from '../lib/own-numbers';

/**
 * The person's own IDs and bank form (frames 8.1 to 8.3), shared by the phone page and the desktop dialog. It starts from what is on
 * file, sends only what changed, and saves at once: HR does not re-check. A bank or account change tells the Accountant (the server does).
 */
export function useOwnNumbers(file: Pick<EmployeeFile, 'sensitive'>, done: (message: string) => void) {
  const onFile = React.useMemo(() => ownNumbersFrom(file.sensitive), [file.sensitive]);
  const [form, setForm] = React.useState<OwnNumbersForm>(onFile);
  const [otherBank, setOtherBank] = React.useState(() => onFile.bankName !== '' && !isListedBank(onFile.bankName));
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Saved.'));
  const set = React.useCallback((patch: Partial<OwnNumbersForm>): void => setForm((f) => ({ ...f, ...patch })), []);
  const errors = validateOwnNumbers(form);
  const body = ownNumbersBody(form, onFile);
  const changed = Object.keys(body).length > 0;
  const run = action.run;
  const save = React.useCallback((): void => {
    setShown(true);
    if (Object.keys(errors).length > 0 || !changed) return;
    void run(() => peopleWrites.patchMe(body), 'Saved.');
  }, [errors, changed, run, body]);
  return { form, set, otherBank, setOtherBank, shown, errors, changed, bankChanging: touchesBank(body), save, busy: action.busy, error: action.error };
}

export type OwnNumbers = ReturnType<typeof useOwnNumbers>;
