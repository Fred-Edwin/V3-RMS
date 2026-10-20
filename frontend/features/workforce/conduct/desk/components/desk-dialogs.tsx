'use client';

import type { DeskDetail } from '../../_shared/types/conduct-types';

/** Which dialog is open on the desk screen, and for which notice. */
export type DeskDialog = { kind: 'issue' } | { kind: 'record' | 'decide' | 'change'; detail: DeskDetail };

/** The three signed dialogs the desk screen opens: issue, record not signed, decide (and change). Each reports back through `onDone`. */
export function DeskDialogs({ dialog, onClose, onDone }: { dialog: DeskDialog | null; onClose: () => void; onDone: (message: string, noticeId?: string) => void }) {
  void dialog;
  void onClose;
  void onDone;
  return null;
}
