'use client';

import * as React from 'react';

import type { FileBlob } from '../types/leave-types';

/** Hands a downloaded file to the browser's save flow under `fileName`. Client side only. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled; revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Share only where the browser can hand a PDF file to the share sheet. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'a.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/** Download or share one slip. Busy while it goes; a failure leaves the button usable with one line of words. Nothing is kept. */
export function useFileAction() {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const run = React.useCallback(async (load: () => Promise<FileBlob>, failure: string, then: (file: FileBlob) => Promise<void> | void) => {
    setBusy(true);
    setFailed(null);
    try {
      await then(await load());
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(failure);
    } finally {
      setBusy(false);
    }
  }, []);

  const download = React.useCallback((load: () => Promise<FileBlob>, failure: string) => run(load, failure, (f) => saveBlob(f.blob, f.filename)), [run]);
  const share = React.useCallback(
    (load: () => Promise<FileBlob>, failure: string, title: string) =>
      run(load, failure, async (f) => {
        await navigator.share({ files: [new File([f.blob], f.filename, { type: 'application/pdf' })], title });
      }),
    [run]
  );
  return { busy, failed, download, share };
}
