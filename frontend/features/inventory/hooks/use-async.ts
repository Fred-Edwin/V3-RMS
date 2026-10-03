import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Loads one thing when `key` changes (`null` = nothing to load). Only the latest request writes state, so
 * typing in a search box cannot show an older answer. `reload` and the returned fields are stable; a reload
 * of data already on screen keeps showing it (no flash to the loading state).
 */
export function useLoader<T>(key: string | null, fetcher: () => Promise<T>, fallbackMessage: string) {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const latest = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<LoadStatus>(key === null ? 'idle' : 'loading');
  const [error, setError] = useState<string | null>(null);
  const hasData = useRef(false);

  const load = useCallback(async () => {
    const request = ++latest.current;
    if (key === null) {
      hasData.current = false;
      setData(null);
      setStatus('idle');
      return;
    }
    if (!hasData.current) setStatus('loading');
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (request !== latest.current) return;
      hasData.current = true;
      setData(result);
      setStatus('ready');
    } catch (err) {
      if (request !== latest.current) return;
      setError(formatApiErrorMessage(err, fallbackMessage));
      setStatus('error');
    }
  }, [key, fallbackMessage]);

  // A different key is a different thing: forget the old one before loading.
  useEffect(() => {
    hasData.current = false;
    setData(null);
  }, [key]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, status, error, reload: load, setData };
}

export interface ActionFailure {
  message: string;
  code: string | null;
  details: unknown;
}

/**
 * One write (create, save, upload). `run` resolves to the result or `null` on failure; the failure stays in
 * `failure` so a drawer can show it at the top of its body and keep what was typed.
 */
export function useAction<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>, fallbackMessage: string) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ActionFailure | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<Result | null> => {
      setSaving(true);
      setFailure(null);
      try {
        return await fnRef.current(...args);
      } catch (err) {
        setFailure({
          message: formatApiErrorMessage(err, fallbackMessage),
          code: err instanceof ApiError ? err.code : null,
          details: err instanceof ApiError ? err.details : null,
        });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [fallbackMessage]
  );
  const clear = useCallback(() => setFailure(null), []);

  return { run, saving, failure, clear };
}
