'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCircle2, Pause, Pencil, Play } from 'lucide-react';
import { Badge } from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import { approveStockCount, correctStockCountLines, getStockCount, submitStockCount } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import { cn } from '@/lib/cn';
import { buyUnitLabel, formatBuyUnitQuantity, toUsageUnitQuantity } from '@/lib/inventory-format';
import type { StockCount, StockCountStatus } from '@/types/inventory';

const STATUS_LABEL: Record<StockCountStatus, string> = {
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
};

// Mobile-only route: Manager's desktop detail view is a slide-over panel on
// the stock-counts list (StockCountsDesktop), never a Link to this [id]
// route, so there's no desktop content to show here. STORE_MANAGER's dual
// shell still mounts this page on both the desktop and mobile copies
// (app/app/layout.tsx), so without a shell check the desktop-shell copy
// would double-fetch/render the approval view for nothing — same bug class
// Session 8 fixed on prep/page.tsx and waste/page.tsx.
export default function StockCountDetailPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <></>;
  if (role === 'STORE_MANAGER') {
    return <StockCountManagerEntry />;
  }
  return <StockCountExecution showExpectedQty={false} />;
}

// Manager can create and physically count their own session too (revised
// 2026-07-30 — creation is no longer Manager-only, and neither is counting
// your own session). Route by the session's own status rather than always
// assuming "Manager only ever approves": IN_PROGRESS still needs a counting
// UI, exactly like Attendant's, just with expectedQty visible per D-14
// (Manager always sees it, Attendant never does, regardless of who created
// or is executing the session).
function StockCountManagerEntry(): JSX.Element {
  const params = useParams<{ id: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();
  const [status, setStatus] = useState<StockCountStatus | null>(null);

  useEffect(() => {
    if (!accessToken || !params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getStockCount(params.id, accessToken);
        if (!cancelled) setStatus(result.status);
      } catch (error) {
        if (!cancelled) {
          toast({ variant: 'error', title: 'Failed to load count session', message: error instanceof Error ? error.message : 'Please try again.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, params.id, toast]);

  if (status === null) {
    return (
      <div className="min-h-full bg-crema px-4 py-4">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'IN_PROGRESS') {
    return <StockCountExecution showExpectedQty />;
  }
  return <StockCountApproval />;
}

function StockCountApproval(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [count, setCount] = useState<StockCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setIsLoading(true);
    try {
      const result = await getStockCount(params.id, accessToken);
      setCount(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load count session', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, params.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEditLine = (lineId: string, currentValue: number | null, item: { conversionFactor: string; buyUnit: string; usageUnit: string }) => {
    setEditingLineId(lineId);
    if (currentValue === null) {
      setEditValue('');
      return;
    }
    const factor = parseFloat(item.conversionFactor);
    const buyQty = !Number.isFinite(factor) || factor <= 0 || item.buyUnit === item.usageUnit ? currentValue : currentValue / factor;
    setEditValue(buyQty.toFixed(2));
  };

  const cancelEditLine = () => {
    setEditingLineId(null);
    setEditValue('');
  };

  const saveEditLine = async (lineId: string) => {
    if (!accessToken || !count) return;
    if (editValue.trim() === '') {
      toast({ variant: 'error', title: 'Enter a quantity', message: 'The counted quantity cannot be blank.' });
      return;
    }
    const line = count.lines.find((l) => l.id === lineId);
    if (!line) return;
    const usageQty = toUsageUnitQuantity(editValue, line.inventoryItem);
    setIsSavingEdit(true);
    try {
      const updated = await correctStockCountLines(count.id, { lines: [{ lineId, countedQty: String(usageQty) }] }, accessToken);
      setCount(updated);
      setEditingLineId(null);
      setEditValue('');
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to update count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const varianceLines = useMemo(() => {
    if (!count) return [];
    return [...count.lines]
      .sort((a, b) => a.sequence - b.sequence)
      .map((line) => {
        const expected = parseFloat(line.expectedQty ?? '0');
        const counted = line.countedQty !== null ? parseFloat(line.countedQty) : null;
        const gap = counted !== null ? counted - expected : 0;
        return { line, expected, counted, gap };
      });
  }, [count]);

  const totalGap = varianceLines.reduce((sum, l) => sum + l.gap, 0);

  const handleApprove = async () => {
    if (!accessToken || !count) return;
    setIsApproving(true);
    try {
      const updated = await approveStockCount(count.id, accessToken);
      setCount(updated);
      toast({ variant: 'success', title: 'Count approved', message: `${updated.label} was approved and adjustments were posted.` });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to approve', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsApproving(false);
      setIsApproveOpen(false);
    }
  };

  return (
    <div className="min-h-full bg-crema pb-8">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={() => router.push('/app/inventory/stock-counts')} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Stock Counts
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-md font-medium">{count?.label ?? 'Loading…'}</p>
            {count && <p className="text-label-md text-crema/70">{count.lines.length} items</p>}
          </div>
          {count && <Badge tone={count.status === 'IN_PROGRESS' ? 'warning' : count.status === 'SUBMITTED' ? 'neutral' : 'success'}>{STATUS_LABEL[count.status]}</Badge>}
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading || !count ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : count.status === 'IN_PROGRESS' ? (
          <p className="py-10 text-center text-body-sm text-stone-500">This session hasn&apos;t been submitted yet — waiting on the count to be completed.</p>
        ) : (
          <>
            <div className="mb-3 rounded-md border border-stone-200 bg-white p-3">
              <p className="text-label-sm text-stone-500">Net variance value</p>
              <p className={cn('text-heading-md font-bold tabular-nums', totalGap < 0 ? 'text-danger' : totalGap > 0 ? 'text-success' : 'text-stone-900')}>
                {totalGap > 0 ? '+' : ''}{totalGap.toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              {varianceLines.map(({ line, expected, counted, gap }) => {
                const isEditing = editingLineId === line.id;
                return (
                  <div key={line.id} className="rounded-md border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-body-sm font-semibold text-stone-900">{line.inventoryItem.name}</p>
                      {!isEditing && counted !== null && (
                        <span className={cn('shrink-0 text-label-lg font-semibold tabular-nums', gap === 0 ? 'text-stone-500' : gap < 0 ? 'text-danger' : 'text-success')}>
                          {gap > 0 ? '+' : ''}{gap.toFixed(2)} {line.inventoryItem.usageUnit}
                        </span>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-2 flex items-center gap-2">
                        <QuantityInput value={editValue} onValueChange={setEditValue} unit={buyUnitLabel(line.inventoryItem)} autoFocus className="flex-1" />
                        <button type="button" onClick={() => void saveEditLine(line.id)} disabled={isSavingEdit} className="shrink-0 text-label-sm font-semibold text-espresso disabled:opacity-50">
                          Save
                        </button>
                        <button type="button" onClick={cancelEditLine} disabled={isSavingEdit} className="shrink-0 text-label-sm text-stone-400">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-label-sm text-stone-500">
                          <span>Expected: {formatBuyUnitQuantity(expected, line.inventoryItem)}</span>
                          <span>Counted: {counted !== null ? formatBuyUnitQuantity(counted, line.inventoryItem) : '—'}</span>
                        </div>
                        {count?.status === 'SUBMITTED' && (
                          <button type="button" onClick={() => startEditLine(line.id, counted, line.inventoryItem)} className="shrink-0 text-stone-400">
                            <Pencil size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {count?.status === 'SUBMITTED' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setIsApproveOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso"
          >
            <CheckCircle2 size={18} /> Approve & Post Adjustments
          </button>
        </div>
      )}

      {isApproveOpen && count && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => !isApproving && setIsApproveOpen(false)}>
          <div className="rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-heading-sm font-semibold text-stone-900">Approve this count?</p>
            <p className="mt-1.5 text-body-sm text-stone-600">
              Approving posts adjustment transactions to the ledger for every line&apos;s gap. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setIsApproveOpen(false)} disabled={isApproving} className="h-12 flex-1 rounded-md border border-stone-200 text-label-lg font-semibold text-stone-700 disabled:opacity-50">
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={isApproving}
                className="h-12 flex-1 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
              >
                {isApproving ? 'Approving…' : 'Approve & Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// D-14 (verified on the wire, not assumed): an Attendant-role response for
// this endpoint never includes expectedQty/gapQty keys at all — confirmed by
// directly inspecting GET /stock-counts/:id, GET /stock-counts, and the
// submit response with an Attendant token. When showExpectedQty is false the
// data isn't even present to render; when true (Manager), the field is read
// straight off the line, never a separate fetch.
function StockCountExecution({ showExpectedQty }: { showExpectedQty: boolean }): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [count, setCount] = useState<StockCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [counted, setCounted] = useState<Record<string, string>>({});

  const countedRef = useRef(counted);
  useEffect(() => { countedRef.current = counted; }, [counted]);

  const load = useCallback(async () => {
    if (!accessToken || !params.id) return;
    setIsLoading(true);
    try {
      const result = await getStockCount(params.id, accessToken);
      setCount(result);
      setCounted((prev) => {
        const next = { ...prev };
        for (const line of result.lines) {
          if (line.countedQty !== null && next[line.id] === undefined) {
            const factor = parseFloat(line.inventoryItem.conversionFactor);
            const usageQty = parseFloat(line.countedQty);
            const buyQty =
              !Number.isFinite(factor) || factor <= 0 || line.inventoryItem.buyUnit === line.inventoryItem.usageUnit
                ? usageQty
                : usageQty / factor;
            next[line.id] = buyQty.toFixed(2);
          }
        }
        return next;
      });
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load count session', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, params.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedLines = useMemo(
    () => count ? [...count.lines].sort((a, b) => a.sequence - b.sequence) : [],
    [count],
  );

  const countedCount = useMemo(
    () => sortedLines.filter((l) => counted[l.id] !== undefined && counted[l.id] !== '').length,
    [sortedLines, counted],
  );
  const allCounted = count ? countedCount === count.lines.length : false;

  const updateCounted = (lineId: string, value: string) => {
    setCounted((prev) => ({ ...prev, [lineId]: value }));
  };

  const handleSubmit = async () => {
    if (!accessToken || !count || !allCounted) return;
    setIsSubmitting(true);
    try {
      const lines = count.lines.map((l) => ({
        lineId: l.id,
        countedQty: String(toUsageUnitQuantity(countedRef.current[l.id] || '0', l.inventoryItem)),
      }));
      await submitStockCount(count.id, { lines }, accessToken);
      toast({
        variant: 'success',
        title: 'Count submitted',
        message: showExpectedQty ? 'Review the variance and approve when ready.' : 'Your manager will review and approve it.',
      });
      router.push(showExpectedQty ? `/app/inventory/stock-counts/${count.id}` : '/app/inventory/stock-counts');
    } catch (error) {
      toast({ variant: 'error', title: 'Could not submit count', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-crema pb-24">
      <div className="bg-espresso px-4 pb-4 pt-6 text-crema">
        <button type="button" onClick={() => router.push('/app/inventory/stock-counts')} className="mb-2 flex items-center gap-1 text-label-md text-crema/80">
          <ArrowLeft size={16} /> Stock Count Session
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-md font-medium">{count?.label ?? 'Loading…'}</p>
            <p className="text-label-md text-amber">Central Store</p>
          </div>
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber px-3 py-1.5 text-label-md font-medium text-amber"
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
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

      {isPaused ? (
        <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
          <p className="text-body-md font-semibold text-stone-700">Count paused</p>
          <p className="max-w-xs text-body-sm text-stone-500">Your progress is saved. Tap Resume to keep counting.</p>
        </div>
      ) : (
        <div className="px-4 py-4">
          {isLoading || !count ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-stone-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedLines.map((line) => {
                const value = counted[line.id] ?? '';
                const isDone = value !== '';
                return (
                  <div
                    key={line.id}
                    className={cn(
                      'flex items-center gap-3 rounded-md border p-2.5',
                      isDone ? 'border-success-border bg-success-bg' : 'border-stone-200 bg-white',
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
                      value={value}
                      onValueChange={(v) => updateCounted(line.id, v)}
                      unit={buyUnitLabel(line.inventoryItem)}
                      placeholder="Enter amount"
                      className="w-32"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {count && !isPaused && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-label-md text-stone-500">
            <span>{count.lines.length - countedCount} remaining</span>
            <span>Enter the quantity you physically counted.</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!allCounted || isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Count'}
          </button>
          {!allCounted && <p className="mt-1 text-center text-label-sm text-stone-400">Complete all items to submit</p>}
        </div>
      )}
    </div>
  );
}
