'use client';

import { useEffect, useState } from 'react';

import { leaveWrites } from '../../../_shared/services/leave-services';
import { leaveErrorText } from '../../../_shared/lib/leave-copy';
import type { Preview } from '../../../_shared/types/leave-types';

export type PreviewState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; preview: Preview } | { status: 'failed'; text: string };

const DEBOUNCE_MS = 300;

/**
 * Asks the server what these days would be (M4, no side effects) 300 ms after the type or dates last changed. A newer answer replaces
 * an older one; an answer that arrives after the dates changed again is dropped.
 */
export function useRequestPreview(typeCode: string | null, start: string | null, end: string | null): PreviewState {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });

  useEffect(() => {
    if (!typeCode || !start || !end) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const timer = window.setTimeout(() => {
      leaveWrites.preview({ typeCode, start, end }).then(
        (preview) => {
          if (!cancelled) setState({ status: 'ready', preview });
        },
        (err: unknown) => {
          if (!cancelled) setState({ status: 'failed', text: leaveErrorText(err, 'Could not check those days. Try again.').text });
        }
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typeCode, start, end]);

  return state;
}
