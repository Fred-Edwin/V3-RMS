'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Pause, Play } from 'lucide-react';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import { getStockCount, submitStockCount } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import type { StockCount } from '@/types/inventory';

// D-14 (verified on the wire, not assumed): an Attendant-role response for
// this endpoint never includes expectedQty/gapQty keys at all — confirmed by
// directly inspecting GET /stock-counts/:id, GET /stock-counts, and the
// submit response with an Attendant token. This component therefore never
// reads or renders those fields — there's nothing to hide, the data isn't here.
export default function StockCountExecutionPage(): JSX.Element {
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
            next[line.id] = line.countedQty;
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
      const lines = count.lines.map((l) => ({ lineId: l.id, countedQty: countedRef.current[l.id] || '0' }));
      await submitStockCount(count.id, { lines }, accessToken);
      toast({ variant: 'success', title: 'Count submitted', message: 'Your manager will review and approve it.' });
      router.push('/app/inventory/stock-counts');
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
                      <p className="text-label-sm text-stone-500">{line.inventoryItem.usageUnit}</p>
                    </div>
                    <QuantityInput
                      value={value}
                      onValueChange={(v) => updateCounted(line.id, v)}
                      unit={line.inventoryItem.usageUnit}
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
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white px-4 py-3">
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
