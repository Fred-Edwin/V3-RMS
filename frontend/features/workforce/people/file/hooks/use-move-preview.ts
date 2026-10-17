'use client';

import { useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';

import type { MovePreview } from '../../_shared/types/people-types';

/**
 * Asks the server what a move or an exit would change, once the form is complete and has stopped changing for 300 ms. Nothing is
 * written by the preview. An answer for an older form is dropped. `key` stands for the form's values.
 */
export interface PreviewState {
  preview: MovePreview | null;
  loading: boolean;
  error: string | null;
}

export function useMovePreview(key: string, ready: boolean, load: () => Promise<MovePreview>): PreviewState {
  const [state, setState] = useState<{ key: string; preview: MovePreview | null; error: string | null }>({ key: '', preview: null, error: null });
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      loadRef.current().then(
        (preview) => !cancelled && setState({ key, preview, error: null }),
        (err: unknown) => !cancelled && setState({ key, preview: null, error: formatApiErrorMessage(err, 'We could not work out what changes.') })
      );
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [key, ready]);

  const fresh = ready && state.key === key;
  return { preview: fresh ? state.preview : null, loading: ready && !fresh, error: fresh ? state.error : null };
}
