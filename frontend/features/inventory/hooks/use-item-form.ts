import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { createItem, getItem, listCategories, listSuppliers, retireItem, updateItem } from '../services';
import type { Category, CreateItemInput, InventoryItem, Supplier, UpdateItemInput } from '../types';

/**
 * Loads the picker option lists (categories, suppliers) the Item Form needs,
 * plus the existing item when editing. Used by both the desktop drawer and
 * the mobile full-screen route — same hook, different shell.
 */
export function useItemFormOptions() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [categoryList, supplierList] = await Promise.all([
        listCategories({ includeRetired: false }),
        listSuppliers({ includeRetired: false, perPage: 100 }),
      ]);
      setCategories(categoryList);
      setSuppliers(supplierList.data);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load categories or suppliers.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Appends a just-created supplier locally instead of a full reload, so the picker can select it immediately. */
  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliers((prev) => [...prev, supplier]);
  }, []);

  return { categories, suppliers, status, error, reload: load, addSupplier };
}

export function useItem(itemId: string | null) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>(itemId ? 'loading' : 'ready');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId) {
      setItem(null);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const found = await getItem(itemId);
      setItem(found);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load this item.'));
      setStatus('error');
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { item, status, error, reload: load };
}

export interface SaveItemResult {
  warnings: Array<{ code: 'DUPLICATE_ITEM_NAME'; message: string }>;
}

/** Wraps create/update so the screen only deals with one `save` call and its warnings. */
export function useSaveItem() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (input: CreateItemInput | UpdateItemInput, existingId?: string): Promise<SaveItemResult | null> => {
      setSaving(true);
      setError(null);
      try {
        const response = existingId
          ? await updateItem(existingId, input as UpdateItemInput)
          : await createItem(input as CreateItemInput);
        return { warnings: response.warnings };
      } catch (err) {
        setError(formatApiErrorMessage(err, 'Could not save this item.'));
        return null;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  return { save, saving, error };
}

/** Retire (soft-delete) an existing item — no orphan-block case on the contract (unlike suppliers), items are never referenced by other live records this milestone. */
export function useRetireItem() {
  const [retiring, setRetiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retire = useCallback(async (id: string): Promise<boolean> => {
    setRetiring(true);
    setError(null);
    try {
      await retireItem(id);
      return true;
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not archive this item.'));
      return false;
    } finally {
      setRetiring(false);
    }
  }, []);

  return { retire, retiring, error };
}
