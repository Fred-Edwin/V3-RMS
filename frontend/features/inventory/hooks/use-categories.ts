import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/types/api';
import { createCategory, listCategories, restoreCategory, retireCategory, updateCategory } from '../services';
import type { Category } from '../types';

/** Manage Categories screen — list + add/rename/retire/restore, all against `includeRetired: true`. */
export function useCategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listCategories({ includeRetired: true });
      setCategories(list);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load categories.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addCategory = useCallback(
    async (name: string) => {
      setActionError(null);
      try {
        await createCategory({ name });
        await load();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not add that category.');
      }
    },
    [load]
  );

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      setActionError(null);
      try {
        await updateCategory(id, { name });
        await load();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not rename that category.');
      }
    },
    [load]
  );

  const retire = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await retireCategory(id);
        await load();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not retire that category.');
      }
    },
    [load]
  );

  const restore = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await restoreCategory(id);
        await load();
      } catch (err) {
        setActionError(err instanceof ApiError ? err.message : 'Could not restore that category.');
      }
    },
    [load]
  );

  return { categories, status, error, actionError, reload: load, addCategory, renameCategory, retire, restore };
}
