'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import type { SupplierDocType } from '../../types/supplier';
import { useAction } from '../../hooks/use-async';
import { uploadSupplierDocument } from '../../services';
import { DOC_TYPE_LABEL } from '../../lib/supplier-logic';
import { DrawerError, DrawerFrame, FieldLabel, PrimaryFooterButton, SecondaryFooterButton, fieldClass } from '../catalog/drawer-parts';
import { ChoiceChip } from './supplier-ui';

const TYPES: readonly SupplierDocType[] = ['PRICE_LIST', 'CONTRACT', 'INVOICE', 'DELIVERY_NOTE', 'RECEIPT', 'TAX_DOCUMENT', 'OTHER'];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** "1.4 MB" */
const sizeText = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export interface UploadViewProps {
  supplierId: string;
  supplierName: string;
  onCancel: () => void;
  onUploaded: () => void;
}

/** Upload a photo or PDF (JPEG, PNG, WebP or PDF, up to 10 MB). Files are never deleted: a newer one replaces an old one by being added. */
export function UploadView({ supplierId, supplierName, onCancel, onUploaded }: UploadViewProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [docType, setDocType] = React.useState<SupplierDocType>('PRICE_LIST');
  const [docDate, setDocDate] = React.useState('');
  const [note, setNote] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const upload = useAction(uploadSupplierDocument, 'Could not upload the file.');

  const pick = (picked: File | null) => {
    upload.clear();
    if (!picked) return setFile(null);
    if (!ALLOWED.includes(picked.type)) {
      setFile(null);
      return setFileError('Only photos (JPEG, PNG, WebP) and PDFs can be uploaded.');
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      return setFileError('That file is larger than 10 MB.');
    }
    setFileError(null);
    setFile(picked);
  };

  const submit = async () => {
    if (!file) return setFileError('Choose a file first.');
    const saved = await upload.run(supplierId, { file, docType, ...(docDate ? { docDate } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    if (saved) onUploaded();
  };

  return (
    <DrawerFrame
      eyebrow={supplierName}
      title="Upload file"
      subtitle="A photo or PDF kept with this supplier. Files are never deleted; add a newer one to replace it."
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <SecondaryFooterButton onClick={onCancel}>Cancel</SecondaryFooterButton>
          <PrimaryFooterButton onClick={submit} disabled={upload.saving}>
            {upload.saving ? 'Uploading…' : 'Upload'}
          </PrimaryFooterButton>
        </div>
      }
    >
      {upload.failure ? <DrawerError>{upload.failure.message}</DrawerError> : null}
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="doc-file">File</FieldLabel>
        <label
          htmlFor="doc-file"
          className={cn(
            'flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed bg-white px-4 py-4 text-center transition-colors hover:bg-wds-neutral-50 focus-within:border-wds-selected-edge',
            fileError ? 'border-wds-error-fg' : 'border-wds-border-strong'
          )}
        >
          <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{file ? file.name : 'Choose a photo or PDF'}</span>
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{file ? sizeText(file.size) : 'JPEG, PNG, WebP or PDF, up to 10 MB'}</span>
        </label>
        <input id="doc-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        {fileError ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{fileError}</span> : null}
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel>What is it?</FieldLabel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of document">
          {TYPES.map((t) => (
            <ChoiceChip key={t} selected={docType === t} onClick={() => setDocType(t)}>
              {DOC_TYPE_LABEL[t]}
            </ChoiceChip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="doc-date" hint="optional">
          Date on the document
        </FieldLabel>
        <input id="doc-date" name="docDate" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={cn(fieldClass, 'h-10 w-[200px] font-wds-mono')} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="doc-note" hint="optional">
          Note
        </FieldLabel>
        <textarea id="doc-note" name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={cn(fieldClass, 'h-auto min-h-[56px] resize-none py-2.5 text-[13px] leading-[18px]')} />
      </div>
    </DrawerFrame>
  );
}
