'use client';

import { Picker } from '@/components/ui2/picker';
import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';

/** Pages to show around the current one, with gaps as null: 1 … 4 5 6 … 20. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = Array.from(set).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] ?? 0) > 1) out.push(null);
    out.push(n);
  });
  return out;
}

/** "Showing 1 to 50 of 86". */
export const rangeWords = (page: number, rows: number, total: number): string => (total === 0 ? 'Nothing to show' : `Showing ${(page - 1) * rows + 1} to ${Math.min(page * rows, total)} of ${total}`);

/** The footer of a server-paged table (UI_BUILD_RULES 4a): the range, rows per page, and numbered pages. Nothing is sliced on the client. */
export function NumberedPager({ page, rows, total, onPage, onRows }: { page: number; rows: number; total: number; onPage: (page: number) => void; onRows: (rows: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / rows));
  const cell = 'flex h-7 min-w-7 items-center justify-center px-1.5 font-wds-sans text-[12px] leading-4';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-wds-border px-3.5 py-2.5">
      <span aria-live="polite" className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
        {rangeWords(page, rows, total)} ·{' '}
        <span className="inline-flex items-center gap-1.5">
          <Picker aria-label="Rows per page" value={String(rows)} onValueChange={(v) => onRows(Number(v))} options={[25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))} />
          rows per page
        </span>
      </span>
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(cell, MOTION, FOCUS_RING, 'text-wds-text-secondary disabled:pointer-events-none disabled:opacity-40', onHover('bg-wds-neutral-50'))}>
            Previous
          </button>
          {pageWindow(page, pages).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} aria-hidden className={cell}>
                …
              </span>
            ) : (
              <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(cell, MOTION, FOCUS_RING, n === page ? 'bg-wds-neutral-950 font-semibold text-white' : cn('text-wds-text-secondary', onHover('bg-wds-neutral-50')))}>
                {n}
              </button>
            )
          )}
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(cell, MOTION, FOCUS_RING, 'text-wds-text-secondary disabled:pointer-events-none disabled:opacity-40', onHover('bg-wds-neutral-50'))}>
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
