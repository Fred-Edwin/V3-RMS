'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';

import { EmptyState, ErrorBlock, FOCUS_RING, ListSkeleton, MOTION, StatusTag, onHover } from '../../../_shared';
import { dayShortMonth, plural } from '../../_shared/lib/month-words';
import { wholeHours } from '../../_shared/lib/timesheet-words';
import type { MonthList, MonthListRow, MonthState } from '../../_shared/types/month-types';

const TAG: Record<MonthState, { tone: 'neutral' | 'warning' | 'success'; label: string }> = {
  OPEN: { tone: 'neutral', label: 'Open' },
  TO_APPROVE: { tone: 'warning', label: 'To approve' },
  APPROVED: { tone: 'success', label: 'Approved' },
};

/** Line 2 of a month: "Today is 19 Oct · 3,118 h so far" for the open month, else "5,356 h · 31 people". */
export function monthLine(row: MonthListRow): string {
  if (row.state === 'OPEN' && row.soFarThroughDate) return `Through ${dayShortMonth(row.soFarThroughDate)} · ${wholeHours(row.workedMinutes)} so far`;
  return `${wholeHours(row.workedMinutes)} · ${plural(row.headcount, 'person', 'people')}`;
}

/** The numbered pager under the list: "‹ 1 2 ›". */
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  const button = 'flex h-7 min-w-7 items-center justify-center px-1.5 font-wds-sans text-[12px] leading-4';
  return (
    <nav aria-label="Months pages" className="flex items-center gap-1">
      <button type="button" aria-label="Newer months" disabled={page <= 1} onClick={() => onPage(page - 1)} className={cn(button, 'text-wds-text-secondary disabled:opacity-40', FOCUS_RING)}>
        ‹
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn(button, MOTION, FOCUS_RING, n === page ? 'bg-wds-neutral-950 font-semibold text-white' : cn('text-wds-text-secondary', onHover('bg-wds-neutral-50')))}>
          {n}
        </button>
      ))}
      <button type="button" aria-label="Older months" disabled={page >= pages} onClick={() => onPage(page + 1)} className={cn(button, 'text-wds-text-secondary disabled:opacity-40', FOCUS_RING)}>
        ›
      </button>
    </nav>
  );
}

/**
 * The months of a branch, newest first (spec S1). The chosen month is grey with a dark bar, never amber. Up and Down move between
 * the months; Enter chooses. The list scrolls by itself; a failed list says so and keeps the month panel working.
 */
export function MonthsList({
  siteName,
  status,
  data,
  selected,
  page,
  onSelect,
  onPage,
  onRetry,
}: {
  siteName: string;
  status: 'loading' | 'ready' | 'error';
  data: MonthList | null;
  selected: string | null;
  page: number;
  onSelect: (monthKey: string) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
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
  else if (!data || data.months.length === 0) {
    body = <EmptyState kind="nothingYet" title="No timesheets yet" line="Timesheets start on the first day of the month after this branch's new clock was switched on." />;
  } else {
    body = (
      <ul ref={listRef} onKeyDown={move} className="m-0 flex list-none flex-col p-0">
        {data.months.map((row) => {
          const chosen = row.monthKey === selected;
          const tag = TAG[row.state];
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
                <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{monthLine(row)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav aria-label={`Months, ${siteName}`} className="flex min-h-0 w-full flex-col pt-4 lg:w-[232px] lg:shrink-0 lg:border-r lg:border-wds-neutral-950">
      <h2 className="m-0 pb-2.5 pr-4 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">Months · {siteName}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      {data && data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-wds-neutral-100 py-3 pr-4">
          <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
            Showing {data.months.length} of {data.total} {data.total === 1 ? 'month' : 'months'} · Page {page}
          </span>
          <Pager page={page} pages={pages} onPage={onPage} />
        </div>
      ) : null}
    </nav>
  );
}
