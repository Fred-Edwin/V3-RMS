'use client';

import * as React from 'react';

import { useAuthStore } from '@/store/authStore';
import { ApiError, formatApiErrorMessage } from '@/types/api';

import { clearDraft, draftKey, newKey, readDraft, writeDraft, writeRate } from '../../_shared/lib/draft-store';
import { casualReads, casualWrites } from '../../_shared/services/casual-services';
import type { DraftLine, Sheet } from '../../_shared/types/casual-types';

export const CHANGED_WORDS = 'This changed while you were looking. Check it again.';
const RETRY_MS = 20_000;

const asDraft = (sheet: Sheet): DraftLine[] => sheet.lines.map((l) => ({ casualId: l.casualId, name: l.name, idMasked: l.idMasked, start: l.start, end: l.end, endsNextDay: l.endsNextDay }));
/** A request that never got an answer: no signal. An answer with a status, even an error, is not "offline". */
const isOffline = (error: unknown): boolean => !(error instanceof ApiError) || error.code === 'NETWORK';

/**
 * One department's day on the head's phone. The lines the head sees are the phone's copy; every change is saved on the phone first and
 * sent at once. With no signal the copy waits (marked "saved on this phone") and goes by itself when the signal returns; the same
 * key is reused for the same lines so a lost answer can be retried safely. A stale version (two heads) refreshes with words.
 */
export function useDaySheet(siteId: string, departmentId: string, date: string) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const key = draftKey(userId, siteId, departmentId, date);
  const [sheet, setSheet] = React.useState<Sheet | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [lines, setLines] = React.useState<DraftLine[]>([]);
  const [pending, setPending] = React.useState(false);
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const flying = React.useRef(false);
  const sheetRef = React.useRef<Sheet | null>(null);
  sheetRef.current = sheet;

  const take = React.useCallback((next: Sheet) => {
    setSheet(next);
    setLines(asDraft(next));
  }, []);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const fresh = await casualReads.day(siteId, departmentId, date);
      writeRate(siteId, departmentId, fresh.rate);
      setSheet(fresh);
      const held = readDraft(key);
      if (held) {
        setLines(held.lines);
        setPending(true);
      } else {
        setLines(asDraft(fresh));
        setPending(false);
      }
      setOffline(false);
    } catch (error) {
      // A phone that already has a saved day can still show it.
      const held = readDraft(key);
      if (held && isOffline(error)) {
        setLines(held.lines);
        setPending(true);
        setOffline(true);
      } else setLoadError(formatApiErrorMessage(error, 'We could not load this day. Nothing was changed.'));
    }
  }, [siteId, departmentId, date, key]);

  React.useEffect(() => {
    setSheet(null);
    setLines([]);
    setPending(false);
    setMessage(null);
    void load();
  }, [load]);

  /** Sends the phone's copy if it is waiting. True when the server now holds it (or nothing was waiting). */
  const flush = React.useCallback(async (): Promise<boolean> => {
    const held = readDraft(key);
    if (!held) return true;
    if (flying.current) return false;
    flying.current = true;
    try {
      const saved = await casualWrites.putLines({ siteId, departmentId, date, version: held.version, idempotencyKey: held.idempotencyKey, lines: held.lines.map((l) => ({ casualId: l.casualId, start: l.start, end: l.end, endsNextDay: l.endsNextDay })) });
      setOffline(false);
      const newer = readDraft(key);
      if (newer && newer.idempotencyKey !== held.idempotencyKey) {
        // The head edited again while this was going: keep the newer lines, move them onto the saved version, and send them next.
        setSheet(saved);
        writeDraft(key, { ...newer, version: saved.version });
        flying.current = false;
        return flush();
      }
      clearDraft(key);
      take(saved);
      setPending(false);
      return true;
    } catch (error) {
      if (isOffline(error)) {
        setOffline(true);
        return false;
      }
      // The server said no (changed underneath, overlap, no rate, too old): its answer is the truth, the phone's copy is dropped.
      clearDraft(key);
      setMessage(error instanceof ApiError && error.code === 'CHANGED_UNDERNEATH' ? CHANGED_WORDS : formatApiErrorMessage(error, 'That did not go through.'));
      setPending(false);
      await load();
      return false;
    } finally {
      flying.current = false;
    }
  }, [key, siteId, departmentId, date, take, load]);

  React.useEffect(() => {
    if (!pending) return;
    const retry = () => void flush();
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, RETRY_MS);
    retry();
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [pending, flush]);

  const edit = React.useCallback(
    (next: DraftLine[]) => {
      setMessage(null);
      setLines(next);
      setPending(true);
      writeDraft(key, { version: sheetRef.current?.version ?? 0, idempotencyKey: newKey(), lines: next, savedAt: Date.now() });
      void flush();
    },
    [key, flush]
  );

  /** Send and take-back need the signal: the phone's copy goes first, then the call. */
  const act = React.useCallback(
    async (call: (id: string, version: number) => Promise<Sheet>, doneWords: string | null) => {
      setBusy(true);
      setMessage(null);
      try {
        if (!(await flush())) {
          setMessage('No signal. Send when you are back online.');
          return;
        }
        const current = sheetRef.current;
        if (!current?.id) return;
        take(await call(current.id, current.version));
        if (doneWords) setMessage(doneWords);
      } catch (error) {
        if (isOffline(error)) setMessage('No signal. Send when you are back online.');
        else {
          setMessage(error instanceof ApiError && error.code === 'CHANGED_UNDERNEATH' ? CHANGED_WORDS : formatApiErrorMessage(error, 'That did not go through.'));
          await load();
        }
      } finally {
        setBusy(false);
      }
    },
    [flush, take, load]
  );

  const send = React.useCallback(() => act((id, version) => casualWrites.send(id, { version, idempotencyKey: newKey() }), 'Sent. The Branch Manager is told.'), [act]);
  const takeBack = React.useCallback(() => act((id, version) => casualWrites.takeBack(id, { version, idempotencyKey: newKey() }), null), [act]);

  return { sheet, lines, pending, offline, busy, message, loadError, edit, send, takeBack, reload: load, dismiss: () => setMessage(null), adopt: take };
}
