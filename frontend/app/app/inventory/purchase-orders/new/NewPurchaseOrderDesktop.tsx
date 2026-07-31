'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Save, Search, Sparkles, X } from 'lucide-react';
import { Button, Card, EmptyState, ExcelTable, IconButton, PageHeader, PageLayout, Select, type ExcelColumn } from '@/components/ui';
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
import { buyUnitCostValue, formatBuyUnitCost, roundToApiPrecision } from '@/lib/inventory-format';
import { cn } from '@/lib/cn';
import type { InventoryItem, Supplier } from '@/types/inventory';

interface DraftLine {
  item: InventoryItem;
  qty: string;
  unitPrice: string;
}

// Desktop-only split view: catalog browse (left, ExcelTable) + a persistent
// cart sidebar (right) that never requires scrolling to see what's in the
// order — the owner's explicit ask, and the direct fix for the mobile
// screen's "cart only visible by scrolling" complaint. Manager-only (see
// new/page.tsx's shell dispatch); Attendant never reaches this component.
export function NewPurchaseOrderDesktop(): JSX.Element {
  const router = useRouter();
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

  const addLine = (item: InventoryItem) => {
    setLines((prev) => {
      if (prev[item.id]) {
        return { ...prev, [item.id]: { ...prev[item.id], qty: String((parseFloat(prev[item.id].qty) || 0) + 1) } };
      }
      // PO lines are ordered/priced in buy units (backend divides unitPrice
      // by conversionFactor at receiving time to get a usage-unit cost) —
      // currentCost is stored per usage unit, so it must be converted here.
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

  const canSave = Boolean(supplierId) && lineList.some((l) => parseFloat(l.qty) > 0);

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
      toast({ variant: 'success', title: `Added ${suggestions.length} low-stock item${suggestions.length > 1 ? 's' : ''}`, message: 'Quantities are prefilled — review and adjust before saving.' });
    } catch (error) {
      toast({ variant: 'error', title: 'Could not load suggestions', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!accessToken || !locationId || !supplierId) return;
    const validLines = lineList.filter((l) => l.qty && parseFloat(l.qty) > 0);
    if (validLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one item', message: 'A purchase order needs at least one line.' });
      return;
    }

    setIsSaving(true);
    try {
      await createPurchaseOrder(
        {
          supplierId,
          locationId,
          lines: validLines.map((l) => ({
            inventoryItemId: l.item.id,
            orderedQty: roundToApiPrecision(l.qty),
            unitPrice: roundToApiPrecision(l.unitPrice || '0'),
          })),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Draft saved', message: 'Open it from the list to send it to the supplier.' });
      router.replace('/app/inventory/purchase-orders');
    } catch (error) {
      toast({ variant: 'error', title: 'Could not save draft', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns: ExcelColumn<InventoryItem>[] = [
    { key: 'name', label: 'Item', render: (item) => (
      <div>
        <p className="font-medium text-stone-900">{item.name}</p>
        <p className="text-label-sm text-stone-500">{itemTypeLabel[item.type]}</p>
      </div>
    ) },
    { key: 'cost', label: 'Buy Cost', align: 'right', render: (item) => <span className="tabular-nums text-stone-700">{formatBuyUnitCost(item)}</span> },
    { key: 'action', label: '', align: 'right', width: 56, render: (item) => {
      const inCart = Boolean(lines[item.id]);
      return (
        <IconButton
          icon={inCart ? <span className="text-label-sm font-bold tabular-nums">{lines[item.id].qty}</span> : <Package size={16} />}
          label={inCart ? `${item.name} in order — tap to add one more` : `Add ${item.name}`}
          variant={inCart ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => addLine(item)}
        />
      );
    } },
  ];

  return (
    <PageLayout className="animate-fade-up">
      <button
        type="button"
        onClick={() => router.push('/app/inventory/purchase-orders')}
        className="mb-3 flex items-center gap-1.5 text-label-md font-medium text-stone-500 hover:text-espresso"
      >
        <ArrowLeft size={16} /> Purchases
      </button>
      <PageHeader
        title="New Purchase Order"
        subtitle="Add items to build a draft, then save it — sending happens from the order list."
        action={
          <Button variant="secondary" leftIcon={<Sparkles size={16} />} isLoading={isSuggesting} onClick={() => void handleSuggestOrder()}>
            Suggest Order
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px]">
        {/* Left: catalog browse */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <Select
                label="Supplier"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                placeholder={suppliers.length === 0 ? 'No suppliers available' : undefined}
              />
            </div>
            <div className="relative w-full flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items by name…"
                className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            <ExcelTable
              columns={columns}
              rows={filteredItems}
              rowKey={(item) => item.id}
              numbered
              isLoading={isLoading}
              headerTone="navy"
              emptyState={
                <div className="px-4 py-10 text-center text-body-sm text-stone-500">
                  {items.length === 0 ? 'No items in the catalog yet.' : 'No items match your search.'}
                </div>
              }
            />
          </Card>
        </div>

        {/* Right: cart, always visible */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="flex max-h-[calc(100vh-140px)] flex-col overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3">
              <p className="text-label-lg font-semibold text-stone-900">
                Order Summary {lineList.length > 0 && <span className="font-normal text-stone-500">({lineList.length})</span>}
              </p>
            </div>

            <div className="flex-1 overflow-x-hidden overflow-y-auto">
              {lineList.length === 0 ? (
                <EmptyState
                  icon={<Package size={32} />}
                  heading="No items yet"
                  body="Add items from the catalog to build this order."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-stone-100">
                  {lineList.map(({ item, qty, unitPrice }) => (
                    <li key={item.id} className="group px-4 py-3.5">
                      {/* Primary row: item identity + line total carry the visual weight */}
                      <div className="mb-2.5 flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-body-sm font-bold tabular-nums text-stone-900">
                            Ksh {((parseFloat(qty) || 0) * (parseFloat(unitPrice) || 0)).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <IconButton
                            icon={<X size={13} />}
                            label={`Remove ${item.name}`}
                            variant="ghost"
                            size="sm"
                            className="size-6 opacity-0 group-hover:opacity-100"
                            onClick={() => removeLine(item.id)}
                          />
                        </div>
                      </div>
                      {/* Secondary row: quantity stepper, then editable unit price on its
                          own line beneath — stacked, not side-by-side, so long buy-unit
                          labels (e.g. "pouch (500g)") never force horizontal overflow in
                          the fixed-width sidebar. */}
                      <div className="flex flex-col gap-1.5">
                        <QuantityStepper value={qty} onValueChange={(v) => updateLineQty(item.id, v)} unit={item.buyUnit} />
                        <label className="flex items-center justify-end gap-1 text-label-sm text-stone-400">
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
                            className="w-16 shrink-0 rounded border border-transparent bg-transparent text-right text-label-sm font-medium tabular-nums text-stone-600 hover:border-stone-200 focus:border-espresso focus:bg-white focus:outline-none"
                          />
                          <span className="truncate">/{item.buyUnit}</span>
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-stone-100 px-4 py-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-label-md text-stone-500">Order Total</span>
                <span className="text-heading-sm font-bold tabular-nums text-stone-900">
                  Ksh {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <Button
                leftIcon={<Save size={16} />}
                className={cn('w-full')}
                disabled={!canSave || isSaving}
                isLoading={isSaving}
                onClick={() => void handleSaveDraft()}
              >
                Save Draft
              </Button>
              <p className="mt-1.5 text-center text-label-sm text-stone-400">Sending happens from the order detail screen.</p>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
