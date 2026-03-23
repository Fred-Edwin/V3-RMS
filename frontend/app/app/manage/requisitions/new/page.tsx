'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronUp, Minus, Plus, Search, ShoppingBasket, X } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FormField,
  PageHeader,
  PageLayout,
  SkeletonTable,
  Textarea,
} from '@/components/ui';
import { menuService } from '@/services/menuService';
import { inventoryService } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import type { MenuCategorySummary } from '@/types/menu';

interface ItemQty {
  [menuItemId: string]: number;
}

export default function NewRequisitionPage() {
  const token = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  const [categories, setCategories] = useState<MenuCategorySummary[]>([]);
  const [quantities, setQuantities] = useState<ItemQty>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await menuService.getCategories(token);
      setCategories(data.filter((c) => c.items.some((i) => i.isActive)));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLowerCase();

  // When searching, flatten all items across categories
  const searchResults = useMemo(() => {
    if (!query) return null;
    return categories.flatMap((c) =>
      c.items.filter((i) => i.isActive && i.name.toLowerCase().includes(query)),
    );
  }, [categories, query]);

  const toggleCollapse = (catId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const setQty = (menuItemId: string, value: number) => {
    setQuantities((prev) => {
      if (value <= 0) {
        const next = { ...prev };
        delete next[menuItemId];
        return next;
      }
      return { ...prev, [menuItemId]: value };
    });
  };

  const increment = (menuItemId: string) =>
    setQty(menuItemId, (quantities[menuItemId] ?? 0) + 1);

  const decrement = (menuItemId: string) =>
    setQty(menuItemId, (quantities[menuItemId] ?? 0) - 1);

  const selectedCount = Object.keys(quantities).length;
  const totalPortions = Object.values(quantities).reduce((sum, q) => sum + q, 0);

  const handleSubmit = async () => {
    if (!token) return;
    setError(null);
    if (selectedCount === 0) {
      setError('Select at least one item before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      await inventoryService.createRequisition(
        {
          notes: notes.trim() || undefined,
          items: Object.entries(quantities).map(([menuItemId, requestedQty]) => ({
            menuItemId,
            requestedQty,
          })),
        },
        token,
      );
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit requisition.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reusable item row
  const ItemRow = ({ id, name }: { id: string; name: string }) => {
    const qty = quantities[id] ?? 0;
    return (
      <div
        className={`flex items-center justify-between py-3 transition-all ${
          qty > 0 ? '-mx-4 bg-stone-50 px-4' : ''
        }`}
      >
        <div className="flex-1 min-w-0 pr-4">
          <p className={`truncate text-sm font-medium ${qty > 0 ? 'text-stone-900' : 'text-stone-700'}`}>
            {name}
          </p>
          {qty > 0 && (
            <p className="text-label-sm text-stone-400">
              {qty} portion{qty !== 1 ? 's' : ''} requested
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {qty > 0 ? (
            <>
              <button
                type="button"
                onClick={() => decrement(id)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-600 transition-colors hover:border-stone-400 hover:bg-stone-50"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold text-stone-900">{qty}</span>
              <button
                type="button"
                onClick={() => increment(id)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-800 bg-stone-800 text-white transition-colors hover:bg-stone-700"
              >
                <Plus size={14} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => increment(id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500 transition-colors hover:border-stone-800 hover:bg-stone-800 hover:text-white"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  if (submitted) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="font-display text-2xl text-stone-900">Requisition Submitted</h2>
            <p className="mt-1 text-body-sm text-stone-500">
              The Central Kitchen will review and dispatch your order.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => router.push('/app/manage/requisitions/new')}>
              New Requisition
            </Button>
            <Button onClick={() => router.push('/app/manage/requisitions')}>View All</Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="New Requisition"
        subtitle="Select items and quantities to request from the Central Kitchen"
      />

      {isLoading ? (
        <SkeletonTable rows={8} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket size={40} className="text-stone-400" />}
          heading="No menu items found"
          body="Ask your manager to add menu items before creating a requisition."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: search + item selector */}
          <div className="space-y-4 lg:col-span-2">

            {/* Search bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-9 text-sm text-stone-900 placeholder-stone-400 outline-none transition-colors focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search results */}
            {searchResults !== null ? (
              searchResults.length === 0 ? (
                <p className="py-8 text-center text-body-sm text-stone-400">
                  No items match &ldquo;{search}&rdquo;
                </p>
              ) : (
                <Card className="bg-parchment shadow-md">
                  <CardBody>
                    <div className="divide-y divide-stone-100">
                      {searchResults.map((item) => (
                        <ItemRow key={item.id} id={item.id} name={item.name} />
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )
            ) : (
              /* Category cards with collapse */
              categories.map((cat) => {
                const activeItems = cat.items.filter((i) => i.isActive);
                if (activeItems.length === 0) return null;
                const isCollapsed = collapsed.has(cat.id);
                const selectedInCat = activeItems.filter((i) => quantities[i.id] > 0).length;

                return (
                  <Card key={cat.id} className="bg-parchment shadow-md overflow-hidden">
                    {/* Clickable header */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(cat.id)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-stone-50"
                    >
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg text-stone-900">{cat.name}</h3>
                        {selectedInCat > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-800 px-1.5 text-label-sm font-medium text-white">
                            {selectedInCat}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-stone-400">
                        <span className="text-label-sm">{activeItems.length} items</span>
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </div>
                    </button>

                    {/* Collapsible body */}
                    {!isCollapsed && (
                      <CardBody>
                        <div className="divide-y divide-stone-100">
                          {activeItems.map((item) => (
                            <ItemRow key={item.id} id={item.id} name={item.name} />
                          ))}
                        </div>
                      </CardBody>
                    )}
                  </Card>
                );
              })
            )}
          </div>

          {/* Right: order summary + submit */}
          <div className="space-y-4">
            <Card className="sticky top-4 bg-parchment shadow-md">
              <CardHeader>
                <h3 className="font-display text-lg text-stone-900">Order Summary</h3>
              </CardHeader>
              <CardBody>
                {selectedCount === 0 ? (
                  <p className="text-body-sm text-stone-400">No items selected yet. Tap + to add.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(quantities).map(([menuItemId, qty]) => {
                      const name =
                        categories
                          .flatMap((c) => c.items)
                          .find((i) => i.id === menuItemId)?.name ?? menuItemId;
                      return (
                        <div key={menuItemId} className="flex items-center justify-between text-sm">
                          <span className="truncate pr-2 text-stone-700">{name}</span>
                          <span className="shrink-0 font-semibold text-stone-900">×{qty}</span>
                        </div>
                      );
                    })}
                    <div className="mt-3 border-t border-stone-200 pt-3 space-y-1">
                      <div className="flex justify-between text-label-sm font-medium text-stone-500">
                        <span>Distinct items</span>
                        <span>{selectedCount}</span>
                      </div>
                      <div className="flex justify-between text-label-sm font-medium text-stone-500">
                        <span>Total portions</span>
                        <span>{totalPortions}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <FormField label="Notes (optional)" htmlFor="req-notes">
                    <Textarea
                      id="req-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special instructions…"
                      rows={2}
                    />
                  </FormField>
                </div>

                {error && <p className="mt-3 text-body-sm text-red-600">{error}</p>}

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting || selectedCount === 0}
                    isLoading={isSubmitting}
                    className="w-full"
                  >
                    Submit Requisition
                  </Button>
                  <Button variant="ghost" onClick={() => router.back()} className="w-full">
                    Cancel
                  </Button>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
