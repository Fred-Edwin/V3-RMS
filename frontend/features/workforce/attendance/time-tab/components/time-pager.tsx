'use client';

import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import { rangeWords } from '../lib/time-view';

/** The page sizes the server accepts for T1. */
export const PAGE_SIZES = [10, 25, 50] as const;

/** Pages to show around the current one, with gaps as null: 1 … 4 5 6 … 20. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const sorted = Array.from(new Set([1, pages, page - 1, page, page + 1])).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] ?? 0) > 1) out.push(null);
    out.push(n);
  });
  return out;
}

const cell = 'flex h-8 min-w-8 items-center justify-center border px-2 font-wds-sans text-[13px] leading-4';

/**
 * The foot of the days table (Paper 1.1, UI_BUILD_RULES 4a): "Showing 1 to 9 of 24 days" on the left, numbered pages and
 * "rows per page" on the right. The server pages the days; nothing is sliced here.
 */
export function TimePager({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-wds-border px-5 py-3.5">
      <span aria-live="polite" className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">
        {rangeWords(page, pageSize, total)}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {total > 0 ? (
          <nav aria-label="Pages" className="flex items-center gap-2">
            {pageWindow(page, pages).map((n, i) =>
              n === null ? (
                <span key={`gap-${i}`} aria-hidden className={cn(cell, 'border-transparent text-wds-text-secondary')}>
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-current={n === page ? 'page' : undefined}
                  aria-label={`Page ${n}`}
                  onClick={() => onPage(n)}
                  className={cn(cell, MOTION, FOCUS_RING, n === page ? 'border-wds-text-ink bg-wds-text-ink text-white' : cn('border-wds-border-strong bg-wds-surface text-wds-text-ink', onHover('bg-wds-neutral-50')))}
                >
                  {n}
                </button>
              )
            )}
          </nav>
        ) : null}
        <Picker
          chips={false}
          aria-label="Rows per page"
          value={String(pageSize)}
          onValueChange={(v) => onPageSize(Number(v))}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} rows per page` }))}
        />
      </div>
    </div>
  );
}
