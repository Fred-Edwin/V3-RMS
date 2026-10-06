'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { usePurchasing } from '../hooks/use-purchasing';
import { isPurchasingError, type FileRef } from '../types';

export const sizeLabel = (bytes: number): string => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

/** What can go wrong with an upload, with the words Paper `35` uses. */
export type UploadProblem = { kind: 'failed' } | { kind: 'tooLarge'; size: number } | { kind: 'badType' };

/** A grey square standing in for the picture (the file's name and size are shown; the picture opens from its link). */
function Thumb({ white }: { white?: boolean }) {
  return <span className={cn('size-12 shrink-0 rounded-[2px] border border-wds-border', white ? 'bg-white' : 'bg-wds-neutral-100')} aria-hidden />;
}

/** Paper `35`, "Uploading": file name, percent and a thin progress bar. */
export function UploadingRow({ fileName, percent }: { fileName: string; percent: number }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 border border-wds-border bg-wds-surface p-3">
      <Thumb />
      <div className="flex min-w-0 grow flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-wds-sans text-wds-body-sm text-wds-neutral-950">{fileName}</span>
          <span className="font-wds-mono text-wds-caption text-wds-text-secondary">{percent}%</span>
        </div>
        <div className="h-1 bg-wds-neutral-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Uploading">
          <div className="h-full bg-wds-primary transition-[width] duration-150" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Paper `35`, "Could not upload" (red) and "File too large" (amber), each with the one button that fixes it. */
export function UploadProblemRow({ problem, onRetry, onChooseAnother }: { problem: UploadProblem; onRetry: () => void; onChooseAnother: () => void }) {
  if (problem.kind === 'failed') {
    return (
      <div role="alert" className="flex items-center gap-3 border border-wds-error-border bg-wds-error-bg p-3">
        <Thumb white />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-error-fg">Could not upload</span>
          <span className="font-wds-sans text-wds-caption text-wds-error-fg">Check your connection and try again. Nothing is lost.</span>
        </div>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div role="alert" className="flex items-center gap-3 border border-wds-warning-border bg-wds-warning-bg p-3">
      <Thumb white />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="font-wds-sans text-wds-body-sm font-semibold text-wds-warning-fg">{problem.kind === 'tooLarge' ? `This file is ${Math.round(problem.size / 1_000_000)} MB` : 'That is not a photo or a PDF'}</span>
        <span className="font-wds-sans text-wds-caption text-wds-warning-fg">
          {problem.kind === 'tooLarge' ? 'The limit is 10 MB. Take the photo again or pick a smaller one.' : 'Add a photo (JPG or PNG) or a PDF.'}
        </span>
      </div>
      <Button variant="secondary" size="sm" onClick={onChooseAnother}>
        Choose another
      </Button>
    </div>
  );
}

/**
 * One photo or PDF (the invoice, a proof of payment, a document for the file). Idle: the dashed drop area with Choose file and
 * Take photo (`compact` is the one-line version). Uploading, failed and too large are Paper `35`; filled shows the file with
 * Replace. The file goes to `POST /inventory/purchasing/uploads`; a dropped connection shows the retry row.
 */
export function PhotoSlot({
  value,
  onChange,
  label = 'Drop the invoice here',
  compact = false,
  idPrefix,
}: {
  value: FileRef | null;
  onChange: (file: FileRef | null) => void;
  label?: string;
  compact?: boolean;
  idPrefix: string;
}) {
  const { service } = usePurchasing();
  const chooseRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const lastFile = React.useRef<File | null>(null);
  const [busy, setBusy] = React.useState<{ name: string; percent: number } | null>(null);
  const [problem, setProblem] = React.useState<UploadProblem | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const upload = async (file: File): Promise<void> => {
    lastFile.current = file;
    setProblem(null);
    setBusy({ name: file.name, percent: 8 });
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setBusy((b) => (b ? { ...b, percent: Math.min(92, b.percent + 14) } : b)), 70);
    try {
      const ref = await service.upload(file);
      if (live.current) onChange(ref);
    } catch (e) {
      if (!live.current) return;
      if (isPurchasingError(e, 'UPLOAD_TOO_LARGE')) setProblem({ kind: 'tooLarge', size: file.size });
      else if (isPurchasingError(e, 'UPLOAD_BAD_TYPE')) setProblem({ kind: 'badType' });
      else setProblem({ kind: 'failed' });
    } finally {
      if (timer.current) clearInterval(timer.current);
      if (live.current) setBusy(null);
    }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void upload(f);
  };
  const retry = (): void => {
    const f = lastFile.current;
    if (f) void upload(f);
  };

  const inputs = (
    <>
      <input ref={chooseRef} id={`${idPrefix}-file`} type="file" accept="image/*,application/pdf" className="sr-only" onChange={pick} aria-label="Choose a photo or PDF" />
      <input ref={cameraRef} id={`${idPrefix}-camera`} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} aria-label="Take a photo" />
    </>
  );

  if (busy) return <UploadingRow fileName={busy.name} percent={busy.percent} />;

  if (value && !problem) {
    return (
      <div className="flex items-center gap-3 border border-wds-border bg-wds-surface p-3">
        <Thumb />
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate font-wds-sans text-wds-body-sm text-wds-neutral-950">{value.fileName}</span>
          <span className="font-wds-mono text-wds-caption text-wds-text-secondary">{sizeLabel(value.size)}</span>
        </div>
        <button type="button" onClick={() => chooseRef.current?.click()} className="font-wds-sans text-wds-caption text-wds-primary outline-none hover:underline focus-visible:shadow-wds-ring">
          Replace
        </button>
        {inputs}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {problem ? <UploadProblemRow problem={problem} onRetry={retry} onChooseAnother={() => chooseRef.current?.click()} /> : null}
      {!problem || problem.kind !== 'failed' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
          className={cn(
            'flex flex-col items-center border border-dashed text-center transition-colors',
            dragging ? 'border-wds-primary bg-wds-espresso-50' : 'border-wds-espresso-400 bg-wds-surface-sunken',
            compact ? 'gap-0.5 px-3 py-3' : 'gap-1.5 px-4 py-9'
          )}
        >
          {compact ? null : <Upload className="size-5 text-wds-primary" aria-hidden />}
          <span className={cn('font-wds-sans text-wds-neutral-950', compact ? 'text-wds-body-sm text-wds-text-secondary' : 'text-wds-body-sm font-medium')}>{label}</span>
          {compact ? null : <span className="font-wds-sans text-wds-caption text-wds-text-secondary">Photo or PDF, up to 10 MB</span>}
          <div className={cn('flex gap-2', compact ? 'mt-1.5' : 'mt-2')}>
            <Button type="button" variant="secondary" size="sm" onClick={() => chooseRef.current?.click()}>
              Choose file
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => cameraRef.current?.click()}>
              Take photo
            </Button>
          </div>
        </div>
      ) : null}
      {inputs}
    </div>
  );
}
