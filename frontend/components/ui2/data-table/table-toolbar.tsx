'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/lib/cn';
import { DateRangePicker } from '../date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import { type DatePreset, effectiveRange, nairobiToday, rangeToFilters } from './table-dates';

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

/**
 * The approved date range picker (Paper steps 28, 56, 57, 58). Owns two URL parameters (`from`, `to`; "any time" is `from=any`).
 * `defaultPreset` is the range shown when the URL has none, so the clean address is the starting view. The feature reads the
 * range back with `effectiveRange(query.filters, filter, filter.defaultPreset, nairobiToday())`.
 */
export interface DateRangeFilter {
  kind: 'dateRange';
  fromKey: string;
  toKey: string;
  /** Names the button for assistive technology: "Date". */
  label: string;
  defaultPreset: DatePreset;
  /** Adds the "Any time" quick pick. */
  allowAny?: boolean;
  /** The line under the calendar. */
  note?: string;
}

export type TableFilter = ChipFilter | DropdownFilter | ToggleChipsFilter | DateRangeFilter;

/** The URL parameter names a set of filters owns. */
export function filterKeysOf(filters: readonly TableFilter[]): string[] {
  return filters.flatMap((f) => (f.kind === 'toggles' ? f.toggles.map((t) => t.key) : f.kind === 'dateRange' ? [f.fromKey, f.toKey] : [f.key]));
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
  /** Sets several filter keys at once (a date range's `from` and `to`), as one change and one history entry. */
  onFiltersChange?: (changes: Record<string, string>) => void;
  /** `paper` is the Branch waste toolbar (W6, W8): a 300px search with a strong border, filters with 10px padding. The layout is the kit's. */
  variant?: 'default' | 'paper';
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
  onFiltersChange,
  variant = 'default',
  className,
}: TableToolbarProps) {
  const paper = variant === 'paper';
  const chips = filters.filter((f): f is ChipFilter => f.kind === 'chips');
  const toggleGroups = filters.filter((f): f is ToggleChipsFilter => f.kind === 'toggles');
  const dropdowns = filters.filter((f): f is DropdownFilter => f.kind === 'dropdown');
  const dateRanges = filters.filter((f): f is DateRangeFilter => f.kind === 'dateRange');
  // The Nairobi day is read once per mount: a table left open past midnight keeps yesterday's "Today" until it is reloaded.
  const today = React.useMemo(() => nairobiToday(), []);

  const chipClass = (active: boolean) =>
    cn(
      'border px-[11px] py-1.5 font-wds-sans text-[12px] leading-4 transition-colors max-sm:min-h-11',
      focusRing,
      active ? 'border-wds-text-ink bg-wds-text-ink text-white' : 'border-wds-border-strong bg-transparent text-wds-text-ink hover:bg-wds-neutral-50'
    );

  return (
    <div role="search" aria-label={searchLabel} className={cn('flex flex-wrap items-center gap-2 px-4 py-3', className)}>
      <label className={cn('flex h-8 max-sm:h-11 w-full shrink-0 items-center gap-2 border px-2.5 focus-within:border-wds-primary focus-within:shadow-wds-ring', paper ? 'border-wds-border-strong sm:w-[300px]' : 'border-wds-border sm:w-[240px]')}>
        <Search className="size-[13px] shrink-0 text-wds-text-faint" strokeWidth={1.5} aria-hidden />
        <input
          type="text"
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
          autoComplete="off"
          spellCheck={false}
          className={cn('min-w-0 grow bg-transparent font-wds-sans text-[13px] leading-4 text-wds-text-ink outline-none', paper ? 'placeholder:text-[#8D8982]' : 'placeholder:text-wds-text-faint')}
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

      {dropdowns.length > 0 || dateRanges.length > 0 ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {dateRanges.map((f) => (
            <DateRangePicker
              key={`${f.fromKey}:${f.toKey}`}
              label={f.label}
              today={today}
              allowAny={f.allowAny}
              note={f.note}
              value={effectiveRange(values, f, f.defaultPreset, today)}
              onChange={(range) => {
                const changes = rangeToFilters(range, f, f.defaultPreset, today);
                if (onFiltersChange) onFiltersChange(changes);
                else Object.entries(changes).forEach(([key, value]) => onFilterChange(key, value));
              }}
            />
          ))}
          {dropdowns.map((f) => {
            const current = values[f.key] ?? '';
            const chosen = f.options.find((o) => o.value === current);
            return (
              <Select key={f.key} value={current === '' ? ALL : current} onValueChange={(v) => onFilterChange(f.key, v === ALL ? '' : v)}>
                <SelectTrigger aria-label={f.label} className={cn('h-8 w-auto gap-1.5 rounded-none border-wds-border-strong text-[12px] leading-4 max-sm:h-11', paper ? 'px-2.5' : 'px-3')}>
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
