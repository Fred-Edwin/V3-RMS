import { useCallback, useEffect, useState } from 'react';

import { formatApiErrorMessage } from '@/types/api';
import { listItems, listSuppliers } from '../services';
import { createExpectedDelivery, getLastPrice } from '../services/receiving-api-service';
import type { InventoryItem, Supplier } from '../types';
import type { CreateExpectedDeliveryInput, ExpectedDeliverySummary } from '../types/receiving';

/**
 * Supplier + item picker option lists for the New purchase drawer/full-screen.
 * Gated on `open` — `NewPurchaseDrawer` stays mounted inside the always-open
 * Purchasing hub screen, so an ungated fetch would hit these endpoints on
 * every hub page load even when the drawer is closed.
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

  return { suppliers, items, status, error, reload: load };
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
