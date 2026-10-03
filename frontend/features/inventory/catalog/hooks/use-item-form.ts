import { useCallback, useEffect, useRef, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import {
  addSupplierLine,
  createItem,
  getItem,
  getItemChangeReview,
  getItemHistory,
  listCategories,
  listItems,
  listSuppliers,
  restoreItem,
  retireItem,
  updateItem,
} from '../../services';
import type {
  AddSupplierLineInput,
  Category,
  CreateItemInput,
  InventoryItemDetail,
  InventoryItemListRow,
  InventoryItemType,
  ItemChangeReview,
  ItemHistoryEntry,
  Supplier,
  UpdateItemInput,
} from '../../types';

type LoadStatus = 'idle' | 'loading' | 'error' | 'ready';

/** Live categories for the Category picker. Fetches while `enabled`. */
export function useCategoryOptions(enabled: boolean) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      setCategories(await listCategories({ includeRetired: false }));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { categories, status, reload: load };
}

/** Live suppliers for "Add who sells it". Store Manager only; fetches while `enabled`. */
export function useSupplierOptions(enabled: boolean) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const response = await listSuppliers({ includeRetired: false, perPage: 100 });
      setSuppliers(response.data);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load suppliers.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { suppliers, status, error, reload: load };
}

/**
 * The item with who sells it, plus the change-review counts (on hand,
 * receipts, open orders) the item page and the review step both read.
 * `null` id = nothing to load. Only the latest request writes state.
 */
/** What the "review a change" step reads when it is not asked for (a read-only page never reaches that step). */
const EMPTY_REVIEW = (itemId: string): ItemChangeReview => ({
  inventoryItemId: itemId,
  itemName: '',
  onHandQty: '0',
  locationsHoldingStock: 0,
  stockEntries: 0,
  receipts: 0,
  receiptLines: 0,
  openOrders: 0,
  hasHistory: false,
});

/** `withReview: false` for a reader who cannot edit: the change-review counts are for the edit and retire steps and are refused to them. */
export function useItemDetail(itemId: string | null, withReview = true) {
  const [item, setItem] = useState<InventoryItemDetail | null>(null);
  const [review, setReview] = useState<ItemChangeReview | null>(null);
  // `null` = the history could not be read; the page then simply leaves the panel out.
  const [history, setHistory] = useState<ItemHistoryEntry[] | null>(null);
  const [status, setStatus] = useState<LoadStatus>(itemId ? 'loading' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const loadedId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const requestId = ++latest.current;
    if (!itemId) {
      loadedId.current = null;
      setItem(null);
      setReview(null);
      setHistory(null);
      setStatus('idle');
      return;
    }
    // A reload of the item already on screen keeps showing it; only a different item shows the loading state.
    if (loadedId.current !== itemId) setStatus('loading');
    setError(null);
    try {
      const [found, counts, changes] = await Promise.all([
        getItem(itemId),
        withReview ? getItemChangeReview(itemId) : Promise.resolve(EMPTY_REVIEW(itemId)),
        getItemHistory(itemId).catch(() => null),
      ]);
      if (requestId !== latest.current) return;
      loadedId.current = itemId;
      setItem(found);
      setReview(counts);
      setHistory(changes);
      setStatus('ready');
    } catch (err) {
      if (requestId !== latest.current) return;
      setError(formatApiErrorMessage(err, 'Could not load this item.'));
      setStatus('error');
    }
  }, [itemId, withReview]);

  useEffect(() => {
    void load();
  }, [load]);

  return { item, review, history, status, error, reload: load };
}

/**
 * The most similar live item to a name being typed (the warning inside the
 * Add drawer). "Similar" = another item whose name contains the last word of
 * the typed name (Brown sugar → Sugar, white). Debounced; the latest typed
 * name wins.
 */
export function useSimilarItem(name: string, excludeId: string | null, enabled: boolean) {
  const [similar, setSimilar] = useState<InventoryItemListRow | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const head = words[words.length - 1];
    if (!enabled || !head || head.length < 3) {
      latest.current++;
      setSimilar(null);
      return;
    }
    const requestId = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const response = await listItems({ search: head, perPage: 10 });
        if (requestId !== latest.current) return;
        const typed = name.trim().toLowerCase();
        const word = head.toLowerCase();
        const candidates = response.data.filter((row) => row.id !== excludeId && row.name.toLowerCase() !== typed && row.name.toLowerCase().includes(word));
        // A name that starts with the word ("Sugar, white") is a closer match than one that merely contains it ("Icing sugar").
        candidates.sort((a, b) => Number(b.name.toLowerCase().startsWith(word)) - Number(a.name.toLowerCase().startsWith(word)));
        setSimilar(candidates[0] ?? null);
      } catch {
        if (requestId === latest.current) setSimilar(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [name, excludeId, enabled]);

  return similar;
}

export interface SaveItemResult {
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  warnings: Array<{ code: 'DUPLICATE_ITEM_NAME'; message: string }>;
}

/** Wraps create/update so a view only deals with one `save` call. Returns `null` on failure (the message is in `error`). */
export function useSaveItem() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (input: CreateItemInput | UpdateItemInput, existingId?: string): Promise<SaveItemResult | null> => {
    setSaving(true);
    setError(null);
    try {
      const response = existingId ? await updateItem(existingId, input as UpdateItemInput) : await createItem(input as CreateItemInput);
      return { itemId: response.item.id, itemName: response.item.name, itemType: response.item.type, warnings: response.warnings };
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not save this item.'));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  return { save, saving, error, clearError };
}

/** Retire or restore an item. Nothing is deleted: history stays either way. */
export function useRetireRestoreItem() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(formatApiErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const retire = useCallback((id: string, reason?: string) => run(() => retireItem(id, reason), 'Could not retire this item.'), [run]);
  const restore = useCallback((id: string) => run(() => restoreItem(id), 'Could not restore this item.'), [run]);
  const clearError = useCallback(() => setError(null), []);
  return { retire, restore, busy, error, clearError };
}

/** Add one supplier pack line. A pack already on file is a 409 whose message is shown inline. */
export function useAddSupplierLine() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (supplierId: string, input: AddSupplierLineInput): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await addSupplierLine(supplierId, input);
      return true;
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not add this supplier.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);
  return { add, saving, error, clearError };
}
