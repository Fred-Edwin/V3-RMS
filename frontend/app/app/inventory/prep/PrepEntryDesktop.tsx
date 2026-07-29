'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Plus, X } from 'lucide-react';
import { Button, Card, FormField, PageHeader, PageLayout, Select, type SelectOption } from '@/components/ui';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  createPrepRecord,
  getCentralStoreLocation,
  getPrepRollingAverage,
  listInventoryItems,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type { InventoryItem, RollingAverage } from '@/types/inventory';

interface InputLine {
  key: string;
  itemId: string;
  quantity: string;
}

const newLine = (): InputLine => ({ key: crypto.randomUUID(), itemId: '', quantity: '' });

const formatKes = (value: number): string =>
  `Ksh ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// app/app/layout.tsx mounts {children} twice for STORE_MANAGER (dual desktop
// sidebar + CSS-hidden mobile shell) — no mobile variant of this screen
// exists yet (Session 8), so the mobile-shell copy renders nothing rather
// than duplicating data-fetching and DOM element ids.
export function PrepEntryDesktop(): JSX.Element | null {
  const isDesktop = useIsDesktopShell();
  if (!isDesktop) return null;
  return <PrepEntryDesktopInner />;
}

function PrepEntryDesktopInner(): JSX.Element {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [outputItemId, setOutputItemId] = useState('');
  const [inputLines, setInputLines] = useState<InputLine[]>([newLine()]);
  const [actualYield, setActualYield] = useState('');
  const [rollingAverage, setRollingAverage] = useState<RollingAverage | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      setIsLoading(true);
      try {
        const [location, itemList] = await Promise.all([
          getCentralStoreLocation(accessToken),
          listInventoryItems(accessToken, { isActive: true }),
        ]);
        if (!location) {
          toast({ variant: 'error', title: 'Central Store not set up', message: 'No Central Store location was found for this organization.' });
          return;
        }
        setLocationId(location.id);
        setItems(itemList);
      } catch (error) {
        toast({ variant: 'error', title: 'Failed to load catalog', message: error instanceof Error ? error.message : 'Please try again.' });
      } finally {
        setIsLoading(false);
      }
    })();
  }, [accessToken, toast]);

  const outputItem = useMemo(() => items.find((i) => i.id === outputItemId) ?? null, [items, outputItemId]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    if (!accessToken || !outputItemId) {
      setRollingAverage(null);
      return;
    }
    getPrepRollingAverage(outputItemId, accessToken).then(setRollingAverage).catch(() => setRollingAverage(null));
  }, [accessToken, outputItemId]);

  const preppedOptions: SelectOption[] = useMemo(
    () => items.filter((i) => i.type === 'PREPPED').map((i) => ({ value: i.id, label: i.name })),
    [items],
  );
  const inputOptions: SelectOption[] = useMemo(() => items.map((i) => ({ value: i.id, label: i.name })), [items]);

  const addInputLine = () => setInputLines((prev) => [...prev, newLine()]);
  const removeInputLine = (key: string) => setInputLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const updateLine = (key: string, patch: Partial<InputLine>) =>
    setInputLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const runningCost = useMemo(() => {
    let total = 0;
    for (const line of inputLines) {
      const item = itemsById.get(line.itemId);
      const qty = parseFloat(line.quantity);
      if (item && Number.isFinite(qty)) {
        total += qty * parseFloat(item.currentCost);
      }
    }
    return total;
  }, [inputLines, itemsById]);

  const yieldQty = parseFloat(actualYield);
  const unitCost = yieldQty > 0 ? runningCost / yieldQty : null;

  const handleConfirm = async () => {
    if (!accessToken || !locationId || !outputItemId) return;
    const validLines = inputLines.filter((l) => l.itemId && l.quantity && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one input', message: 'Log what was actually used to prepare this item.' });
      return;
    }
    if (!actualYield || parseFloat(actualYield) <= 0) {
      toast({ variant: 'error', title: 'Enter the actual yield', message: 'How much was actually produced?' });
      return;
    }

    setIsSaving(true);
    try {
      await createPrepRecord(
        {
          locationId,
          outputItemId,
          actualYield,
          inputs: validLines.map((l) => ({ inventoryItemId: l.itemId, quantity: l.quantity })),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Prep logged', message: `${outputItem?.name ?? 'Item'} recorded.` });
      router.push('/app/inventory/stock');
    } catch (error) {
      toast({ variant: 'error', title: 'Could not log prep', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader title="Prep Entry" subtitle="Log what was actually used and produced" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-6 p-6">
          <FormField label="Output Item" htmlFor="output-item" required helperText="What is being prepared">
            <Select id="output-item" options={preppedOptions} placeholder="Select the output item…" value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)} />
          </FormField>

          <div>
            <p className="mb-2 text-label-md font-medium text-stone-700">Input Lines</p>
            <div className="space-y-2">
              {inputLines.map((line) => {
                const item = itemsById.get(line.itemId);
                return (
                  <div key={line.key} className="flex items-end gap-2 rounded-md border border-stone-200 bg-white p-2.5">
                    <div className="flex-1">
                      <Select options={inputOptions} placeholder="Select input item…" value={line.itemId} onChange={(e) => updateLine(line.key, { itemId: e.target.value })} />
                    </div>
                    <QuantityInput
                      value={line.quantity}
                      onValueChange={(v) => updateLine(line.key, { quantity: v })}
                      unit={item?.usageUnit}
                      className="w-36"
                    />
                    {inputLines.length > 1 && (
                      <button type="button" onClick={() => removeInputLine(line.key)} className="shrink-0 p-2 text-stone-400 hover:text-stone-600" aria-label="Remove input">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addInputLine}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-stone-300 py-2.5 text-label-md font-medium text-stone-600 hover:border-espresso hover:text-espresso"
            >
              <Plus size={16} /> Add another input
            </button>
          </div>

          {rollingAverage && rollingAverage.sampleCount > 0 && (
            <div className="flex items-start gap-2 rounded-md bg-amber-light/40 p-3 text-label-md text-espresso">
              <Info size={16} className="mt-0.5 shrink-0 text-amber" />
              <div>
                <p className="font-medium">
                  Typical for this item: ~{parseFloat(rollingAverage.avgTotalInputQty ?? '0').toFixed(1)} {outputItem?.usageUnit} input → ~{parseFloat(rollingAverage.avgActualYield ?? '0').toFixed(1)} {outputItem?.usageUnit} output
                </p>
                <p className="text-label-sm text-stone-500">Based on rolling average of the last {rollingAverage.sampleCount} prep records</p>
              </div>
            </div>
          )}

          <FormField label="Actual Yield Produced" htmlFor="actual-yield" required>
            <QuantityInput id="actual-yield" value={actualYield} onValueChange={setActualYield} unit={outputItem?.usageUnit} />
          </FormField>

          <div className="flex justify-end border-t border-stone-100 pt-4">
            <Button onClick={handleConfirm} isLoading={isSaving} disabled={!outputItemId || isLoading}>
              Confirm Prep
            </Button>
          </div>
        </Card>

        {/* Running cost panel */}
        <Card className="h-fit space-y-4 p-5">
          <h3 className="text-label-lg font-semibold text-stone-900">Running Cost</h3>
          <div className="space-y-2 border-b border-stone-100 pb-3">
            {inputLines
              .filter((l) => l.itemId && l.quantity)
              .map((line) => {
                const item = itemsById.get(line.itemId);
                if (!item) return null;
                const lineCost = parseFloat(line.quantity) * parseFloat(item.currentCost);
                return (
                  <div key={line.key} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="min-w-0 truncate text-stone-600">{item.name} × {line.quantity}</span>
                    <span className="shrink-0 tabular-nums text-stone-800">{formatKes(lineCost)}</span>
                  </div>
                );
              })}
            {inputLines.every((l) => !l.itemId || !l.quantity) && (
              <p className="text-body-sm text-stone-400">Add input lines to see cost build up here.</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label-md font-medium text-stone-600">Total Input Cost</span>
            <span className="text-heading-sm font-semibold tabular-nums text-stone-900">{formatKes(runningCost)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-100 pt-3">
            <span className="text-label-md font-medium text-stone-600">Cost per Unit Yield</span>
            <span className="text-heading-sm font-semibold tabular-nums text-espresso">
              {unitCost !== null ? formatKes(unitCost) : '—'}
            </span>
          </div>
          {unitCost !== null && outputItem && (
            <p className="text-label-sm text-stone-400">
              vs. current catalog cost of {formatKes(parseFloat(outputItem.currentCost))} / {outputItem.usageUnit}
            </p>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
