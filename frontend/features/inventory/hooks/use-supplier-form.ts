import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/types/api';
import { createSupplier, getSupplier, listCategories, updateSupplier } from '../services';
import type { Category, CreateSupplierInput, Supplier, UpdateSupplierInput } from '../types';

export function useSupplierFormOptions() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const list = await listCategories({ includeRetired: false });
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

  return { categories, status, error, reload: load };
}

export function useSupplier(supplierId: string | null) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>(supplierId ? 'loading' : 'ready');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supplierId) {
      setSupplier(null);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const found = await getSupplier(supplierId);
      setSupplier(found);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this supplier.');
      setStatus('error');
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { supplier, status, error, reload: load };
}

export function useSaveSupplier() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (input: CreateSupplierInput | UpdateSupplierInput, existingId?: string) => {
    setSaving(true);
    setError(null);
    try {
      const saved = existingId
        ? await updateSupplier(existingId, input as UpdateSupplierInput)
        : await createSupplier(input as CreateSupplierInput);
      return saved;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this supplier.');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}
