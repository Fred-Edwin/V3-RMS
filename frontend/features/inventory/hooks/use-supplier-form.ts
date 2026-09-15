import { useCallback, useEffect, useState } from 'react';

import { ApiError, formatApiErrorMessage } from '@/types/api';
import { createSupplier, getSupplier, listCategories, retireSupplier, updateSupplier } from '../services';
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
      setError(formatApiErrorMessage(err, 'Could not load categories.'));
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
      setError(formatApiErrorMessage(err, 'Could not load this supplier.'));
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
      setError(formatApiErrorMessage(err, 'Could not save this supplier.'));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}

export interface RetireSupplierBlock {
  items: Array<{ id: string; name: string }>;
}

/**
 * Retire a supplier — the one retire path in this milestone that can be
 * blocked (409, `CONFLICT`) when a live item still names it as preferred
 * supplier. `blockedBy` surfaces the blocking item names so the confirm
 * dialog can escalate to a typed confirmation instead of just failing.
 */
export function useRetireSupplier() {
  const [retiring, setRetiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<RetireSupplierBlock | null>(null);

  const retire = useCallback(async (id: string): Promise<boolean> => {
    setRetiring(true);
    setError(null);
    setBlockedBy(null);
    try {
      await retireSupplier(id);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 409 && err.details && typeof err.details === 'object') {
        const details = err.details as { items?: Array<{ id: string; name: string }> };
        if (Array.isArray(details.items) && details.items.length > 0) {
          setBlockedBy({ items: details.items });
          return false;
        }
      }
      setError(formatApiErrorMessage(err, 'Could not archive this supplier.'));
      return false;
    } finally {
      setRetiring(false);
    }
  }, []);

  return { retire, retiring, error, blockedBy, clearBlock: () => setBlockedBy(null) };
}
