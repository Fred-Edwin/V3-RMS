'use client';

import type { DeskDetail } from '../../_shared/types/conduct-types';
import { DecideDialog } from '../../decide/components/decide-dialog';
import { IssuePanel } from '../../issue/components/issue-panel';
import { RecordDialog } from '../../record/components/record-dialog';

/** Which dialog is open on the desk screen, and for which notice. */
export type DeskDialog = { kind: 'issue' } | { kind: 'record' | 'decide' | 'change'; detail: DeskDetail };

/**
 * The signed dialogs the desk screen opens: issue, record not signed, decide (and change). Each is mounted only while open, so its
 * fields and its idempotency key start fresh every time. Each reports back through `onDone` with the words to show and, for a new notice, its id.
 */
export function DeskDialogs({ dialog, onClose, onDone }: { dialog: DeskDialog | null; onClose: () => void; onDone: (message: string, noticeId?: string) => void }) {
  if (!dialog) return null;
  if (dialog.kind === 'issue') return <IssuePanel open onClose={onClose} onDone={onDone} />;
  if (dialog.kind === 'record') return <RecordDialog detail={dialog.detail} onClose={onClose} onDone={onDone} />;
  return <DecideDialog detail={dialog.detail} mode={dialog.kind === 'change' ? 'change' : 'decide'} onClose={onClose} onDone={onDone} />;
}
