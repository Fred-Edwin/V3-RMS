'use client';

import * as React from 'react';

import { DialogButton, KitDialog } from '../../../../_shared';
import { peopleWrites } from '../../../_shared/services/people-writes';
import { useFileAction } from '../../hooks/use-file-action';
import { DOCUMENT_TYPE_LABELS } from '../../lib/documents-rows';
import { firstName } from '../../lib/file-model';
import { MAX_UPLOAD_MB, fileProblem } from '../../lib/upload-rules';
import { DialogError, DialogPicker, FooterNote } from './dialog-fields';
import type { FileDialogProps } from './file-dialogs';

/** A choose-or-drop box. A phone's "choose" offers the camera, which is the photo path the design asks for. */
function FileBox({ accept, file, onFile, label, hint }: { accept: string; file: File | null; onFile: (f: File | null) => void; label: string; hint: string }) {
  const [over, setOver] = React.useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files[0] ?? null);
      }}
      className={`flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed px-4 text-center has-[:focus-visible]:shadow-wds-ring ${over ? 'border-wds-primary bg-wds-caramel-100' : 'border-wds-neutral-400'}`}
    >
      <input type="file" accept={accept} autoComplete="off" aria-label={label} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{file ? file.name : label}</span>
      <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{file ? `${(file.size / 1_000_000).toFixed(1)} MB` : hint}</span>
    </label>
  );
}

const ACCEPT = 'image/jpeg,image/png,application/pdf';

/** Upload a document (W27, Paper `13VM-0`): what it is, the file, up to 10 MB. Opening it later is logged. */
export function UploadDialog({ file, onClose, done }: FileDialogProps) {
  const [type, setType] = React.useState('OTHER');
  const [chosen, setChosen] = React.useState<File | null>(null);
  const [shown, setShown] = React.useState(false);
  const action = useFileAction((m) => done(m ?? 'Document added.'));
  const first = firstName(file.name);
  const problem = fileProblem(chosen, ACCEPT);
  const send = (): void => {
    setShown(true);
    if (problem || !chosen) return;
    void action.run(() => peopleWrites.uploadDocument(file.id, chosen, type), `${chosen.name} is on ${first}'s file.`);
  };
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Upload a document"
      description={`For ${file.name}. Photos, PDFs and scans up to ${MAX_UPLOAD_MB} MB.`}
      width={540}
      busy={action.busy}
      footer={
        <>
          <FooterNote>{first} sees that it was added. Every opening is logged.</FooterNote>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" onClick={send} disabled={action.busy}>{action.busy ? 'Uploading…' : 'Upload'}</DialogButton>
        </>
      }
    >
      <DialogPicker label="What is it?" value={type} onChange={setType} options={Object.entries(DOCUMENT_TYPE_LABELS).filter(([k]) => k !== 'CONTRACT').map(([value, label]) => ({ value, label }))} />
      <FileBox accept={ACCEPT} file={chosen} onFile={setChosen} label="Drop the file here, or choose it" hint="On a phone, take a photo instead" />
      {shown && (problem || !chosen) ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{problem ?? 'Choose a file first.'}</p> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}

/** Photo (W8): replaces the initials everywhere. */
export function PhotoDialog({ file, onClose, done, own = false }: FileDialogProps & { own?: boolean }) {
  const [chosen, setChosen] = React.useState<File | null>(null);
  const action = useFileAction((m) => done(m ?? 'Photo saved.'));
  const problem = fileProblem(chosen, 'image/jpeg,image/png');
  return (
    <KitDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={own ? 'Your photo' : `${firstName(file.name)}'s photo`}
      description="It replaces the initials everywhere."
      width={500}
      busy={action.busy}
      footer={
        <>
          <DialogButton kind="cancel" size="lg" onClick={onClose} disabled={action.busy}>Cancel</DialogButton>
          <DialogButton kind="primary" size="lg" disabled={action.busy || !chosen || problem !== null} onClick={() => chosen && void action.run(() => peopleWrites.photo(file.id, chosen), 'Photo saved.')}>{action.busy ? 'Uploading…' : 'Save photo'}</DialogButton>
        </>
      }
    >
      <FileBox accept="image/jpeg,image/png" file={chosen} onFile={setChosen} label="Drop a photo here, or choose it" hint="JPG or PNG. On a phone, take a photo" />
      {problem ? <p role="alert" className="m-0 font-wds-sans text-[12px] leading-4 text-wds-error-fg">{problem}</p> : null}
      <DialogError message={action.error} />
    </KitDialog>
  );
}
