import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { createSupplier, listItems, listSuppliers } from '../services';
import { createExpectedDelivery, getLastPrice, getRecentSupplierItems } from '../services/receiving-api-service';
import type { CreateSupplierInput, InventoryItem, Supplier } from '../types';
import type { CreateExpectedDeliveryInput, ExpectedDeliverySummary, RecentSupplierItem } from '../types/receiving';

/**
 * Supplier + item picker option lists for the New purchase full page.
 * Gated on `open` (true for the always-mounted full page) — kept as a param
 * rather than an unconditional fetch since the old drawer variant needed the
 * gate and the full-page screen just passes `true`.
 */
export function useNewPurchaseOptions(open: boolean) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [supplierList, itemList] = await Promise.all([
        listSuppliers({ includeRetired: false, perPage: 100 }),
        listItems({ includeRetired: false, perPage: 100 }),
      ]);
      setSuppliers(supplierList.data);
      setItems(itemList.data);
      setStatus('ready');
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not load suppliers or items.'));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  /** Appends a just-created supplier locally instead of a full reload, so the picker can select it immediately. */
  const addSupplier = useCallback((supplier: Supplier) => {
    setSuppliers((prev) => [...prev, supplier]);
  }, []);

  return { suppliers, items, status, error, reload: load, addSupplier };
}

/**
 * Inline supplier quick-create from the New Purchase item picker's supplier
 * field (2026-09-17 UI refinement) — minimum viable fields only (name,
 * phone, payment terms); the full supplier form remains the place to fill in
 * category/contact/email/location later. Reuses the existing
 * `POST /inventory/suppliers` endpoint, no new backend work.
 */
export function useCreateSupplierInline() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (input: CreateSupplierInput): Promise<Supplier | null> => {
    setSaving(true);
    setError(null);
    try {
      return await createSupplier(input);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not create this supplier.'));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { create, saving, error };
}

/** "Recently purchased from this supplier" section for the item combobox — empty until a supplier is selected. */
export function useRecentSupplierItems(supplierId: string | null) {
  const [items, setItems] = useState<RecentSupplierItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!supplierId) {
      setItems([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void getRecentSupplierItems(supplierId)
      .then((result) => {
        if (!cancelled) {
          setItems(result);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  return { items, status };
}

/**
 * "Last purchase 2 Sep · KES 6,410 · milk, cream, yoghurt" reference caption
 * (`UEP-0`) — keyed to the selected supplier's most-purchased item as a
 * proxy, since the endpoint is per-item (`GET /inventory/items/:id/last-price`),
 * not per-supplier. Only the unit price + date are real; the item-names
 * fragment is cosmetic copy the contract doesn't return, so it's omitted
 * here rather than fabricated.
 */
export function useLastPrice(itemId: string | null) {
  const [lastPrice, setLastPrice] = useState<{ unitPrice: string; asOf: string } | null>(null);

  useEffect(() => {
    if (!itemId) {
      setLastPrice(null);
      return;
    }
    let cancelled = false;
    void getLastPrice(itemId).then((result) => {
      if (!cancelled) setLastPrice(result);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  return lastPrice;
}

export function useSaveExpectedDelivery() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async (input: CreateExpectedDeliveryInput): Promise<ExpectedDeliverySummary | null> => {
    setSaving(true);
    setError(null);
    try {
      return await createExpectedDelivery(input);
    } catch (err) {
      setError(formatApiErrorMessage(err, 'Could not save this purchase.'));
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  return { save, saving, error };
}
