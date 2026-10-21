'use client';

import * as React from 'react';

import type { EmployeeFile } from '../../../_shared/types/people-types';
import type { FileDialogKey } from '../../lib/file-model';
import { AskDialog, VerifyDialog } from './ask-verify-dialogs';
import { ContractDialog } from './contract-dialog';
import { DetailsDialog } from './details-dialog';
import { EditJobDialog } from './edit-job-dialog';
import { LoginDialog } from './login-dialog';
import { LoanDialog } from './move/loan-dialog';
import { RehireDialog, UndoExitDialog } from './move/exit-dialogs';
import { MoveDialog } from './move-dialog';
import { IdsBankDialog } from './ids-bank-dialog';
import { ChangePayDialog } from './pay/change-pay-dialog';
import { PayDecisionDialog } from './pay/pay-decision-dialog';
import { NoteDialog, ProbationDialog } from './probation-dialog';
import { PhotoDialog, UploadDialog } from './upload-dialogs';

/**
 * Opens the dialog the screen asked for. One dialog at a time; each takes the file, a way to close, and `done`, which reloads the
 * file and shows a line about what happened (with an Undo toast when the act can be undone for a short while).
 */
export interface OpenFileDialog {
  key: FileDialogKey;
  /** A file request (for "Remind") or a pay change (for the Director's decision). */
  requestId?: string;
}

export interface FileDialogProps {
  file: EmployeeFile;
  requestId?: string;
  onClose: () => void;
  done: (message: string, undo?: () => Promise<void>) => void;
}

const DIALOGS: Record<FileDialogKey, React.ComponentType<FileDialogProps>> = {
  'edit-job': EditJobDialog,
  'change-pay': ChangePayDialog,
  'pay-decision': PayDecisionDialog,
  move: MoveDialog,
  loan: LoanDialog,
  probation: ProbationDialog,
  note: NoteDialog,
  contract: ContractDialog,
  upload: UploadDialog,
  photo: PhotoDialog,
  rehire: RehireDialog,
  'undo-exit': UndoExitDialog,
  login: LoginDialog,
  details: DetailsDialog,
  'ids-bank': IdsBankDialog,
  ask: AskDialog,
  verify: VerifyDialog,
};

export function FileDialogs({ file, open, onClose, done }: { file: EmployeeFile; open: OpenFileDialog | null; onClose: () => void; done: FileDialogProps['done'] }) {
  if (!open) return null;
  const Dialog = DIALOGS[open.key];
  return <Dialog key={`${open.key}:${open.requestId ?? ''}`} file={file} requestId={open.requestId} onClose={onClose} done={done} />;
}
