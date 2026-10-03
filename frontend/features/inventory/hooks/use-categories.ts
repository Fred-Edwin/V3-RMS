import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { createCategory, listCategories, restoreCategory, retireCategory, updateCategory } from '../services';
import type { Category } from '../types';

/**
 * Manage Categories screen — list + add/rename/retire/restore, all against
 * `includeRetired: true`.
 *
 * `onChange` (optional) fires after every successful mutation — the category
 * list here is entirely separate state from whatever screen opened this
 * drawer (e.g. Item Catalog's own `categories`, used by the Item Form's
 * Category dropdown), so without this callback a category added here never
 * reaches the Item Form until a full page reload.
 */
export function useCategoryManager(onChange?: () => void) {
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
      setError(formatApiErrorMessage(err, 'Could not load categories.'));
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
        onChange?.();
      } catch (err) {
        setActionError(formatApiErrorMessage(err, 'Could not add that category.'));
      }
    },
    [load, onChange]
  );

  const renameCategory = useCallback(
    async (id: string, name: string) => {
      setActionError(null);
      try {
        await updateCategory(id, { name });
        await load();
        onChange?.();
      } catch (err) {
        setActionError(formatApiErrorMessage(err, 'Could not rename that category.'));
      }
    },
    [load, onChange]
  );

  const retire = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await retireCategory(id);
        await load();
        onChange?.();
      } catch (err) {
        setActionError(formatApiErrorMessage(err, 'Could not retire that category.'));
      }
    },
    [load, onChange]
  );

  const restore = useCallback(
    async (id: string) => {
      setActionError(null);
      try {
        await restoreCategory(id);
        await load();
        onChange?.();
      } catch (err) {
        setActionError(formatApiErrorMessage(err, 'Could not restore that category.'));
      }
    },
    [load, onChange]
  );

  return { categories, status, error, actionError, reload: load, addCategory, renameCategory, retire, restore };
}
