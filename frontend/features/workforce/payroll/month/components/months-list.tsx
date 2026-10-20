'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, FOCUS_RING, ListSkeleton, MOTION, StatusTag, onHover } from '../../../_shared';
import { STATE_TAG, listLine } from '../../_shared/lib/month-view';
import type { MonthList } from '../../_shared/types/month-types';

/** The numbered pager under the list: "‹ 1 2 ›". */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  const button = 'flex h-7 min-w-7 items-center justify-center px-1.5 font-wds-sans text-[12px] leading-4';
  return (
    <nav aria-label="Months pages" className="flex items-center gap-1">
      <button type="button" aria-label="Newer months" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(button, MOTION, FOCUS_RING, 'text-wds-text-secondary disabled:pointer-events-none disabled:opacity-40', onHover('bg-wds-neutral-50'))}>
        ‹
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(button, MOTION, FOCUS_RING, n === page ? 'bg-wds-neutral-950 font-semibold text-white' : cn('text-wds-text-secondary', onHover('bg-wds-neutral-50')))}>
          {n}
        </button>
      ))}
      <button type="button" aria-label="Older months" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(button, MOTION, FOCUS_RING, 'text-wds-text-secondary disabled:pointer-events-none disabled:opacity-40', onHover('bg-wds-neutral-50'))}>
        ›
      </button>
    </nav>
  );
}

/**
 * The company's months, newest first (spec S-shell). The chosen month is grey with a dark bar, never amber. Up and Down move between
 * the months; the list scrolls by itself. A failed list says so and leaves the month panel working. Below 1360 px (the shell's menu
 * leaves the month panel too narrow beside a 280 px list) the page swaps this for a month picker, so this list is shown from 1360 px.
 */
export function MonthsList({
  status,
  data,
  selected,
  page,
  onSelect,
  onPage,
  onRetry,
  onEmptyLink,
}: {
  status: 'loading' | 'ready' | 'error';
  data: MonthList | null;
  selected: string | null;
  page: number;
  onSelect: (monthKey: string) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
  onEmptyLink: () => void;
}) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const move = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-month]') ?? []);
    const at = buttons.findIndex((b) => b === document.activeElement);
    const next = buttons[at + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.rows)) : 1;

  let body: React.ReactNode;
  if (status === 'loading' && !data) body = <ListSkeleton rows={5} columns={['fill', 64]} label="Loading the months" />;
  else if (status === 'error' && !data) body = <ErrorBlock title="The months did not load" line="Check your connection and try again." onRetry={onRetry} />;
  else if (!data || data.items.length === 0) {
    body = <EmptyState kind="nothingYet" title="Payroll has not started yet" line="Payroll starts with the first month a branch's new clock was on. Until then payslips are made on the old Payslips page." action={{ label: 'Old Payslips', onClick: onEmptyLink }} />;
  } else {
    body = (
      <ul ref={listRef} onKeyDown={move} className="m-0 flex list-none flex-col p-0">
        {data.items.map((row) => {
          const chosen = row.monthKey === selected;
          const tag = STATE_TAG[row.state];
          return (
            <li key={row.monthKey} className="border-t border-wds-neutral-100">
              <button
                type="button"
                data-month={row.monthKey}
                aria-current={chosen ? 'true' : undefined}
                onClick={() => onSelect(row.monthKey)}
                className={cn('flex w-full flex-col gap-1 py-3.5 pr-4 text-left', MOTION, FOCUS_RING, 'focus-visible:-outline-offset-2', chosen ? 'border-l-[3px] border-l-wds-neutral-950 bg-wds-neutral-200 pl-[13px]' : cn('pl-4', onHover('bg-wds-neutral-50')))}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{row.label}</span>
                  <StatusTag tone={tag.tone}>{tag.label}</StatusTag>
                </span>
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{listLine(row)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav aria-label="Months, company" className="hidden min-h-0 w-[280px] shrink-0 flex-col border-r border-wds-neutral-950 pt-4 min-[1360px]:flex">
      <h2 className="m-0 pb-2.5 pr-4 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">Months · Company</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-wds-neutral-100 py-3 pr-4">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Showing {data.items.length} of {data.total} {data.total === 1 ? 'month' : 'months'} · Page {page}
          </span>
          <Pager page={page} pages={pages} onPage={onPage} />
        </div>
      ) : null}
    </nav>
  );
}
