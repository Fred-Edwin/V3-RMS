import * as React from 'react';

import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui2/skeleton';
import type { RecipeRow } from '../../_shared/types/prep-contract';
import { formatAmount } from '../lib/recipe-scaling';

const headCell = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-ink';
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

/** "8 Oct · Joseph" */
export function changedText(row: RecipeRow): string {
  if (!row.recipe) return '—';
  return `${dayMonth.format(new Date(row.recipe.lastChangedAt))} · ${row.recipe.lastChangedBy.name.split(' ')[0]}`;
}

export function targetText(row: RecipeRow): string {
  return row.recipe ? `${formatAmount(row.recipe.targetYield, row.unit)} ${row.unit}` : 'Not set';
}

/** What the recipe cell says for an item with none: how runs are judged meanwhile. */
export function noRecipeText(row: RecipeRow): string {
  return row.pastRunsAverageText ? `No recipe yet · judged on the average of past runs (${row.pastRunsAverageText})` : 'No recipe yet · not judged until runs are recorded';
}

export interface RecipesTableProps {
  rows: RecipeRow[];
  /** Edit / Set buttons show only with prep.recipes_write. */
  canWrite: boolean;
  onOpen: (row: RecipeRow) => void;
}

/** Paper step 24: no header fill, an ink rule under the header, 52 px rows; an item with no recipe is tinted warning. Same flex-row table as Suppliers. */
export function RecipesTable({ rows, canWrite, onOpen }: RecipesTableProps) {
  return (
    <div role="table" aria-label="Usual recipes" className="min-w-[1040px]">
      <div role="row" className="flex h-[34px] items-center border-b border-wds-text-ink px-[18px]">
        <span role="columnheader" className={cn(headCell, 'w-[200px] shrink-0')}>PREPPED ITEM</span>
        <span role="columnheader" className={cn(headCell, 'w-[330px] shrink-0')}>RECIPE FOR ONE BATCH</span>
        <span role="columnheader" className={cn(headCell, 'w-[150px] shrink-0 text-right')}>TARGET YIELD</span>
        <span role="columnheader" className={cn(headCell, 'w-[170px] shrink-0 pl-7')}>SCALES BY</span>
        <span role="columnheader" className={cn(headCell, 'min-w-0 grow basis-0')}>LAST CHANGED</span>
        <span role="columnheader" className="w-[60px] shrink-0">
          <span className="sr-only">Actions</span>
        </span>
      </div>
      {rows.map((row) => {
        const has = row.recipe !== null;
        return (
          <div
            key={row.itemId}
            role="row"
            className={cn(
              'group relative flex items-center border-b border-wds-border px-[18px] transition-colors duration-150 ease-out last:border-b-0',
              has ? 'h-[52px]' : 'h-14 bg-wds-warning-bg',
              canWrite && '[@media(hover:hover)_and_(pointer:fine)]:hover:bg-wds-espresso-50'
            )}
          >
            <span role="cell" className="w-[200px] shrink-0 truncate pr-3 font-wds-sans text-[13px] font-medium leading-4 text-wds-text-ink">{row.itemName}</span>
            <span role="cell" className={cn('w-[330px] shrink-0 pr-4 font-wds-sans text-[13px] leading-4', has ? 'text-wds-text-secondary' : 'text-wds-warning-fg')}>
              {row.recipe ? row.recipe.ingredientsText : noRecipeText(row)}
            </span>
            <span role="cell" className={cn('w-[150px] shrink-0 text-right font-wds-sans text-[13px] leading-4', has ? 'font-medium text-wds-text-ink' : 'text-wds-warning-fg')}>{targetText(row)}</span>
            <span role="cell" className={cn('w-[170px] shrink-0 truncate pl-7 font-wds-sans text-[13px] leading-4', has ? 'text-wds-text-secondary' : 'text-wds-text-faint')}>{row.recipe ? row.recipe.mainItemName : '—'}</span>
            <span role="cell" className={cn('min-w-0 grow basis-0 truncate', has ? 'font-wds-mono text-[12px] leading-4 text-wds-text-secondary' : 'font-wds-sans text-[13px] leading-4 text-wds-text-faint')}>{changedText(row)}</span>
            <span role="cell" className="flex w-[60px] shrink-0 justify-end">
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  aria-label={`${has ? 'Edit' : 'Set'} the recipe for ${row.itemName}`}
                  className={cn(
                    "cursor-pointer rounded-wds-sm font-wds-sans text-[13px] font-medium leading-4 text-wds-espresso-700 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:shadow-[inset_0_0_0_2px_var(--wds-selected-edge)]",
                    'group-hover:underline'
                  )}
                >
                  {has ? 'Edit' : 'Set'}
                </button>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Loading rows for the table (states kit: skeleton rows). */
export function RecipesTableSkeleton() {
  return (
    <div role="status" aria-live="polite" className="min-w-[1040px]">
      <span className="sr-only">Loading the usual recipes</span>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex h-[52px] items-center border-b border-wds-border px-[18px] last:border-b-0" aria-hidden>
          <span className="w-[200px] shrink-0"><Skeleton className="h-3 w-[120px]" /></span>
          <span className="w-[330px] shrink-0"><Skeleton className="h-3 w-[260px]" /></span>
          <span className="flex w-[150px] shrink-0 justify-end"><Skeleton className="h-3 w-[60px]" /></span>
          <span className="w-[170px] shrink-0 pl-7"><Skeleton className="h-3 w-[80px]" /></span>
          <span className="grow"><Skeleton className="h-3 w-[90px]" /></span>
        </div>
      ))}
    </div>
  );
}
