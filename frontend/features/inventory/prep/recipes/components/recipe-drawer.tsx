'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Combobox } from '@/components/ui2/combobox';
import { Skeleton } from '@/components/ui2/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui2/toggle-group';
import { DrawerHost } from '../../../catalog/components/drawer-parts';
import { FormErrorBanner, StockErrorCard } from '../../../_shared/components/stock-states';
import type { RecipeDetail, RecipeReason } from '../../_shared/types/prep-contract';
import { useIngredientOptions } from '../hooks/use-ingredient-options';
import { useRecipeDetail, useSaveRecipe } from '../hooks/use-recipes';
import {
  REASON_OPTIONS,
  checkRecipeForm,
  formFromDetail,
  formFromSuggestion,
  mapSaveError,
  newLineKey,
  removeLine,
  setMain,
  stepFor,
  toRecipeInput,
  type FormLine,
  type RecipeFormState,
  type RecipeSaveProblem,
} from '../lib/recipe-form';
import { HOVER_UNDERLINE, PRESS, PRESS_BUTTON } from '../lib/press';
import { RECIPES_COPY } from '../lib/recipes-states-copy';
import { formatAmount, trimNumber } from '../lib/recipe-scaling';
import { AmountStepper } from './amount-stepper';
import { ScalingPanel } from './scaling-panel';

const monoLabel = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary';

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });
const firstName = (name: string): string => name.split(' ')[0] ?? name;

export interface RecipeDrawerProps {
  /** The prepped item whose recipe is open; null closes the drawer. */
  itemId: string | null;
  itemName: string;
  /** "about 3 kg" from the list row: a hint under the target for an item with no recipe. */
  pastRunsAverageText: string | null;
  onClose: () => void;
  /** Called after a save so the list can reload. */
  onSaved: () => void;
}

/** Step 25 (edit) and step 26 (first recipe, with "Use these"): one drawer, two variants. */
export function RecipeDrawer({ itemId, itemName, pastRunsAverageText, onClose, onSaved }: RecipeDrawerProps) {
  const { detail, status, error, reload } = useRecipeDetail(itemId, itemId !== null);
  return (
    <DrawerHost open={itemId !== null} onOpenChange={(open) => (open ? undefined : onClose())} label={`Usual recipe · ${itemName}`}>
      {status === 'ready' && detail && itemId ? (
        <RecipeEditor key={`${detail.itemId}:${detail.current?.version ?? 0}`} detail={detail} pastRunsAverageText={pastRunsAverageText} onClose={onClose} onSaved={onSaved} />
      ) : (
        <>
          <DrawerHeader title={`Usual recipe · ${itemName}`} sub="" />
          <div className="flex min-h-0 grow flex-col gap-4 px-6 py-5">
            {status === 'error' ? (
              <StockErrorCard title={RECIPES_COPY.error.title} description={error ?? RECIPES_COPY.drawerLoadError} onRetry={() => void reload()} />
            ) : (
              <div role="status" aria-live="polite" className="flex flex-col gap-3">
                <span className="sr-only">{RECIPES_COPY.loadingLabel}</span>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-[120px] w-full" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-[56px] w-full" />
              </div>
            )}
          </div>
        </>
      )}
    </DrawerHost>
  );
}

function DrawerHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex shrink-0 justify-between border-b border-wds-border px-6 pb-4 pt-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{title}</span>
        {sub ? <span className="font-wds-mono text-[11px] leading-[14px] tracking-[0.04em] text-wds-text-secondary">{sub.toUpperCase()}</span> : null}
      </div>
      <DialogPrimitive.Close
        aria-label="Close"
        className={cn('-mr-1 -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-wds-sm font-wds-sans text-[20px] leading-5 text-wds-text-secondary', PRESS)}
      >
        <span aria-hidden>×</span>
      </DialogPrimitive.Close>
    </div>
  );
}

function RecipeEditor({ detail, pastRunsAverageText, onClose, onSaved }: { detail: RecipeDetail; pastRunsAverageText: string | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<RecipeFormState>(() => formFromDetail(detail));
  const [adding, setAdding] = React.useState(false);
  const [problem, setProblem] = React.useState<RecipeSaveProblem | null>(null);
  const [touched, setTouched] = React.useState(false);
  const { run, saving, failure, clear } = useSaveRecipe(detail.itemId);
  const ingredients = useIngredientOptions(true);

  const isFirst = detail.current === null;
  const check = checkRecipeForm(form, detail);
  const main = form.lines.find((l) => l.isMain) ?? null;
  const suggestion = isFirst ? formFromSuggestion(detail) : null;

  const update = (patch: Partial<RecipeFormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setProblem(null);
    clear();
  };
  const updateLine = (key: string, patch: Partial<FormLine>) => update({ lines: form.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });

  const usedIds = new Set(form.lines.map((l) => l.itemId));
  const pickable = ingredients.options.filter((o) => o.itemId !== detail.itemId && !usedIds.has(o.itemId)).map((o) => ({ value: o.itemId, label: o.name }));

  const addIngredient = (itemId: string) => {
    const option = ingredients.options.find((o) => o.itemId === itemId);
    if (!option) return;
    const first = form.lines.length === 0;
    update({ lines: [...form.lines, { key: newLineKey(), itemId: option.itemId, itemName: option.name, unit: option.unit, amount: trimNumber(stepFor(option.unit)), isMain: first }] });
    setAdding(false);
  };

  const save = async () => {
    setTouched(true);
    if (!check.canSave || saving) return;
    const saved = await run(toRecipeInput(form, check.reasonRequired));
    if (saved) {
      onSaved();
      onClose();
    }
  };

  const failureProblem = failure ? mapSaveError(failure.code, failure.message) : null;
  const shown = problem ?? failureProblem;
  const showProblems = touched || shown !== null;
  const wasTarget = detail.current ? `${formatAmount(detail.current.targetYield, detail.unit)} ${detail.unit}` : null;
  const targetChanged = detail.current !== null && Number(form.targetYield) !== Number(detail.current.targetYield);
  const cost = detail.costPerUnitNow !== undefined ? Math.round(Number(detail.costPerUnitNow)) : null;

  const sub = detail.current
    ? `Last changed ${dayMonth.format(new Date(detail.current.changedAt))} · ${detail.current.changedBy.name}`
    : 'No recipe yet';

  return (
    <>
      <DrawerHeader title={`${isFirst ? 'Set a recipe' : 'Usual recipe'} · ${detail.itemName}`} sub={sub} />
      <div className="flex min-h-0 grow flex-col gap-[18px] overflow-y-auto px-6 py-5">
        {failure && failureProblem?.field === 'form' && failure.code !== 'RECIPE_UNCHANGED' ? (
          <FormErrorBanner title={RECIPES_COPY.saveError.title} description={failure.code === null ? RECIPES_COPY.saveError.description : failureProblem.message} />
        ) : null}

        {suggestion && form.lines.length === 0 && detail.suggestFromLastRun ? (
          <div className="flex items-center justify-between gap-3 border border-wds-info-border bg-wds-info-bg px-3.5 py-3">
            <span className="font-wds-sans text-[13px] leading-[19px] text-wds-info-fg">
              Last run {detail.suggestFromLastRun.basedOn} used{' '}
              {detail.suggestFromLastRun.lines.map((l) => `${trimNumber(l.amount)} ${l.unit} ${l.itemName.toLowerCase()}`).join(', ')} and gave {trimNumber(detail.suggestFromLastRun.made)} {detail.unit}.
            </span>
            <button
              type="button"
              onClick={() => update(suggestion)}
              className={cn('shrink-0 border border-wds-info-fg px-3 py-[7px] font-wds-sans text-[12px] font-medium leading-4 text-wds-info-fg', PRESS)}
            >
              Use these
            </button>
          </div>
        ) : null}

        <section className="flex flex-col gap-2">
          <span className={monoLabel}>FOR ONE BATCH, USE</span>
          {form.lines.length > 0 ? (
            <ul className="border border-wds-border">
              {form.lines.map((line, i) => (
                <li key={line.key} className={cn('flex items-center justify-between gap-3 px-3 py-2.5', i < form.lines.length - 1 && 'border-b border-wds-border')}>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{line.itemName}</span>
                    {line.isMain ? (
                      <span className="font-wds-sans text-[11px] leading-[14px] text-wds-espresso-700">● Main ingredient · the target scales by this</span>
                    ) : (
                      <span className="flex items-center gap-2 font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">
                        <button type="button" onClick={() => update({ lines: setMain(form.lines, line.key) })} className={cn('rounded-wds-sm', HOVER_UNDERLINE, PRESS)}>
                          Set as main ingredient
                        </button>
                        <span aria-hidden>·</span>
                        <button type="button" onClick={() => update({ lines: removeLine(form.lines, line.key) })} className={cn('rounded-wds-sm', HOVER_UNDERLINE, PRESS)}>
                          Remove
                        </button>
                      </span>
                    )}
                  </div>
                  <AmountStepper
                    value={line.amount}
                    unit={line.unit}
                    label={`${line.itemName} amount`}
                    invalid={showProblems && !/^\d+(\.\d+)?$/.test(line.amount)}
                    onChange={(amount) => updateLine(line.key, { amount })}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-wds-border-strong px-3 py-4 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">No ingredients yet.</p>
          )}
          {adding ? (
            <div className="flex items-center gap-2">
              <Combobox value={undefined} onValueChange={addIngredient} options={pickable} placeholder={ingredients.status === 'loading' ? 'Loading items…' : 'Find an item'} aria-label="Ingredient" chevron className="grow" />
              <button type="button" onClick={() => setAdding(false)} className={cn('rounded-wds-sm font-wds-sans text-[13px] leading-4 text-wds-text-secondary', HOVER_UNDERLINE, PRESS)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className={cn('w-fit rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700', HOVER_UNDERLINE, PRESS)}>
              + Add an ingredient
            </button>
          )}
          {isFirst ? <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">Not sure which is the main one? Pick the ingredient you use the most of. The system proposes the largest.</span> : null}
          {showProblems && (check.problems.lines || check.problems.main || check.problems.amounts) ? (
            <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
              {check.problems.lines ?? check.problems.main ?? check.problems.amounts}
            </span>
          ) : null}
          {shown?.field === 'main' ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{shown.message}</span> : null}
        </section>

        <section className="flex flex-col gap-2">
          <span className={monoLabel}>THAT BATCH SHOULD GIVE</span>
          <div className="flex items-center justify-between gap-3 border border-wds-border-strong px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-wds-sans text-[14px] leading-[18px] text-wds-text-ink">{detail.itemName}</span>
              {wasTarget && targetChanged ? (
                <span className="font-wds-sans text-[11px] leading-[14px] text-wds-warning-fg">Was {wasTarget}</span>
              ) : isFirst && pastRunsAverageText ? (
                <span className="font-wds-sans text-[11px] leading-[14px] text-wds-text-secondary">Past runs averaged {pastRunsAverageText}</span>
              ) : null}
            </div>
            <label className={cn('flex h-10 shrink-0 items-center justify-center gap-[5px] border bg-white px-3', showProblems && check.problems.targetYield ? 'border-wds-error-fg' : 'border-wds-espresso-700')}>
              <input
                inputMode="decimal"
                autoComplete="off"
                aria-label="Target yield for one batch"
                value={form.targetYield}
                placeholder="0"
                onChange={(e) => {
                  const next = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d{0,4}$/.test(next)) update({ targetYield: next });
                }}
                className="w-14 min-w-0 bg-transparent text-right font-wds-mono text-[20px] leading-6 text-wds-text-ink outline-none placeholder:text-wds-text-muted"
              />
              <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{detail.unit}</span>
            </label>
          </div>
          {showProblems && check.problems.targetYield ? <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{check.problems.targetYield}</span> : null}
        </section>

        <ScalingPanel
          targetYield={form.targetYield}
          mainAmount={main && Number(main.amount) > 0 ? main.amount : null}
          mainName={main?.itemName ?? null}
          mainUnit={main?.unit ?? null}
          outputUnit={detail.unit}
        />

        {check.reasonRequired ? (
          <section className="flex flex-col gap-2">
            <span className={monoLabel}>WHY ARE YOU CHANGING IT?</span>
            <ToggleGroup
              type="single"
              value={form.reason ?? ''}
              onValueChange={(value) => update({ reason: (value || null) as RecipeReason | null })}
              aria-label="Why are you changing it?"
              className="w-full flex-wrap gap-2 overflow-visible border-0"
            >
              {REASON_OPTIONS.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className={cn(
                    'h-auto border !border-l border-wds-border-strong bg-white px-3 py-2 text-[13px] leading-4 text-wds-text-ink transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:active:scale-[0.97]',
                    'hover:bg-white data-[state=on]:!border-wds-espresso-700 data-[state=on]:bg-wds-espresso-50 data-[state=on]:text-wds-espresso-700 data-[state=on]:hover:bg-wds-espresso-50'
                  )}
                >
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {form.reason === 'OTHER' ? (
              <textarea
                aria-label="What changed (optional)"
                maxLength={300}
                rows={2}
                value={form.reasonNote}
                onChange={(e) => update({ reasonNote: e.target.value })}
                placeholder="What changed? (optional)"
                className="w-full resize-none border border-wds-border-strong bg-white px-3 py-2 font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-wds-text-muted focus-visible:border-wds-selected-edge"
              />
            ) : null}
            {(showProblems && check.problems.reason) || shown?.field === 'reason' ? (
              <span role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">{shown?.field === 'reason' ? shown.message : check.problems.reason}</span>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 border-t border-wds-border px-6 py-3.5">
        <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          {isFirst
            ? 'Until a recipe is saved, runs of this item are judged on the average of past runs. No reason is needed for a first recipe.'
            : `Past runs keep the target that applied when they were recorded.${cost !== null ? ` At today’s prices this recipe costs about KES ${cost} per ${detail.unit.replace(/s$/, '')}.` : ''}`}
        </p>
        {failure?.code === 'RECIPE_UNCHANGED' ? (
          <p role="alert" className="font-wds-sans text-[12px] leading-4 text-wds-error-fg">
            Nothing is different from the current recipe, so there is nothing to save.
          </p>
        ) : null}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" className={cn('h-9 px-4 text-[13px]', PRESS_BUTTON)} onClick={onClose}>
            Cancel
          </Button>
          <Button className={cn('h-9 px-[18px] text-[13px]', PRESS_BUTTON)} disabled={!check.canSave || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save recipe'}
          </Button>
        </div>
      </div>
    </>
  );
}
