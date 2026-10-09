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
  /** `paper` is the Branch waste footer (W6, W8): 48 high, no fill, 28px Geist cells with bordered arrows. */
  variant?: 'default' | 'paper';
  className?: string;
}

const focusRing = 'outline-none focus-visible:shadow-wds-ring';
const cell = 'flex size-[26px] shrink-0 items-center justify-center font-wds-mono text-[12px] leading-4';
const paperCell = 'flex size-7 shrink-0 items-center justify-center font-wds-sans text-[12px] leading-4';

/**
 * Paper steps 27 and 28: "Showing 1–50 of 142" on the left; "Rows per page" and ‹ 1 2 3 … 12 › on the right.
 * The current page is dark; the arrow that cannot be used is grey. 40px tall on the neutral-50 footer strip.
 * The `paper` variant is the Branch waste footer (W6, W8): 48 high on the page, 28px cells in Geist, every cell but the current one
 * bordered, a 28px rows-per-page select.
 */
export function TablePager({ page, perPage, shown, total, onPageChange, onPerPageChange, variant = 'default', className }: TablePagerProps) {
  const pages = totalPages(total, perPage);
  const current = Math.min(page, pages);
  const items = pageItems(current, pages);
  const canPrev = current > 1;
  const canNext = current < pages;
  const paper = variant === 'paper';

  const arrowClass = (enabled: boolean) =>
    paper
      ? cn(paperCell, focusRing, 'border border-wds-border-strong bg-wds-surface text-[14px]', enabled ? 'text-wds-text-ink hover:bg-wds-neutral-50' : 'cursor-not-allowed text-[#8D8982]')
      : cn(cell, 'font-wds-sans text-[14px]', focusRing, enabled ? 'text-wds-selected-edge hover:bg-wds-neutral-100' : 'cursor-not-allowed text-wds-neutral-400');

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4', paper ? 'min-h-12 py-2' : 'min-h-10 bg-wds-neutral-50 py-1.5', className)}
    >
      <p className={cn('m-0 font-wds-sans text-[12px] leading-4', paper ? 'text-wds-text-secondary' : 'text-wds-text-copy-muted')} aria-live="polite">
        {showingText(current, perPage, shown, total)}
      </p>

      <div className={cn('flex flex-wrap items-center', paper ? 'gap-4' : 'gap-5')}>
        <div className="flex items-center gap-2">
          <span id="rows-per-page-label" className={cn('font-wds-sans text-[12px] leading-4', paper ? 'text-wds-text-secondary' : 'text-wds-text-copy-muted')}>
            Rows per page
          </span>
          <Select value={String(perPage)} onValueChange={(v) => onPerPageChange(Number(v))}>
            <SelectTrigger
              aria-labelledby="rows-per-page-label"
              className={cn(
                'h-auto w-auto gap-1.5 rounded-none border-wds-border-strong text-[12px] leading-4',
                paper ? 'h-7 bg-wds-surface px-2 py-0 font-wds-sans' : 'py-[3px] pl-2 pr-2 font-wds-mono'
              )}
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
          <button type="button" aria-label="Previous page" disabled={!canPrev} onClick={() => onPageChange(current - 1)} className={arrowClass(canPrev)}>
            ‹
          </button>
          {items.map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} aria-hidden className={cn(paper ? paperCell : cell, 'text-wds-text-copy-muted')}>
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
                  paper ? paperCell : cell,
                  focusRing,
                  item === current ? (paper ? 'bg-wds-text-ink font-semibold text-white' : 'bg-wds-text-ink text-white') : 'border border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50'
                )}
              >
                {item}
              </button>
            )
          )}
          <button type="button" aria-label="Next page" disabled={!canNext} onClick={() => onPageChange(current + 1)} className={arrowClass(canNext)}>
            ›
          </button>
        </div>
      </div>
    </nav>
  );
}
