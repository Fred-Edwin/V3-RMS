'use client';

import * as React from 'react';

import type { FileBlob } from '../types/conduct-types';

/**
 * Download or share one letter. "Preparing…" shows while it goes; a failure leaves the button usable with one line of words. Nothing is
 * kept: the bytes are saved or shared, then dropped. A closed share sheet is not a failure.
 */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked after the click is handled; revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'a.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

export function useLetterAction() {
  const [busy, setBusy] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const run = React.useCallback(async (load: () => Promise<FileBlob>, failure: string, then: (file: FileBlob) => Promise<void> | void) => {
    setBusy(true);
    setFailed(null);
    try {
      await then(await load());
    } catch (error) {
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
  const clearFailure = React.useCallback(() => setFailed(null), []);

  return { busy, failed, download, share, clearFailure };
}
