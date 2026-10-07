'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { scwErrorMessage } from '../../../_shared/lib/scw-errors';
import { COUNT_ERROR_COPY, COUNTING_STATES_COPY } from '../lib/states-copy';
import { countingApi } from '../services/counting-api';
import type { SaveLinesInput, SaveLinesResult } from '../types/counting-contract';

type Entry = SaveLinesInput['lines'][number];
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const DEBOUNCE_MS = 450;

export interface CountAutosave {
  status: AutosaveStatus;
  /** ISO time of the last successful save. */
  savedAt: string | null;
  /** The plain-words reason the last save failed, or null. */
  error: string | null;
  /** True while a number is typed but not yet on the server. */
  dirty: boolean;
  /** Queue one line (the last write for a line wins) and save quietly after a short pause. */
  save: (entry: Entry) => void;
  /** Save everything queued now (Next, Skip, leaving the screen). Resolves when the queue is empty or a save failed. */
  flush: () => Promise<boolean>;
  /** Try again after a failure; the numbers stay on the device meanwhile. */
  retry: () => Promise<boolean>;
}

/**
 * Quiet autosave for a count in progress ("Saved 07:19"). Lines are queued by id and written together; a failed save keeps the
 * queue (the number stays on this device) and reports `failed` so the screen can offer Try again. Never loses a number: a line
 * typed while a save is in flight is sent in the next one. Stable references.
 */
export function useCountAutosave(countId: string | null, onResult?: (result: SaveLinesResult) => void, initialSavedAt: string | null = null): CountAutosave {
  const queue = useRef(new Map<string, Entry>());
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onResultRef.current = onResult;
  });

  const run = useCallback(async (): Promise<boolean> => {
    if (!countId) return true;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) {
      // Wait for the save in flight, then send whatever was typed meanwhile.
      await inFlight.current;
      if (queue.current.size === 0) return true;
    }
    if (queue.current.size === 0) return true;
    const batch = Array.from(queue.current.values());
    const sending = new Map(queue.current);
    setStatus('saving');
    const attempt = (async (): Promise<boolean> => {
      try {
        const result = await countingApi.saveLines(countId, { lines: batch });
        sending.forEach((entry, id) => {
          if (queue.current.get(id) === entry) queue.current.delete(id);
        });
        setSavedAt(result.savedAt);
        setError(null);
        setDirty(queue.current.size > 0);
        setStatus('saved');
        onResultRef.current?.(result);
        return true;
      } catch (err) {
        setError(scwErrorMessage(err, COUNT_ERROR_COPY, COUNTING_STATES_COPY.countShelf.error));
        setStatus('failed');
        return false;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = attempt;
    const ok = await attempt;
    if (ok && queue.current.size > 0) return run();
    return ok;
  }, [countId]);

  const save = useCallback(
    (entry: Entry): void => {
      queue.current.set(entry.lineId, entry);
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void run();
      }, DEBOUNCE_MS);
    },
    [run],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Closing the tab with an unsaved number asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  return { status, savedAt, error, dirty, save, flush: run, retry: run };
}
