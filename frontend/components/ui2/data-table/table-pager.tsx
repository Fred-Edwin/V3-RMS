'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger } from '../select';
import { PER_PAGE_OPTIONS, pageItems, showingText, totalPages } from './table-query';

export interface TablePagerProps {
  page: number;
  perPage: number;
  /** Rows on this page. */
  shown: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  className?: string;
}

const focusRing = 'outline-none focus-visible:shadow-wds-ring';
const cell = 'flex size-[26px] shrink-0 items-center justify-center font-wds-mono text-[12px] leading-4';

/**
 * Paper steps 27 and 28: "Showing 1–50 of 142" on the left; "Rows per page" and ‹ 1 2 3 … 12 › on the right.
 * The current page is dark; the arrow that cannot be used is grey. 40px tall on the neutral-50 footer strip.
 */
export function TablePager({ page, perPage, shown, total, onPageChange, onPerPageChange, className }: TablePagerProps) {
  const pages = totalPages(total, perPage);
  const current = Math.min(page, pages);
  const items = pageItems(current, pages);
  const canPrev = current > 1;
  const canNext = current < pages;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex min-h-10 flex-wrap items-center justify-between gap-x-5 gap-y-2 bg-wds-neutral-50 px-4 py-1.5', className)}
    >
      <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted" aria-live="polite">
        {showingText(current, perPage, shown, total)}
      </p>

      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-2">
          <span id="rows-per-page-label" className="font-wds-sans text-[12px] leading-4 text-wds-text-copy-muted">
            Rows per page
          </span>
          <Select value={String(perPage)} onValueChange={(v) => onPerPageChange(Number(v))}>
            <SelectTrigger
              aria-labelledby="rows-per-page-label"
              className="h-auto w-auto gap-1.5 rounded-none border-wds-border-strong py-[3px] pl-2 pr-2 font-wds-mono text-[12px] leading-4"
            >
              <span>{perPage}</span>
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={!canPrev}
            onClick={() => onPageChange(current - 1)}
            className={cn(cell, 'font-wds-sans text-[14px]', focusRing, canPrev ? 'text-wds-selected-edge hover:bg-wds-neutral-100' : 'cursor-not-allowed text-wds-neutral-400')}
          >
            ‹
          </button>
          {items.map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden className={cn(cell, 'text-wds-text-copy-muted')}>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => (item === current ? undefined : onPageChange(item))}
                className={cn(
                  cell,
                  focusRing,
                  item === current ? 'bg-wds-text-ink text-white' : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
                )}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={!canNext}
            onClick={() => onPageChange(current + 1)}
            className={cn(cell, 'font-wds-sans text-[14px]', focusRing, canNext ? 'text-wds-selected-edge hover:bg-wds-neutral-100' : 'cursor-not-allowed text-wds-neutral-400')}
          >
            ›
          </button>
        </div>
      </div>
    </nav>
  );
}
