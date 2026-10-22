'use client';

import * as React from 'react';

import type { ProbationVerdict } from '../../_shared/types/people-types';
import { peopleWrites } from '../../_shared/services/people-writes';
import { reportNeedsWords } from '../lib/probation-report';
import { useFileAction } from './use-file-action';

/** The head's report form (frames 9.1 and 9.3), shared by the phone page and the desktop dialog: a verdict, a note, one send. */
export function useProbationReport(personId: string, done: (message: string) => void) {
  const [verdict, setVerdict] = React.useState<ProbationVerdict | null>(null);
  const [note, setNote] = React.useState('');
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Report sent to HR.'));
  const needsWords = reportNeedsWords(verdict) && note.trim() === '';
  const run = action.run;
  const send = React.useCallback((): void => {
    setShown(true);
    if (!verdict || needsWords) return;
    void run(() => peopleWrites.probationNote(personId, { verdict, ...(note.trim() ? { note: note.trim() } : {}) }), 'Your report is with HR.');
  }, [verdict, needsWords, note, personId, run]);
  return { verdict, setVerdict, note, setNote, shown, needsWords, send, busy: action.busy, error: action.error };
}
