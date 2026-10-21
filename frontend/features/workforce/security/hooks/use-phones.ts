'use client';

import { useCallback } from 'react';

import { useAction, useRemote } from '../../_shared';
import { useAuthStore } from '@/store/authStore';
import { phoneReads, phoneWrites } from '../services/security-services';

/**
 * The person's own phones. Confirming or removing one runs through `useAction` (busy, the server's own words if it refuses) and then reads
 * the list again. Another person's phone is a 404 on the server; this screen can only ever ask for its own.
 */
export function usePhones() {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const list = useRemote(() => phoneReads.list(), `phones:${userId}`);
  const { reload } = list;
  const afterWrite = useCallback((): void => reload(), [reload]);
  const action = useAction(afterWrite);

  const confirm = useCallback((id: string) => action.run(() => phoneWrites.confirm(id)), [action]);
  const remove = useCallback((id: string) => action.run(() => phoneWrites.remove(id), 'Removed.'), [action]);

  return { list, busy: action.busy, error: action.error, clearError: action.clearError, confirm, remove };
}
