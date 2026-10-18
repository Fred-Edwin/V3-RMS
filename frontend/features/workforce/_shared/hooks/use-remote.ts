'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/types/api';

/**
 * One piece of remote data: `loading` until the first answer, then `ready` with the data or `error` with what went wrong.
 * `reload` asks again and keeps the old data on screen while it does (no flash). `enabled: false` waits (permissions still loading).
 *
 * `load` may be an inline function: it is read through a ref, so a new function each render never refetches. The effect runs again
 * only when `key` changes, so pass whatever makes the answer different (an id) as the key.
 */
export type Remote<T> =
  | { status: 'loading'; data: T | null; error: null; reload: () => void }
  | { status: 'ready'; data: T; error: null; reload: () => void }
  | { status: 'error'; data: T | null; error: RemoteError; reload: () => void };

export interface RemoteError {
  message: string;
  /** The HTTP status when the server answered (403 and 404 read differently on screen); 0 when it never did. */
  status: number;
  code: string;
}

export function toRemoteError(err: unknown): RemoteError {
  if (err instanceof ApiError) return { message: err.message, status: err.statusCode, code: err.code };
  return { message: err instanceof Error ? err.message : 'Something went wrong', status: 0, code: 'NETWORK' };
}

export function useRemote<T>(load: () => Promise<T>, key: string, enabled = true): Remote<T> {
  const [state, setState] = useState<{ key: string; data: T | null; error: RemoteError | null }>({ key, data: null, error: null });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRef.current().then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null });
      },
      (err: unknown) => {
        if (!cancelled) setState((s) => ({ key, data: s.key === key ? s.data : null, error: toRemoteError(err) }));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key, enabled, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const mine = state.key === key ? state : { key, data: null, error: null };
  if (mine.error) return { status: 'error', data: mine.data, error: mine.error, reload };
  if (mine.data !== null) return { status: 'ready', data: mine.data, error: null, reload };
  return { status: 'loading', data: null, error: null, reload };
}
