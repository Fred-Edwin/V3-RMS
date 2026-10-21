'use client';

import { useCallback, useMemo, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';

import { useRemote } from '../../../_shared';
import { RECORD_COPY, thisMonth } from '../lib/my-record-words';
import { recordReads, recordWrites } from '../services/my-record-services';
import type { AnswerResult, RecordAnswer, RecordCard, RecordChip, RecordPage } from '../types/my-record-types';

const newKey = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** The list: a group chip, a range (this month to begin with), a numbered pager. Every change of group or range returns to page 1. */
export function useMyRecord() {
  const initial = useMemo(() => thisMonth(new Date()), []);
  const [event, setEvent] = useState<RecordChip>('all');
  const [range, setRange] = useState(initial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const list = useRemote<RecordPage>(() => recordReads.list({ event, from: range.from, to: range.to, page, pageSize }), `record:${event}:${range.from}:${range.to}:${page}:${pageSize}`);
  const chooseEvent = useCallback((next: RecordChip): void => {
    setEvent(next);
    setPage(1);
  }, []);
  const chooseRange = useCallback((next: { from: string; to: string }): void => {
    setRange(next);
    setPage(1);
  }, []);
  const changePageSize = useCallback((n: number): void => {
    setPageSize(n);
    setPage(1);
  }, []);
  const isMonth = range.from === initial.from && range.to === initial.to;
  return { event, range, page, pageSize, list, isMonth, thisMonth: initial, setPage, chooseEvent, chooseRange, changePageSize };
}

/** One entry's card. */
export function useRecordCard(id: string | null) {
  return useRemote<RecordCard | null>(() => (id ? recordReads.one(id) : Promise.resolve(null)), `record-card:${id ?? 'none'}`, id !== null);
}

/**
 * "That was me" and "This wasn't me". One key per entry per screen visit, so a double press is one answer. "This wasn't me" is the same
 * server step as the Security flow (every session ends, code cleared, System Admin told); the screen then shows that flow's password page.
 */
export function useAnswer(onAnswered: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys] = useState(() => new Map<string, string>());
  const answer = useCallback(
    async (id: string, value: RecordAnswer): Promise<AnswerResult | null> => {
      setBusy(true);
      setError(null);
      const slot = `${id}:${value}`;
      const key = keys.get(slot) ?? newKey();
      keys.set(slot, key);
      try {
        const result = await recordWrites.answer(id, value, key);
        onAnswered();
        return result;
      } catch (err) {
        setError(err instanceof ApiError && err.statusCode === 404 ? 'That entry no longer needs an answer.' : formatApiErrorMessage(err, RECORD_COPY.failed));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [keys, onAnswered]
  );
  return { busy, error, answer, clearError: () => setError(null) };
}
