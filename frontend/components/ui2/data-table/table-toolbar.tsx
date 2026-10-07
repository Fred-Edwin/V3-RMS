'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';

export interface FilterOption {
  /** The value written to the URL and sent to the fetch function. `''` is "All" (no filter). */
  value: string;
  label: string;
}

export interface ChipFilter {
  kind: 'chips';
  key: string;
  /** Includes the first "All" option with `value: ''`. Counts come from the fetch result (`counts[key][value]`). */
  options: FilterOption[];
}

export interface DropdownFilter {
  kind: 'dropdown';
  key: string;
  /** The name the Catalog already uses: Category, Type, Department, Section. Reads "Name · All" when nothing is chosen. */
  label: string;
  options: FilterOption[];
}

/**
 * Chips that each switch on their own parameter (`?belowRestock=true&negative=true`) and can combine, with a leading
 * "All" chip that clears them. Use when a screen's links already carry boolean parameters.
 * Counts: `counts[<toggle key>]['true']`, and `counts[group]['']` for All.
 */
export interface ToggleChipsFilter {
  kind: 'toggles';
  /** Group id, used only for the All count. Not a URL parameter. */
  group: string;
  allLabel?: string;
  toggles: { key: string; label: string }[];
}

export type TableFilter = ChipFilter | DropdownFilter | ToggleChipsFilter;

/** The URL parameter names a set of filters owns. */
export function filterKeysOf(filters: readonly TableFilter[]): string[] {
  return filters.flatMap((f) => (f.kind === 'toggles' ? f.toggles.map((t) => t.key) : [f.key]));
}

const ALL = '__all__';

const focusRing = 'outline-none focus-visible:shadow-wds-ring';

export interface TableToolbarProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  filters: readonly TableFilter[];
  values: Record<string, string>;
  counts?: Record<string, Record<string, number>>;
  onFilterChange: (key: string, value: string) => void;
  className?: string;
}

/** Paper step 27: one bar above the header: a 240px search box, chips with counts, and dropdowns pushed to the right. */
export function TableToolbar({
  searchText,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  filters,
  values,
  counts,
  onFilterChange,
  className,
}: TableToolbarProps) {
  const chips = filters.filter((f): f is ChipFilter => f.kind === 'chips');
  const toggleGroups = filters.filter((f): f is ToggleChipsFilter => f.kind === 'toggles');
  const dropdowns = filters.filter((f): f is DropdownFilter => f.kind === 'dropdown');

  const chipClass = (active: boolean) =>
    cn(
      'border px-[11px] py-1.5 font-wds-sans text-[12px] leading-4 transition-colors',
      focusRing,
      active ? 'border-wds-text-ink bg-wds-text-ink text-white' : 'border-wds-border-strong bg-transparent text-wds-text-ink hover:bg-wds-neutral-50'
    );

  return (
    <div role="search" aria-label={searchLabel} className={cn('flex flex-wrap items-center gap-2 px-4 py-3', className)}>
      <label className="flex h-8 w-full shrink-0 items-center gap-2 border border-wds-border px-2.5 focus-within:border-wds-primary focus-within:shadow-wds-ring sm:w-[240px]">
        <Search className="size-[13px] shrink-0 text-wds-text-faint" strokeWidth={1.5} aria-hidden />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 grow bg-transparent font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none placeholder:text-wds-text-faint"
        />
      </label>

      {chips.map((group) =>
        group.options.map((opt) => {
          const active = (values[group.key] ?? '') === opt.value;
          const count = counts?.[group.key]?.[opt.value];
          return (
            <button
              key={`${group.key}:${opt.value}`}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(group.key, opt.value)}
              className={chipClass(active)}
            >
              {opt.label}
              {count !== undefined ? ` ${count}` : ''}
            </button>
          );
        })
      )}

      {toggleGroups.map((group) => {
        const keys = group.toggles.map((t) => t.key);
        const noneOn = keys.every((k) => values[k] !== 'true');
        const allCount = counts?.[group.group]?.[''];
        return (
          <React.Fragment key={group.group}>
            <button
              type="button"
              aria-pressed={noneOn}
              onClick={() => keys.forEach((k) => onFilterChange(k, ''))}
              className={chipClass(noneOn)}
            >
              {group.allLabel ?? 'All'}
              {allCount !== undefined ? ` ${allCount}` : ''}
            </button>
            {group.toggles.map((t) => {
              const on = values[t.key] === 'true';
              const count = counts?.[t.key]?.['true'];
              return (
                <button key={t.key} type="button" aria-pressed={on} onClick={() => onFilterChange(t.key, on ? '' : 'true')} className={chipClass(on)}>
                  {t.label}
                  {count !== undefined ? ` ${count}` : ''}
                </button>
              );
            })}
          </React.Fragment>
        );
      })}

      {dropdowns.length > 0 ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dropdowns.map((f) => {
            const current = values[f.key] ?? '';
            const chosen = f.options.find((o) => o.value === current);
            return (
              <Select key={f.key} value={current === '' ? ALL : current} onValueChange={(v) => onFilterChange(f.key, v === ALL ? '' : v)}>
                <SelectTrigger aria-label={f.label} className="h-8 w-auto gap-1.5 rounded-none border-wds-border-strong px-3 text-[12px] leading-4">
                  <span>
                    {f.label} · {chosen && chosen.value !== '' ? chosen.label : 'All'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {f.options
                    .filter((o) => o.value !== '')
                    .map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
