'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ClipboardCheck, Pencil, Plus, Search } from 'lucide-react';
import { Card, EmptyState, Input } from '@/components/ui';
import { Badge } from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import { createStockCount, getCentralStoreLocation, listInventoryItems, listStockCounts, submitStockCount } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitLabel, formatBuyUnitQuantity, toUsageUnitQuantity } from '@/lib/inventory-format';
import type { DepartmentTag, InventoryItem, StockCount, StockCountStatus } from '@/types/inventory';
import { StockCountsDesktop } from './StockCountsDesktop';

const STATUS_LABEL: Record<StockCountStatus, string> = {
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

const DEPARTMENT_TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const departmentLabel: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

const SCOPE_OPTIONS: { value: 'ALL' | DepartmentTag; label: string }[] = [
  { value: 'ALL', label: 'Full catalog' },
  ...DEPARTMENT_TAGS.map((tag) => ({ value: tag, label: departmentLabel[tag] })),
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const defaultLabel = (): string =>
  `Count — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' })}, ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' })}`;

// Session creation is available to both roles at any time (revised
// 2026-07-30 — was Manager-only in the original spec). Manager's list is the
// same card layout, but tapping a SUBMITTED/APPROVED session routes into the
// approval view (§8.1 row 11 mobile) instead of the execution flow.
export default function StockCountsListPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  if (role === 'STORE_MANAGER') {
    return <StockCountsManagerDispatch />;
  }
  return <StockCountsList />;
}

// STORE_MANAGER's dual shell mounts both the desktop sidebar copy and the
// CSS-hidden mobile copy simultaneously — see lib/shell-context.tsx.
function StockCountsManagerDispatch(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <StockCountsDesktop />;
  return <StockCountsList />;
}

function StockCountsList(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [counts, setCounts] = useState<StockCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCounting, setIsCounting] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listStockCounts(accessToken);
      setCounts(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load stock counts', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isCounting) {
    return (
      <NewCountFlow
        onDone={() => {
          setIsCounting(false);
          void load();
        }}
        onCancel={() => setIsCounting(false)}
      />
    );
  }

  return (
    <div className="min-h-full bg-crema pb-24">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <p className="font-display text-heading-lg font-medium">Stock Counts</p>
        <p className="text-label-md text-crema/70">Central Store</p>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : counts.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck size={40} />}
            heading="No count sessions yet"
            body="Tap the + button to start counting — anyone can start, your manager approves once it's submitted."
          />
        ) : (
          <div className="space-y-3">
            {counts.map((count) => (
              <Link key={count.id} href={`/app/inventory/stock-counts/${count.id}`}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-stone-900">{count.label}</p>
                      <p className="text-label-md text-stone-500">{formatDate(count.scheduledDate)}</p>
                    </div>
                    <Badge tone={count.status === 'IN_PROGRESS' ? 'warning' : count.status === 'SUBMITTED' ? 'neutral' : 'success'}>
                      {STATUS_LABEL[count.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-label-md text-stone-500">{count.lines.length} items</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsCounting(true)}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-espresso text-crema shadow-lg"
        aria-label="Start a new count"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

type FlowStep = 'scope' | 'entry' | 'review';

// Merged create+count+review flow (revised 2026-07-30 — replaces a
// separate "create a session" form + navigate-to-find-it-in-the-list +
// open-to-start-counting chain). Picking a scope immediately includes every
// item in it as a countable row — no separate per-item checklist step.
// The StockCount session itself is still created via the same
// createStockCount call as before, just invisibly, the moment scope is
// confirmed, so there's no user-facing "session" concept to manage before
// counting can start.
function NewCountFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>('scope');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [label, setLabel] = useState(defaultLabel());
  const [isEditingLabel, setIsEditingLabel] = useState(false);

  const [count, setCount] = useState<StockCount | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showExpectedQty = role === 'STORE_MANAGER';
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setIsLoadingCatalog(true);
      try {
        const [location, itemList] = await Promise.all([
          getCentralStoreLocation(accessToken),
          listInventoryItems(accessToken, { isActive: true }),
        ]);
        if (cancelled) return;
        setLocationId(location?.id ?? null);
        setItems(itemList);
      } catch (error) {
        if (!cancelled) {
          toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
        }
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, toast]);

  const startCount = async (scope: 'ALL' | DepartmentTag) => {
    if (!accessToken || !locationId) return;
    const scopedItems = scope === 'ALL' ? items : items.filter((item) => item.departmentTags.includes(scope));
    if (scopedItems.length === 0) {
      toast({ variant: 'error', title: 'No items in scope', message: 'That department has no active items to count.' });
      return;
    }
    setIsStarting(true);
    try {
      const created = await createStockCount(
        {
          locationId,
          label: label.trim() || defaultLabel(),
          scheduledDate: new Date().toISOString(),
          inventoryItemIds: scopedItems.map((i) => i.id),
        },
        accessToken,
      );
      setCount(created);
      setStep('entry');
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to start count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsStarting(false);
    }
  };

  const sortedLines = useMemo(() => (count ? [...count.lines].sort((a, b) => a.sequence - b.sequence) : []), [count]);

  const filteredIndices = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    if (!term) return sortedLines.map((_, i) => i);
    return sortedLines.reduce<number[]>((acc, line, i) => {
      if (line.inventoryItem.name.toLowerCase().includes(term)) acc.push(i);
      return acc;
    }, []);
  }, [sortedLines, itemSearch]);

  const countedCount = useMemo(
    () => sortedLines.filter((l) => counted[l.id] !== undefined && counted[l.id] !== '').length,
    [sortedLines, counted],
  );

  const updateCounted = (lineId: string, value: string) => {
    setCounted((prev) => ({ ...prev, [lineId]: value }));
  };

  const goToNext = (fromIndex: number) => {
    const next = fromIndex + 1;
    if (next < sortedLines.length) {
      setActiveIndex(next);
      requestAnimationFrame(() => inputRefs.current[sortedLines[next].id]?.focus());
    }
  };

  const handleSubmit = async () => {
    if (!accessToken || !count) return;
    const lines = sortedLines
      .filter((l) => counted[l.id] !== undefined && counted[l.id] !== '')
      .map((l) => ({ lineId: l.id, countedQty: String(toUsageUnitQuantity(counted[l.id], l.inventoryItem)) }));
    if (lines.length === 0) {
      toast({ variant: 'error', title: 'Nothing counted', message: 'Enter at least one quantity before submitting.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await submitStockCount(count.id, { lines }, accessToken);
      toast({
        variant: 'success',
        title: 'Count submitted',
        message: showExpectedQty ? 'Review the variance and approve when ready.' : 'Your manager will review and approve it.',
      });
      onDone();
    } catch (error) {
      toast({ variant: 'error', title: 'Could not submit count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'scope') {
    return (
      <div className="min-h-full bg-crema pb-8">
        <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
          <button type="button" onClick={onCancel} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
            <ArrowLeft size={16} /> Stock Counts
          </button>
          <p className="font-display text-heading-md font-medium">What are you counting?</p>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2.5">
            {isEditingLabel ? (
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => setIsEditingLabel(false)}
                autoFocus
                className="h-8 text-body-sm"
              />
            ) : (
              <>
                <p className="truncate text-body-sm text-stone-600">{label}</p>
                <button type="button" onClick={() => setIsEditingLabel(true)} className="shrink-0 text-stone-400">
                  <Pencil size={14} />
                </button>
              </>
            )}
          </div>

          {isLoadingCatalog ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-md bg-stone-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {SCOPE_OPTIONS.map((option) => {
                const scopeValue = option.value;
                const itemCount = scopeValue === 'ALL' ? items.length : items.filter((i) => i.departmentTags.includes(scopeValue)).length;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isStarting}
                    onClick={() => void startCount(option.value)}
                    className="flex w-full items-center justify-between rounded-md border border-stone-200 bg-white px-4 py-3.5 text-left disabled:opacity-50"
                  >
                    <span className="text-body-md font-semibold text-stone-900">{option.label}</span>
                    <span className="text-label-sm text-stone-400">{itemCount} items</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'review') {
    const countedLines = sortedLines.filter((l) => counted[l.id] !== undefined && counted[l.id] !== '');
    const skippedLines = sortedLines.filter((l) => counted[l.id] === undefined || counted[l.id] === '');
    return (
      <div className="min-h-full bg-crema pb-28">
        <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
          <button type="button" onClick={() => setStep('entry')} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
            <ArrowLeft size={16} /> Back to counting
          </button>
          <p className="font-display text-heading-md font-medium">Review before submitting</p>
          <p className="text-label-md text-crema/70">{countedLines.length} counted{skippedLines.length > 0 ? ` · ${skippedLines.length} skipped` : ''}</p>
        </div>

        <div className="px-4 py-4">
          <div className="space-y-2">
            {countedLines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-3">
                <p className="min-w-0 truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-body-md font-semibold tabular-nums text-stone-900">
                    {counted[line.id]} {buyUnitLabel(line.inventoryItem)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = sortedLines.findIndex((l) => l.id === line.id);
                      setActiveIndex(idx);
                      setStep('entry');
                    }}
                    className="shrink-0 text-label-sm font-medium text-espresso"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>

          {skippedLines.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-400">Skipped</p>
              <div className="space-y-2">
                {skippedLines.map((line) => (
                  <button
                    key={line.id}
                    type="button"
                    onClick={() => {
                      const idx = sortedLines.findIndex((l) => l.id === line.id);
                      setActiveIndex(idx);
                      setStep('entry');
                    }}
                    className="flex w-full items-center justify-between rounded-md border border-dashed border-stone-300 bg-white p-3 text-left"
                  >
                    <p className="min-w-0 truncate text-body-sm text-stone-500">{line.inventoryItem.name}</p>
                    <span className="shrink-0 text-label-sm font-medium text-espresso">Count it</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || countedLines.length === 0}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Count'}
          </button>
        </div>
      </div>
    );
  }

  // step === 'entry'
  return (
    <div className="min-h-full bg-crema pb-28">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={onCancel} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Stock Counts
        </button>
        <p className="font-display text-heading-md font-medium">{label}</p>
        {count && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <p className="text-body-sm font-bold tabular-nums">
                <span className="text-heading-sm text-amber">{countedCount}</span> of {count.lines.length}
              </p>
              <p className="text-label-sm text-crema/60">Items counted</p>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-crema/15">
              <div className="h-full rounded-full bg-amber" style={{ width: `${(countedCount / Math.max(count.lines.length, 1)) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Jump to an item…" className="h-9 pl-8 text-body-sm" />
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="space-y-2">
          {filteredIndices.map((index) => {
            const line = sortedLines[index];
            const value = counted[line.id] ?? '';
            const isDone = value !== '';
            return (
              <div
                key={line.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-2.5',
                  index === activeIndex ? 'border-espresso ring-1 ring-espresso' : isDone ? 'border-success-border bg-success-bg' : 'border-stone-200 bg-white',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-label-sm font-bold',
                    isDone ? 'bg-success text-white' : 'bg-stone-100 text-stone-500',
                  )}
                >
                  {isDone ? <Check size={14} /> : line.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                  <p className="text-label-sm text-stone-500">
                    {showExpectedQty && line.expectedQty !== undefined
                      ? `Expected ${formatBuyUnitQuantity(line.expectedQty, line.inventoryItem)}`
                      : buyUnitLabel(line.inventoryItem)}
                  </p>
                </div>
                <QuantityInput
                  ref={(el) => {
                    inputRefs.current[line.id] = el;
                  }}
                  value={value}
                  onValueChange={(v) => updateCounted(line.id, v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      goToNext(index);
                    }
                  }}
                  unit={buyUnitLabel(line.inventoryItem)}
                  placeholder="Enter amount"
                  className="w-32"
                  onFocus={(e) => {
                    e.currentTarget.select();
                    setActiveIndex(index);
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setStep('review')}
          disabled={countedCount === 0}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
        >
          Review & Submit
        </button>
        {countedCount === 0 && <p className="mt-1 text-center text-label-sm text-stone-400">Count at least one item to continue</p>}
      </div>
    </div>
  );
}
