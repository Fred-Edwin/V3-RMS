import * as React from 'react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui2/select';
import { StockEmptyCard, StockErrorCard } from '../../../_shared/components/stock-states';
import type { RecipeRow, RecipesList, RecipesQuery } from '../../_shared/types/prep-contract';
import { HOVER_UNDERLINE, PRESS, PRESS_BUTTON } from '../lib/press';
import { CHANGED_OPTIONS, RECIPES_COPY, RECIPES_HELP, SHOW_OPTIONS } from '../lib/recipes-states-copy';
import { RecipesTable, RecipesTableSkeleton } from './recipes-table';

export type ShowFilter = NonNullable<RecipesQuery['show']>;
export type ChangedFilter = NonNullable<RecipesQuery['changed']>;

export interface RecipesListViewProps {
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  data: RecipesList | null;
  rows: RecipeRow[];
  canWrite: boolean;
  searchInput: string;
  show: ShowFilter;
  changed: ChangedFilter;
  anyFilter: boolean;
  page: number;
  perPage: number;
  onSearch: (value: string) => void;
  onShow: (value: ShowFilter) => void;
  onChanged: (value: ChangedFilter) => void;
  onClear: () => void;
  onRetry: () => void;
  onOpen: (row: RecipeRow) => void;
  onPage: (page: number) => void;
}

const monoLabel = 'font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary';
const triggerClass = 'h-9 w-full px-3 text-[13px] leading-4';

function FilterSelect<T extends string>({ label, value, options, onChange, width }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; width: string }) {
  return (
    <div className={cn('flex shrink-0 flex-col gap-1', width)}>
      <span className={monoLabel}>{label.toUpperCase()}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger aria-label={label} className={triggerClass}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The body of the Usual recipes page (Paper step 24 and the states of step 42): help note, filters, table or its state, pager. Pure: the screen passes data and handlers in. */
export function RecipesListView(p: RecipesListViewProps) {
  const loading = p.loadStatus === 'idle' || (p.loadStatus === 'loading' && p.rows.length === 0);
  const total = p.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / p.perPage));

  const body = (() => {
    if (loading) return <RecipesTableSkeleton />;
    if (p.loadStatus === 'error') {
      return <StockErrorCard title={RECIPES_COPY.error.title} description={RECIPES_COPY.error.description} onRetry={p.onRetry} className="px-4 py-8" />;
    }
    if (p.rows.length === 0) {
      return (
        <div className="flex justify-center px-4 py-8">
          {p.anyFilter ? (
            <StockEmptyCard title={RECIPES_COPY.filteredEmpty.title} description={RECIPES_COPY.filteredEmpty.description} actionLabel={RECIPES_COPY.filteredEmpty.action} onAction={p.onClear} />
          ) : (
            <StockEmptyCard title={RECIPES_COPY.empty.title} description={RECIPES_COPY.empty.description} />
          )}
        </div>
      );
    }
    return <RecipesTable rows={p.rows} canWrite={p.canWrite} onOpen={p.onOpen} />;
  })();

  const count = p.data ? `${p.data.totalItems} prepped ${p.data.totalItems === 1 ? 'item' : 'items'} · ${p.data.withoutRecipe} without a target` : '';

  return (
    <>
      <div className="flex shrink-0 flex-col gap-1.5">
        <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-text-ink">Usual recipes</h1>
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">What each prepped item should give, for the amounts you use.</p>
      </div>
      <div className="flex shrink-0 gap-2.5 border border-wds-info-border bg-wds-info-bg px-4 py-3">
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-info-fg">{RECIPES_HELP}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="flex w-full flex-col gap-1 sm:w-[380px] sm:shrink-0">
          <label htmlFor="recipes-search" className={monoLabel}>
            SEARCH
          </label>
          <input
            id="recipes-search"
            type="search"
            name="search"
            autoComplete="off"
            placeholder="Item or ingredient, for example chicken"
            value={p.searchInput}
            onChange={(e) => p.onSearch(e.target.value)}
            className="h-9 w-full border border-wds-border-strong bg-white px-3 font-wds-sans text-[13px] leading-4 text-wds-text-ink placeholder:text-wds-text-faint focus-visible:border-wds-selected-edge focus-visible:shadow-[0_0_0_1px_var(--wds-selected-edge)] focus-visible:outline-none"
          />
        </div>
        <FilterSelect label="Show" value={p.show} options={SHOW_OPTIONS} onChange={p.onShow} width="w-[calc(50%-6px)] sm:w-[190px]" />
        <FilterSelect label="Changed" value={p.changed} options={CHANGED_OPTIONS} onChange={p.onChanged} width="w-[calc(50%-6px)] sm:w-[190px]" />
        <span className="hidden grow sm:block" />
        {p.anyFilter ? (
          <button type="button" onClick={p.onClear} className={cn('h-9 rounded-wds-sm font-wds-sans text-[13px] leading-4 text-wds-espresso-700', HOVER_UNDERLINE, PRESS)}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border border-wds-border bg-white">
        <div className="flex h-[52px] items-center justify-between gap-4 px-[18px]">
          <h2 className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">Usual recipes</h2>
          <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{count}</span>
        </div>
        <div className="overflow-x-auto">{body}</div>
      </div>

      {totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-4">
          <p className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Showing {p.rows.length} of {total} {p.anyFilter ? 'that match' : 'prepped items'}.
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              Page {p.page} of {totalPages}
            </span>
            <Button variant="secondary" size="sm" className={PRESS_BUTTON} disabled={p.page <= 1} onClick={() => p.onPage(p.page - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" className={PRESS_BUTTON} disabled={p.page >= totalPages} onClick={() => p.onPage(p.page + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
