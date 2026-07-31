'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Plus, X } from 'lucide-react';
import { Button, Card, FormField, HelpTip, PageHeader, PageLayout } from '@/components/ui';
import { ItemCombobox } from '@/components/inventory/ItemCombobox';
import { QuantityInput } from '@/components/inventory/QuantityInput';
import {
  createPrepRecord,
  getCentralStoreLocation,
  getPrepRecipeByOutputItem,
  getPrepRollingAverage,
  listInventoryItems,
} from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type { InventoryItem, PrepRecipe, RollingAverage } from '@/types/inventory';
import { PrepTabs, type PrepTab } from './PrepTabs';
import { PrepRecipesTab } from './PrepRecipesTab';
import { PrepHistoryTab } from './PrepHistoryTab';

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
  const [tab, setTab] = useState<PrepTab>('log');

  return (
    <PageLayout className="animate-fade-up">
      <PageHeader
        title="Prep Entry"
        subtitle="Log what was actually used and produced"
        action={
          <HelpTip title="Prep Entry">
            {tab === 'log' ? (
              <>
                <p>
                  Whenever raw ingredients are turned into a prepped item — say, raw chicken marinated into
                  Marinated Chicken — log it here: what went in, what came out.
                </p>
                <p className="mt-2">
                  This keeps stock accurate on both sides: the raw ingredients get used up, and the prepped item
                  gets added. Attendants log this daily from the mobile app; use this desktop form to review or
                  backfill an entry.
                </p>
              </>
            ) : tab === 'recipes' ? (
              <>
                <p>
                  Save a logged prep as a reusable recipe — e.g. Marinated Chicken always uses 5kg raw chicken +
                  the usual spices for a 4.5kg yield — so next time it pre-fills instead of starting blank.
                </p>
                <p className="mt-2">Recipes are optional and Manager-only to create or edit — Attendants can view one as a reference but not change it.</p>
              </>
            ) : (
              <>
                <p>Every Prep Record that&rsquo;s been logged, most recent first — what was used, what was produced, and by whom.</p>
                <p className="mt-2">Use it to spot-check a specific batch of Marinated Chicken, or see how yield has trended over time.</p>
              </>
            )}
          </HelpTip>
        }
      />
      <PrepTabs active={tab} onChange={setTab} className="mb-5" />
      {tab === 'log' ? <LogPrepPanel /> : tab === 'recipes' ? <PrepRecipesTab /> : <PrepHistoryTab />}
    </PageLayout>
  );
}

function LogPrepPanel(): JSX.Element {
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
  const [recipe, setRecipe] = useState<PrepRecipe | null>(null);

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

  // Recipe pre-fill (D-12 reopened) — selecting an output item that has a
  // saved recipe populates input lines + expected yield automatically, so
  // the attendant/manager adjusts actuals instead of rebuilding the list
  // from memory every run. Still fully editable/removable — never blocking.
  useEffect(() => {
    if (!accessToken || !outputItemId) {
      setRecipe(null);
      return;
    }
    let cancelled = false;
    getPrepRecipeByOutputItem(outputItemId, accessToken)
      .then((r) => {
        if (cancelled) return;
        setRecipe(r);
        if (r) {
          setInputLines(r.lines.map((line) => ({ key: crypto.randomUUID(), itemId: line.inputItemId, quantity: line.quantity })));
          setActualYield(r.expectedYield);
        } else {
          setInputLines([newLine()]);
          setActualYield('');
        }
      })
      .catch(() => setRecipe(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, outputItemId]);

  const preppedItems = useMemo(() => items.filter((i) => i.type === 'PREPPED'), [items]);

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

  // Batch scaling (D-12 "Left open" #2): expected yield scales with the
  // actual ingredient quantities entered, using the average of each line's
  // actual÷recipe ratio — chosen over a "primary ingredient" reference so it
  // needs no new recipe-authoring field and degrades gracefully when lines
  // don't scale in perfect lockstep.
  const scaledExpectedYield = useMemo(() => {
    if (!recipe) return null;
    const ratios: number[] = [];
    for (const recipeLine of recipe.lines) {
      const recipeQty = parseFloat(recipeLine.quantity);
      if (!Number.isFinite(recipeQty) || recipeQty <= 0) continue;
      const actualLine = inputLines.find((l) => l.itemId === recipeLine.inputItemId);
      const actualQty = actualLine ? parseFloat(actualLine.quantity) : NaN;
      if (!Number.isFinite(actualQty) || actualQty <= 0) continue;
      ratios.push(actualQty / recipeQty);
    }
    if (ratios.length === 0) return null;
    const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    return avgRatio * parseFloat(recipe.expectedYield);
  }, [recipe, inputLines]);

  const handleConfirm = async () => {
    if (!accessToken || !locationId || !outputItemId) return;
    const validLines = inputLines.filter((l) => l.itemId && l.quantity && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one ingredient', message: 'Log what was actually used to prepare this item.' });
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
          scaledExpectedYield: scaledExpectedYield !== null ? String(scaledExpectedYield) : undefined,
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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <Card className="space-y-6 p-6">
        <FormField label="Output Item" htmlFor="output-item" required helperText="What is being prepared">
          <ItemCombobox
            id="output-item"
            items={preppedItems}
            value={outputItemId}
            onChange={setOutputItemId}
            placeholder="Select the output item…"
          />
        </FormField>

        {recipe && (
          <div className="space-y-1 rounded-md bg-amber-light/40 p-3 text-label-md text-espresso">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-amber" />
              <p className="font-medium">
                Recipe batch: {recipe.lines.map((l) => `${l.quantity} ${l.inputItem.usageUnit} ${l.inputItem.name}`).join(' + ')} → expected {recipe.expectedYield} {recipe.outputItem.usageUnit} {recipe.outputItem.name}
                {scaledExpectedYield !== null && ` (scaled to ${scaledExpectedYield.toFixed(2)} ${recipe.outputItem.usageUnit} for this batch size)`}
              </p>
            </div>
            <p className="pl-6 text-label-sm text-stone-500">Pre-filled below — adjust to what was actually used and produced this run.</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-label-md font-medium text-stone-700">Ingredients</p>
          <div className="space-y-2">
            {inputLines.map((line) => {
              const item = itemsById.get(line.itemId);
              return (
                <div key={line.key} className="flex items-end gap-2 rounded-md border border-stone-200 bg-white p-2.5">
                  <div className="flex-1">
                    <ItemCombobox
                      items={items}
                      value={line.itemId}
                      onChange={(itemId) => updateLine(line.key, { itemId })}
                      placeholder="Select ingredient…"
                    />
                  </div>
                  <QuantityInput
                    value={line.quantity}
                    onValueChange={(v) => updateLine(line.key, { quantity: v })}
                    unit={item?.usageUnit}
                    className="w-40"
                  />
                  {inputLines.length > 1 && (
                    <button type="button" onClick={() => removeInputLine(line.key)} className="shrink-0 p-2 text-stone-400 hover:text-stone-600" aria-label="Remove ingredient">
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
            <Plus size={16} /> Add another ingredient
          </button>
        </div>

        {!recipe && rollingAverage && rollingAverage.sampleCount > 0 && (
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

        <FormField
          label="Actual Yield Produced"
          htmlFor="actual-yield"
          required
          helperText={
            recipe
              ? scaledExpectedYield !== null
                ? `Recipe expects ${scaledExpectedYield.toFixed(2)} ${recipe.outputItem.usageUnit} for this batch size`
                : `Recipe expects ${recipe.expectedYield} ${recipe.outputItem.usageUnit}`
              : undefined
          }
        >
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
            <p className="text-body-sm text-stone-400">Add ingredients to see cost build up here.</p>
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
  );
}
