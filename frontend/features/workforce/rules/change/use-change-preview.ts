'use client';

import { useEffect, useRef, useState } from 'react';

import { toRemoteError } from '../../_shared';
import { rulesWrites } from '../services/rules-services';
import type { ChangeBody, Preview, RuleGroupCode } from '../types/rules-types';

export type PreviewState =
  | { status: 'loading'; preview: Preview | null }
  | { status: 'ready'; preview: Preview }
  | { status: 'error'; preview: Preview | null; message: string };

const DEBOUNCE_MS = 400;

/**
 * Asks the server what a change would do (impact rows, who is told, the earliest day) every time the body changes, 400 ms after the last
 * edit. An older answer never overwrites a newer one. The last good answer stays on screen while the next loads, so the rows do not flash.
 * `body` null = do not ask (dialog closed).
 */
export function useChangePreview(group: RuleGroupCode, body: ChangeBody | null): PreviewState & { refresh: () => void } {
  const [state, setState] = useState<PreviewState>({ status: 'loading', preview: null });
  const [tick, setTick] = useState(0);
  const latest = useRef(0);
  const signature = body ? JSON.stringify(body) : null;
  const bodyRef = useRef(body);
  bodyRef.current = body;

  useEffect(() => {
    if (signature === null) return;
    const mine = ++latest.current;
    setState((s) => ({ status: 'loading', preview: s.preview }));
    const timer = setTimeout(() => {
      const current = bodyRef.current;
      if (!current) return;
      rulesWrites.preview(group, current).then(
        (preview) => {
          if (mine === latest.current) setState({ status: 'ready', preview });
        },
        (err: unknown) => {
          if (mine === latest.current) setState((s) => ({ status: 'error', preview: s.preview, message: toRemoteError(err).message }));
        }
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [group, signature, tick]);

  return { ...state, refresh: () => setTick((n) => n + 1) };
}
