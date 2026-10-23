'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../_shared';
import { RECORD_COPY } from '../lib/my-record-words';

/** "Sign out every phone and computer?": the question before "This wasn't me" signs every session out. */
export function NotMeDialog({ open, busy, onClose, onConfirm }: { open: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <KitDialog
      open={open}
      onOpenChange={(o) => !busy && !o && onClose()}
      title={RECORD_COPY.confirmTitle}
      description={RECORD_COPY.confirmLine}
      busy={busy}
      width={440}
      footer={
        <>
          <DialogButton kind="cancel" disabled={busy} onClick={onClose}>{RECORD_COPY.confirmNo}</DialogButton>
          <DialogButton kind="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Signing you out…' : RECORD_COPY.confirmYes}</DialogButton>
        </>
      }
    >
      <span className="sr-only">This signs you out of every phone and computer.</span>
    </KitDialog>
  );
}
