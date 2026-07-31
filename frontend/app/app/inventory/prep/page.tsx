'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Info, Plus, X } from 'lucide-react';
import { HelpTip } from '@/components/ui';
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
import { PrepEntryDesktop } from './PrepEntryDesktop';
import { PrepTabs, type PrepTab } from './PrepTabs';
import { PrepRecipesTab } from './PrepRecipesTab';
import { PrepHistoryTab } from './PrepHistoryTab';

interface InputLine {
  key: string;
  item: InventoryItem | null;
  quantity: string;
}

const newLine = (): InputLine => ({ key: crypto.randomUUID(), item: null, quantity: '' });

// §8.1 row 8: Manager mobile reuses Attendant's step-flow screen as-is (no
// running-cost panel on mobile, soft-reference hint only) — only Manager's
// desktop copy needs its own component. Bug found in Session 8 verification:
// this dispatcher previously routed STORE_MANAGER unconditionally to
// PrepEntryDesktop, which self-guards to null on the mobile shell — leaving
// Manager's mobile Prep screen completely blank. Fixed by checking shell
// context for Manager instead of assuming desktop.
export default function PrepEntryPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  const isDesktop = useIsDesktopShell();
  if (role === 'STORE_MANAGER' && isDesktop) {
    return <PrepEntryDesktop />;
  }
  return <PrepEntryAttendant />;
}

function PrepEntryAttendant(): JSX.Element {
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const [tab, setTab] = useState<PrepTab>('log');
  const isManager = role === 'STORE_MANAGER';
  const dashboardHref = isManager ? '/app/inventory/dashboard' : '/app/inventory/attendant-dashboard';

  return (
    <div className="min-h-full bg-crema pb-24">
      <div className="bg-espresso px-4 pb-5 pt-6 text-crema">
        <button
          type="button"
          onClick={() => router.push(dashboardHref)}
          className="mb-2 flex items-center gap-1 text-label-md text-crema/80"
        >
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-heading-lg font-medium">Prep Record</p>
            <p className="text-label-md text-amber">Log what you actually used and produced</p>
          </div>
          <HelpTip
            title="Prep Record"
            triggerClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
          >
            <p>
              When you prepare something — like marinating raw chicken into Marinated Chicken — log it here: what
              you started with, what you ended up with.
            </p>
            <p className="mt-2">
              This keeps stock accurate for both the raw ingredients you used and the prepped item you made. The
              &ldquo;Typical&rdquo; hint is just a reference from past batches — enter what actually happened.
            </p>
          </HelpTip>
        </div>
      </div>

      {isManager && (
        <div className="bg-white px-4">
          <PrepTabs active={tab} onChange={setTab} />
        </div>
      )}

      {isManager && tab === 'recipes' ? (
        <div className="px-4 py-4">
          <PrepRecipesTab />
        </div>
      ) : isManager && tab === 'history' ? (
        <div className="px-4 py-4">
          <PrepHistoryTab />
        </div>
      ) : (
        <LogPrepMobile />
      )}
    </div>
  );
}

function LogPrepMobile(): JSX.Element {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [outputItem, setOutputItem] = useState<InventoryItem | null>(null);
  const [showOutputPicker, setShowOutputPicker] = useState(false);
  const [inputLines, setInputLines] = useState<InputLine[]>([newLine()]);
  const [pickerForLineKey, setPickerForLineKey] = useState<string | null>(null);
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

  useEffect(() => {
    if (!accessToken || !outputItem) {
      setRollingAverage(null);
      return;
    }
    getPrepRollingAverage(outputItem.id, accessToken)
      .then(setRollingAverage)
      .catch(() => setRollingAverage(null));
  }, [accessToken, outputItem]);

  // Recipe pre-fill (D-12 reopened) — mirrors the desktop behavior: picking
  // an output item with a saved recipe populates input lines + expected
  // yield, editable/removable from there. No recipe means the blank-slate
  // flow exactly as before.
  useEffect(() => {
    if (!accessToken || !outputItem) {
      setRecipe(null);
      return;
    }
    let cancelled = false;
    const itemsById = new Map(items.map((i) => [i.id, i]));
    getPrepRecipeByOutputItem(outputItem.id, accessToken)
      .then((r) => {
        if (cancelled) return;
        setRecipe(r);
        if (r) {
          setInputLines(
            r.lines.map((line) => ({
              key: crypto.randomUUID(),
              item: itemsById.get(line.inputItemId) ?? null,
              quantity: line.quantity,
            })),
          );
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
  }, [accessToken, outputItem]);

  const preppedItems = useMemo(() => items.filter((i) => i.type === 'PREPPED'), [items]);
  const usedInputIds = useMemo(() => new Set(inputLines.map((l) => l.item?.id).filter(Boolean)), [inputLines]);

  // Batch scaling (D-12 "Left open" #2) — mirrors desktop: average of each
  // ingredient line's actual÷recipe ratio, scaling the recipe's expected
  // yield to this run's batch size.
  const scaledExpectedYield = useMemo(() => {
    if (!recipe) return null;
    const ratios: number[] = [];
    for (const recipeLine of recipe.lines) {
      const recipeQty = parseFloat(recipeLine.quantity);
      if (!Number.isFinite(recipeQty) || recipeQty <= 0) continue;
      const actualLine = inputLines.find((l) => l.item?.id === recipeLine.inputItemId);
      const actualQty = actualLine ? parseFloat(actualLine.quantity) : NaN;
      if (!Number.isFinite(actualQty) || actualQty <= 0) continue;
      ratios.push(actualQty / recipeQty);
    }
    if (ratios.length === 0) return null;
    const avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    return avgRatio * parseFloat(recipe.expectedYield);
  }, [recipe, inputLines]);

  const addInputLine = () => setInputLines((prev) => [...prev, newLine()]);
  const removeInputLine = (key: string) => setInputLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const updateInputQty = (key: string, quantity: string) =>
    setInputLines((prev) => prev.map((l) => (l.key === key ? { ...l, quantity } : l)));
  const pickInputItem = (key: string, item: InventoryItem) => {
    setInputLines((prev) => prev.map((l) => (l.key === key ? { ...l, item, quantity: l.quantity } : l)));
    setPickerForLineKey(null);
  };

  const handleConfirm = async () => {
    if (!accessToken || !locationId || !outputItem) return;
    const validLines = inputLines.filter((l) => l.item && l.quantity && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) {
      toast({ variant: 'error', title: 'Add at least one ingredient', message: 'Log what you actually used to prepare this item.' });
      return;
    }
    if (!actualYield || parseFloat(actualYield) <= 0) {
      toast({ variant: 'error', title: 'Enter the actual yield', message: 'How much did you actually produce?' });
      return;
    }

    setIsSaving(true);
    try {
      await createPrepRecord(
        {
          locationId,
          outputItemId: outputItem.id,
          actualYield,
          scaledExpectedYield: scaledExpectedYield !== null ? String(scaledExpectedYield) : undefined,
          inputs: validLines.map((l) => ({ inventoryItemId: l.item!.id, quantity: l.quantity })),
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Prep logged', message: `${outputItem.name} recorded.` });
      router.push('/app/inventory/stock');
    } catch (error) {
      toast({ variant: 'error', title: 'Could not log prep', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="px-4 py-4">
        {/* Step 1 */}
        <StepHeader n={1} label="What are you preparing?" />
        <button
          type="button"
          onClick={() => setShowOutputPicker(true)}
          className="mb-6 flex w-full items-center gap-3 rounded-md border border-stone-200 bg-white p-3 text-left"
        >
          {outputItem ? (
            <div className="min-w-0 flex-1">
              <p className="text-label-sm uppercase tracking-wide text-stone-500">Prepped Item</p>
              <p className="truncate text-body-md font-semibold text-stone-900">{outputItem.name}</p>
            </div>
          ) : (
            <p className="flex-1 text-body-md text-stone-400">Select the item you&apos;re preparing…</p>
          )}
          <span className="text-stone-400">›</span>
        </button>

        {/* Step 2 */}
        <StepHeader n={2} label="What did you use? (Ingredients)" />
        {recipe && (
          <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-light/50 p-3 text-label-md text-espresso">
            <Info size={16} className="mt-0.5 shrink-0 text-amber" />
            <p>
              Pre-filled from the <span className="font-medium">{recipe.name}</span> recipe (expects{' '}
              {scaledExpectedYield !== null ? `${scaledExpectedYield.toFixed(2)} ${recipe.outputItem.usageUnit} for this batch size` : `${recipe.expectedYield} ${recipe.outputItem.usageUnit}`}
              ) — adjust to what you actually used.
            </p>
          </div>
        )}
        <div className="mb-3 space-y-2">
          {inputLines.map((line, index) => (
            <div key={line.key} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white p-2.5">
              <button
                type="button"
                onClick={() => setPickerForLineKey(line.key)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  {line.item ? (
                    <>
                      <p className="truncate text-body-sm font-semibold text-stone-900">{line.item.name}</p>
                      <p className="text-label-sm text-stone-500">{line.item.usageUnit}</p>
                    </>
                  ) : (
                    <p className="text-body-sm text-stone-400">Select ingredient…</p>
                  )}
                </div>
              </button>
              <QuantityInput
                value={line.quantity}
                onValueChange={(v) => updateInputQty(line.key, v)}
                unit={line.item?.usageUnit}
                className="w-36"
              />
              {inputLines.length > 1 && (
                <button type="button" onClick={() => removeInputLine(line.key)} className="shrink-0 text-stone-400" aria-label="Remove ingredient">
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addInputLine}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-amber py-3 text-label-lg font-medium text-amber"
        >
          <Plus size={18} /> Add another ingredient
        </button>

        {/* Step 3 */}
        <StepHeader n={3} label="What did you produce?" />
        {!recipe && rollingAverage && rollingAverage.sampleCount > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-md bg-amber-light/50 p-3 text-label-md text-espresso">
            <Info size={16} className="mt-0.5 shrink-0 text-amber" />
            <div>
              <p className="font-medium">
                Typical for this item: ~{parseFloat(rollingAverage.avgTotalInputQty ?? '0').toFixed(1)} {outputItem?.usageUnit} input → ~{parseFloat(rollingAverage.avgActualYield ?? '0').toFixed(1)} {outputItem?.usageUnit} output
              </p>
              <p className="text-label-sm text-stone-500">Based on rolling average of last {rollingAverage.sampleCount} prep records</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-md border border-stone-200 bg-white p-3">
          <div className="min-w-0 flex-1">
            <p className="text-label-sm uppercase tracking-wide text-stone-500">Actual Yield Produced</p>
            <p className="truncate text-body-sm font-semibold text-stone-900">{outputItem?.name ?? 'Select an output item first'}</p>
          </div>
          <QuantityInput value={actualYield} onValueChange={setActualYield} unit={outputItem?.usageUnit} className="w-36" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isSaving || !outputItem}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-amber text-label-lg font-semibold text-espresso disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Confirm Prep'}
        </button>
      </div>

      {/* Output item picker sheet */}
      {showOutputPicker && (
        <ItemPickerSheet
          title="What are you preparing?"
          items={preppedItems}
          isLoading={isLoading}
          onPick={(item) => { setOutputItem(item); setShowOutputPicker(false); }}
          onClose={() => setShowOutputPicker(false)}
        />
      )}

      {/* Input item picker sheet */}
      {pickerForLineKey && (
        <ItemPickerSheet
          title="What did you use?"
          items={items.filter((i) => !usedInputIds.has(i.id) || inputLines.find((l) => l.key === pickerForLineKey)?.item?.id === i.id)}
          isLoading={isLoading}
          onPick={(item) => pickInputItem(pickerForLineKey, item)}
          onClose={() => setPickerForLineKey(null)}
        />
      )}
    </>
  );
}

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-espresso text-label-sm font-bold text-crema">{n}</span>
      <p className="font-display text-heading-sm font-medium text-stone-900">{label}</p>
    </div>
  );
}

function ItemPickerSheet({
  title,
  items,
  isLoading,
  onPick,
  onClose,
}: {
  title: string;
  items: InventoryItem[];
  isLoading: boolean;
  onPick: (item: InventoryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => items.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search],
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-crema p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-body-md font-semibold text-stone-900">{title}</p>
        <input
          autoFocus
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="mb-3 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-body-md focus:border-espresso focus:outline-none"
        />
        {isLoading ? (
          <p className="py-6 text-center text-body-sm text-stone-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-stone-500">No items found.</p>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item)}
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-stone-100"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-100 text-label-sm font-semibold tabular-nums text-stone-500">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-stone-900">{item.name}</p>
                  <p className="text-label-sm text-stone-500">{item.usageUnit}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
