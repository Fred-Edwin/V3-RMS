'use client';

import * as React from 'react';

import { saveBlob } from '../lib/save-blob';
import type { FileBlob } from '../types/payslip-types';

/**
 * Download or share one stored file. "Preparing…" shows while it goes; a failure leaves the button usable with one line of words.
 * `slow` turns true after 10 seconds so the button can say it is still working. Nothing is kept: the bytes are saved or shared, then dropped.
 */
export function useFileAction() {
  const [busy, setBusy] = React.useState(false);
  const [slow, setSlow] = React.useState(false);
  const [failed, setFailed] = React.useState<string | null>(null);

  const run = React.useCallback(async (load: () => Promise<FileBlob>, failure: string, then: (file: FileBlob) => Promise<void> | void) => {
    setBusy(true);
    setFailed(null);
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    try {
      await then(await load());
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(failure);
    } finally {
      window.clearTimeout(timer);
      setSlow(false);
      setBusy(false);
    }
  }, []);

  const download = React.useCallback((load: () => Promise<FileBlob>, failure: string) => run(load, failure, (f) => saveBlob(f.blob, f.filename)), [run]);

  const share = React.useCallback(
    (load: () => Promise<FileBlob>, failure: string, title: string) =>
      run(load, failure, async (f) => {
        const file = new File([f.blob], f.filename, { type: 'application/pdf' });
        await navigator.share({ files: [file], title });
      }),
    [run]
  );

  return { busy, slow, failed, download, share, clearFailure: () => setFailed(null) };
}

/** PD32: Share only where the browser can hand a PDF file to the phone's share sheet. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob(['x'])], 'a.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}
