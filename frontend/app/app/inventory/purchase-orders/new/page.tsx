'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Save, Search, ShoppingCart, X } from 'lucide-react';
import { Select } from '@/components/ui';
import { itemTypeLabel } from '@/components/inventory/item-type-icon';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  createPurchaseOrder,
  getCentralStoreLocation,
  listInventoryItems,
  listSuppliers,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { buyUnitCostValue, formatBuyUnitCost } from '@/lib/inventory-format';
import type { InventoryItem, Supplier } from '@/types/inventory';

interface DraftLine {
  item: InventoryItem;
  qty: string;
  unitPrice: string;
}

// Shared route for both roles (§8.1 row 5 / §8.2 row 2) — Manager can send
// what they draft here, Attendant's draft always waits on the Manager, so
// only the confirmation/helper copy below differs by role.
export default function NewPurchaseOrderPage(): JSX.Element {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const isManager = role === 'STORE_MANAGER';
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Record<string, DraftLine>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setIsLoading(true);
      try {
        const [location, supplierList, itemList] = await Promise.all([
          getCentralStoreLocation(accessToken),
          listSuppliers(accessToken),
          listInventoryItems(accessToken),
        ]);
        if (!location) {
          toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
          return;
        }
        setLocationId(location.id);
        setSuppliers(supplierList);
        setSupplierId((prev) => prev || supplierList[0]?.id || '');
        setItems(itemList.filter((i) => i.isActive));
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, toast]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, search]);

  const cartRef = useRef<HTMLDivElement>(null);

  const addLine = (item: InventoryItem) => {
    setLines((prev) => {
      if (prev[item.id]) return prev;
      // PO lines are ordered/priced in buy units (backend divides unitPrice
      // by conversionFactor at receiving time to get a usage-unit cost) —
      // currentCost is stored per usage unit, so it must be converted here,
      // not used as-is.
      return { ...prev, [item.id]: { item, qty: '1', unitPrice: buyUnitCostValue(item).toString() } };
    });
    toast({ variant: 'success', title: `${item.name} added`, message: 'Tap the cart button to review your order.' });
  };

  const scrollToCart = () => {
    cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeLine = (itemId: string) => {
    setLines((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const updateLineQty = (itemId: string, qty: string) => {
    setLines((prev) => (prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], qty } } : prev));
  };

  const lineList = useMemo(() => Object.values(lines), [lines]);

  const orderTotal = useMemo(
    () => lineList.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * parseFloat(l.unitPrice), 0),
    [lineList],
  );

  const handleSaveDraft = async () => {
    if (!accessToken || !locationId || !supplierId) return;
    if (lineList.length === 0) {
      toast({ variant: 'error', title: 'Add at least one item', message: 'A purchase order needs at least one line.' });
      return;
    }
    const invalidLine = lineList.find((l) => !l.qty || parseFloat(l.qty) <= 0);
    if (invalidLine) {
      toast({ variant: 'error', title: 'Check quantities', message: `${invalidLine.item.name} needs a quantity greater than 0.` });
      return;
    }

    setIsSaving(true);
    try {
      await createPurchaseOrder(
        {
          supplierId,
          locationId,
          lines: lineList.map((l) => ({
            inventoryItemId: l.item.id,
            orderedQty: l.qty,
            unitPrice: l.unitPrice,
          })),
        },
        accessToken,
      );
      toast({
        variant: 'success',
        title: 'Draft saved',
        message: isManager ? 'Open it from the list to send it to the supplier.' : 'Your manager will review and send this order.',
      });
      router.replace('/app/inventory/purchase-orders');
    } catch (error) {
      toast({ variant: 'error', title: 'Could not save draft', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-crema pb-40">
      {/* Espresso header band — scoped to Inventory mobile screens */}
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">New Purchase Order</p>
        <p className="text-label-md text-crema/70">{isManager ? 'Saved as a draft — send it from the list' : 'Draft — only a manager can send it'}</p>
      </div>

      <div className="px-4 py-4">
        {/* Supplier selector */}
        <div className="mb-4">
          <Select
            label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            placeholder={suppliers.length === 0 ? 'No suppliers available' : undefined}
          />
        </div>

        {/* Item search */}
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {/* Browse catalog */}
        <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">Browse Catalog</p>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : (
          <div className="mb-6 space-y-2">
            {filteredItems.map((item, index) => {
              const added = Boolean(lines[item.id]);
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="text-label-sm text-stone-500">{itemTypeLabel[item.type]} · {formatBuyUnitCost(item)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addLine(item)}
                    disabled={added}
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
                      added ? 'bg-stone-100 text-stone-400' : 'bg-espresso text-crema',
                    )}
                    aria-label={added ? `${item.name} already added` : `Add ${item.name}`}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Current order lines */}
        {lineList.length > 0 && (
          <div ref={cartRef} className="scroll-mt-4 rounded-lg border-2 border-amber/40 bg-amber-light/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wide text-espresso">
                <ShoppingCart size={14} /> Current Order ({lineList.length} item{lineList.length > 1 ? 's' : ''})
              </p>
              <button type="button" onClick={() => setLines({})} className="text-label-md text-stone-500 underline">
                Clear All
              </button>
            </div>
            <div className="space-y-3">
              {lineList.map(({ item, qty, unitPrice }) => (
                <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                      <p className="text-label-sm text-stone-500">{itemTypeLabel[item.type]} · Ksh {parseFloat(unitPrice).toFixed(2)} / {item.buyUnit}</p>
                    </div>
                    <button type="button" onClick={() => removeLine(item.id)} className="shrink-0 text-stone-400" aria-label={`Remove ${item.name}`}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <QuantityInput
                      value={qty}
                      onValueChange={(v) => updateLineQty(item.id, v)}
                      unit={item.buyUnit}
                      className="flex-1"
                    />
                    <span className="shrink-0 text-body-sm font-semibold text-stone-700">
                      Ksh {((parseFloat(qty) || 0) * parseFloat(unitPrice)).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating jump-to-cart pill — visible while browsing, once items are added */}
      {lineList.length > 0 && (
        <button
          type="button"
          onClick={scrollToCart}
          className="fixed bottom-28 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-espresso px-4 text-label-lg font-semibold text-crema shadow-lg"
        >
          <ShoppingCart size={18} />
          {lineList.length} item{lineList.length > 1 ? 's' : ''}
          <ChevronDown size={16} className="text-crema/70" />
        </button>
      )}

      {/* Bottom summary + save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-label-md text-stone-500">Order Total</span>
          <span className="text-heading-sm font-bold text-stone-900">
            Ksh {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleSaveDraft()}
          disabled={isSaving || lineList.length === 0 || !supplierId}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
        >
          <Save size={18} />
          {isSaving ? 'Saving…' : 'Save Draft'}
        </button>
        <p className="mt-1.5 text-center text-label-sm text-stone-400">
          {isManager ? 'Sending happens from the order detail screen.' : 'Only a manager can send purchase orders.'}
        </p>
      </div>
    </div>
  );
}
