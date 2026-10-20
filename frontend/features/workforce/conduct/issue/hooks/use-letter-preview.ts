'use client';

import * as React from 'react';

import { conductError } from '../../_shared/lib/conduct-words';
import { conductFiles } from '../../_shared/services/conduct-services';
import type { ConductAbout, ConductLevel } from '../../_shared/types/conduct-types';

/**
 * "Read the letter": asks the server for the DRAFT copy (stamped, no number, nothing stored) and opens it in a new tab. The tab is opened
 * first, in the click, so a pop-up blocker lets it through; the PDF is put into it when it arrives. A failure closes the empty tab and says why.
 */
export function useLetterPreview() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const open = React.useCallback(async (body: { personId: string; level: ConductLevel; about: ConductAbout; factsMonth?: string; ownLine: string }) => {
    setBusy(true);
    setError(null);
    const tab = window.open('about:blank', '_blank');
    try {
      const file = await conductFiles.draftPreview(body);
      const url = URL.createObjectURL(file.blob);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      setError(conductError(err, 'The letter could not be shown. Try again.'));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, open };
}
