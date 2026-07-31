'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Save, Search, Sparkles, X } from 'lucide-react';
import { BottomSheet, Select } from '@/components/ui';
import { itemTypeLabel } from '@/components/inventory/item-type-icon';
import { QuantityStepper } from '@/components/inventory/QuantityStepper';
import {
  createPurchaseOrder,
  getCentralStoreLocation,
  listInventoryItems,
  listSuppliers,
  suggestPurchaseOrder,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitCostValue, formatBuyUnitCost, roundToApiPrecision } from '@/lib/inventory-format';
import type { InventoryItem, Supplier } from '@/types/inventory';
import { NewPurchaseOrderDesktop } from './NewPurchaseOrderDesktop';

interface DraftLine {
  item: InventoryItem;
  qty: string;
  unitPrice: string;
}

// Manager+desktop gets its own split-view screen (NewPurchaseOrderDesktop —
// catalog + persistent right-sidebar cart); every other role/shell keeps
// this mobile flow. Same dispatch pattern as receiving/[id]/page.tsx and
// prep/page.tsx.
export default function NewPurchaseOrderPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const isDesktop = useIsDesktopShell();
  if (role === 'STORE_MANAGER' && isDesktop) {
    return <NewPurchaseOrderDesktop />;
  }
  return <NewPurchaseOrderMobile />;
}

// Shared mobile route for both roles (§8.1 row 5 / §8.2 row 2) — Manager can
// send what they draft here, Attendant's draft always waits on the Manager,
// so only the confirmation/helper copy below differs by role.
function NewPurchaseOrderMobile(): JSX.Element {
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
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Tapping "+" on an item already in the cart bumps its quantity by 1
  // instead of no-op'ing — fixes the "can only tap once" bug: the old guard
  // (`if (prev[item.id]) return prev`) silently ignored every tap after the
  // first, with no way to adjust quantity without scrolling to the cart.
  const addLine = (item: InventoryItem) => {
    setLines((prev) => {
      if (prev[item.id]) {
        return { ...prev, [item.id]: { ...prev[item.id], qty: String((parseFloat(prev[item.id].qty) || 0) + 1) } };
      }
      // PO lines are ordered/priced in buy units (backend divides unitPrice
      // by conversionFactor at receiving time to get a usage-unit cost) —
      // currentCost is stored per usage unit, so it must be converted here,
      // not used as-is.
      return { ...prev, [item.id]: { item, qty: '1', unitPrice: roundToApiPrecision(buyUnitCostValue(item)) } };
    });
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

  const updateLinePrice = (itemId: string, unitPrice: string) => {
    setLines((prev) => (prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], unitPrice } } : prev));
  };

  const lineList = useMemo(() => Object.values(lines), [lines]);

  const orderTotal = useMemo(
    () => lineList.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.unitPrice) || 0), 0),
    [lineList],
  );

  const handleSuggestOrder = async () => {
    if (!accessToken || !locationId) return;
    setIsSuggesting(true);
    try {
      const suggestions = await suggestPurchaseOrder(locationId, accessToken);
      if (suggestions.length === 0) {
        toast({ variant: 'success', title: 'Nothing to suggest', message: 'No items are currently at or below their reorder level.' });
        return;
      }
      setLines((prev) => {
        const next = { ...prev };
        for (const s of suggestions) {
          const item = itemsById.get(s.inventoryItemId);
          if (!item) continue;
          next[item.id] = {
            item,
            qty: s.suggestedQty,
            unitPrice: next[item.id]?.unitPrice ?? roundToApiPrecision(buyUnitCostValue(item)),
          };
        }
        return next;
      });
      toast({ variant: 'success', title: `Added ${suggestions.length} low-stock item${suggestions.length > 1 ? 's' : ''}`, message: 'Review quantities before saving.' });
      setIsCartOpen(true);
    } catch (error) {
      toast({ variant: 'error', title: 'Could not load suggestions', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSuggesting(false);
    }
  };

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
            orderedQty: roundToApiPrecision(l.qty),
            unitPrice: roundToApiPrecision(l.unitPrice || '0'),
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
    <div className={cn('min-h-full bg-crema', lineList.length > 0 ? 'pb-52' : 'pb-40')}>
      {/* Espresso header band — scoped to Inventory mobile screens */}
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <button
          type="button"
          onClick={() => router.push('/app/inventory/purchase-orders')}
          className="mb-2 flex items-center gap-1 text-label-md text-crema/80"
        >
          <ArrowLeft size={16} /> Purchases
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-lg font-medium">New Purchase Order</p>
            <p className="text-label-md text-crema/70">{isManager ? 'Saved as a draft — send it from the list' : 'Draft — only a manager can send it'}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSuggestOrder()}
            disabled={isSuggesting}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber px-3 py-1.5 text-label-md font-medium text-amber disabled:opacity-50"
          >
            <Sparkles size={14} />
            {isSuggesting ? 'Loading…' : 'Suggest'}
          </button>
        </div>
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
          <div className="space-y-2">
            {filteredItems.map((item, index) => {
              const cartQty = lines[item.id]?.qty;
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
                    className={cn(
                      'flex h-9 items-center justify-center gap-1 rounded-full px-3 transition-colors',
                      cartQty ? 'bg-amber-light text-espresso' : 'bg-espresso text-crema',
                    )}
                    aria-label={cartQty ? `${item.name}: ${cartQty} in order, tap to add one more` : `Add ${item.name}`}
                  >
                    <span className="text-label-sm font-bold tabular-nums">{cartQty ?? ''}</span>
                    <Package size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed bottom stack: cart summary (if non-empty) sits flush above
          the save bar in normal flow — no magic-number offset, so they can
          never collide the way the old floating jump-to-cart pill did.
          Tapping the cart summary opens the full cart detail sheet, so
          "what's in the order" is always one tap away without scrolling. */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        {lineList.length > 0 && (
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="flex w-full items-center justify-between gap-3 border-t border-amber/40 bg-amber-light px-4 py-2.5"
          >
            <span className="flex items-center gap-1.5 text-label-md font-semibold text-espresso">
              <Package size={15} /> {lineList.length} item{lineList.length > 1 ? 's' : ''} in order
            </span>
            <span className="text-label-md font-semibold text-espresso">
              Ksh {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · View
            </span>
          </button>
        )}
        <div className="border-t border-stone-200 bg-white px-4 py-3">
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

      {/* Cart detail sheet */}
      <BottomSheet isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} title="Current Order">
        {lineList.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-stone-500">No items added yet.</p>
        ) : (
          <div className="space-y-2.5">
            {lineList.map(({ item, qty, unitPrice }) => (
              <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3">
                {/* Primary row: item identity + line total carry the visual weight */}
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                    <p className="text-label-sm text-stone-500">{itemTypeLabel[item.type]}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-body-sm font-bold tabular-nums text-stone-900">
                      Ksh {((parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0)).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <button type="button" onClick={() => removeLine(item.id)} className="shrink-0 text-stone-400" aria-label={`Remove ${item.name}`}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
                {/* Secondary row: quantity + editable unit price, muted */}
                <div className="flex items-center justify-between gap-3">
                  <QuantityStepper value={qty} onValueChange={(v) => updateLineQty(item.id, v)} unit={item.buyUnit} />
                  <label className="flex shrink-0 items-center gap-1 text-label-sm text-stone-400">
                    @
                    <input
                      type="text"
                      inputMode="decimal"
                      value={unitPrice}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === '' || /^\d*\.?\d*$/.test(next)) updateLinePrice(item.id, next);
                      }}
                      className="w-16 rounded border border-stone-200 bg-stone-50 py-1 text-right text-label-md font-medium tabular-nums text-stone-600 focus:border-espresso focus:bg-white focus:outline-none"
                    />
                    /{item.buyUnit}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
