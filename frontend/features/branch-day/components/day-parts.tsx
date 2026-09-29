'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { formatClock, shortName, HighlightOnChange } from '@/features/inventory';
import { blockerSummary, DEPARTMENT_STATUS_COPY, railDetail, TONE_DOT, TONE_TEXT } from '../lib/branch-day-format';
import type { BranchDayToday, DepartmentDaySummary } from '../types/branch-day';

/* ----------------------------------------------------------------- KPIs */

export interface DayKpis {
  readyValue: string;
  readyLabel: string;
  readyDetail: string;
  readyTone: 'faint' | 'success' | 'ink';
  blocked: number;
  notStarted: number;
  notStartedDetail: string;
}

/** The four KPI cells (`19C8-0` / `1EE4-0` / `1EJY-0`) derived from the department summaries — no separate numbers to disagree with the rail. */
export function dayKpis(today: BranchDayToday): DayKpis {
  const total = today.departments.length;
  const closed = today.status === 'CLOSED';
  const counted = today.departments.filter((d) => d.status === 'COUNTED' || d.status === 'CLOSED').length;
  const blocked = today.departments.filter((d) => d.status === 'BLOCKED').length;
  const notStarted = today.departments.filter((d) => d.status === 'NOT_STARTED').length;
  const begun = today.departments.every((d) => d.status !== 'NOT_STARTED');
  return {
    readyValue: `${counted} / ${total}`,
    readyLabel: closed ? 'DEPARTMENTS CLOSED' : 'DEPARTMENTS READY',
    readyDetail: closed
      ? `closed ${today.closedAt ? formatClock(today.closedAt) : ''} by ${today.closedBy ? shortName(today.closedBy.name) : ''}`
      : counted === total
        ? 'all counted, ready to close'
        : 'counted, ready to close',
    readyTone: closed || counted === total ? 'success' : 'faint',
    blocked,
    notStarted,
    notStartedDetail: notStarted === 0 ? (begun && counted === total ? 'every department counted' : 'every department begun') : 'count not yet begun',
  };
}

const kpiCell = 'flex grow basis-0 flex-col gap-1.5 bg-wds-gradient-surface-raise p-4';
const kpiLabel = 'font-wds-mono text-wds-field-label uppercase text-wds-text-copy-muted';

function YesterdayCell({ today, mobile = false }: { today: BranchDayToday; mobile?: boolean }) {
  const y = today.yesterday;
  if (!y) {
    return (
      <>
        <span className={cn('font-wds-mono font-medium text-wds-text-faint', mobile ? 'text-[18px]/[22px]' : 'text-wds-kpi')}>—</span>
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">no day recorded</span>
      </>
    );
  }
  if (y.status === 'CLOSED') {
    return (
      <>
        <span className={cn('font-wds-mono font-medium text-wds-success-fg', mobile ? 'text-[18px]/[22px]' : 'text-wds-kpi')}>Closed</span>
        <Link
          href={`/app/branch/day/document/${y.id}`}
          className="w-max font-wds-sans text-wds-caption text-wds-primary underline decoration-1 underline-offset-[3px] outline-none transition-colors hover:text-wds-primary-hover focus-visible:shadow-wds-ring"
        >
          signed {y.closedAt ? formatClock(y.closedAt) : ''} by {y.closedBy ? shortName(y.closedBy.name) : ''}
        </Link>
      </>
    );
  }
  return (
    <>
      <span className={cn('font-wds-mono font-medium text-wds-warning-fg', mobile ? 'text-[18px]/[22px]' : 'text-wds-kpi')}>Not closed</span>
      <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">left open</span>
    </>
  );
}

export function DayKpiStrip({ today }: { today: BranchDayToday }) {
  const k = dayKpis(today);
  return (
    <div className="mx-6 mb-5 flex shrink-0 overflow-hidden rounded-wds-md border border-wds-border bg-wds-surface">
      <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
        <span className={kpiLabel}>{k.readyLabel}</span>
        <HighlightOnChange value={k.readyValue} className={cn('font-wds-mono text-wds-kpi font-medium', k.readyTone === 'success' ? 'text-wds-success-fg' : k.readyTone === 'ink' ? 'text-wds-text-ink' : 'text-wds-text-faint')} />
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{k.readyDetail}</span>
      </div>
      <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
        <span className={kpiLabel}>BLOCKED</span>
        <HighlightOnChange value={k.blocked} className={cn('font-wds-mono text-wds-kpi font-medium', k.blocked > 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')} />
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{k.blocked > 0 ? 'unconfirmed dispatch' : 'no unconfirmed dispatch'}</span>
      </div>
      <div className={cn(kpiCell, 'border-r border-wds-neutral-800')}>
        <span className={kpiLabel}>NOT STARTED</span>
        <HighlightOnChange value={k.notStarted} className={cn('font-wds-mono text-wds-kpi font-medium', k.notStarted > 0 ? 'text-wds-warning-fg' : 'text-wds-text-ink')} />
        <span className="font-wds-sans text-wds-caption text-wds-text-copy-muted">{k.notStartedDetail}</span>
      </div>
      <div className={kpiCell}>
        <span className={kpiLabel}>YESTERDAY</span>
        <YesterdayCell today={today} />
      </div>
    </div>
  );
}

/** Mobile 2×2 (`1CDC-0`): 14px sides, 22/28 mono semibold values, faint 11px sub-lines, sans "Closed". */
export function DayKpiGrid({ today }: { today: BranchDayToday }) {
  const k = dayKpis(today);
  const cell = 'flex flex-col gap-1 px-3.5 py-3';
  const label = 'font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted';
  const value = 'font-wds-mono text-[22px]/7 font-semibold';
  const sub = 'font-wds-sans text-wds-mono-sm text-wds-text-faint';
  const y = today.yesterday;
  return (
    <div className="grid grid-cols-2 border-b border-wds-border bg-wds-surface">
      <div className={cn(cell, 'border-b border-r border-wds-border')}>
        <span className={label}>{k.readyLabel}</span>
        <HighlightOnChange value={k.readyValue} className={cn(value, k.readyTone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-ink')} />
        <span className={sub}>{k.readyDetail}</span>
      </div>
      <div className={cn(cell, 'border-b border-wds-border')}>
        <span className={label}>BLOCKED</span>
        <HighlightOnChange value={k.blocked} className={cn(value, k.blocked > 0 ? 'text-wds-error-fg' : 'text-wds-text-ink')} />
        <span className={sub}>{k.blocked > 0 ? 'unconfirmed dispatch' : 'no unconfirmed dispatch'}</span>
      </div>
      <div className={cn(cell, 'border-r border-wds-border')}>
        <span className={label}>NOT STARTED</span>
        <HighlightOnChange value={k.notStarted} className={cn(value, k.notStarted > 0 ? 'text-wds-warning-fg' : 'text-wds-text-ink')} />
        <span className={sub}>{k.notStartedDetail}</span>
      </div>
      <div className={cell}>
        <span className={label}>YESTERDAY</span>
        {!y ? (
          <>
            <span className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-faint">—</span>
            <span className={sub}>no day recorded</span>
          </>
        ) : y.status === 'CLOSED' ? (
          <>
            <span className="font-wds-sans text-[16px]/5 font-semibold text-wds-text-ink">Closed</span>
            <Link href={`/app/branch/day/document/${y.id}`} className="w-max font-wds-sans text-wds-mono-sm text-wds-primary underline decoration-1 underline-offset-[3px] outline-none focus-visible:shadow-wds-ring">
              signed {y.closedAt ? formatClock(y.closedAt) : ''} by {y.closedBy ? shortName(y.closedBy.name) : ''}
            </Link>
          </>
        ) : (
          <>
            <span className="font-wds-sans text-[16px]/5 font-semibold text-wds-warning-fg">Not closed</span>
            <span className={sub}>left open</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ rail */

export function StatusLabel({ status }: { status: DepartmentDaySummary['status'] }) {
  const copy = DEPARTMENT_STATUS_COPY[status];
  return (
    <span className="flex shrink-0 items-center gap-[5px]">
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[copy.tone])} aria-hidden />
      <span className={cn('font-wds-mono text-wds-mono-sm', TONE_TEXT[copy.tone])}>{copy.label}</span>
    </span>
  );
}

export function DepartmentRailRow({
  department,
  selected,
  onSelect,
  mobile = false,
}: {
  department: DepartmentDaySummary;
  selected: boolean;
  onSelect: () => void;
  mobile?: boolean;
}) {
  const blocked = department.status === 'BLOCKED';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cn(
        'group/row flex w-full flex-col gap-1 border-b border-wds-border text-left outline-none transition-colors duration-150 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]',
        mobile ? 'px-4 py-3.5' : 'border-l-[3px] px-[17px] py-3.5',
        selected ? (mobile ? 'border-l-[3px] border-l-wds-error-fg bg-wds-neutral-100 pl-[13px]' : 'border-l-wds-espresso-700 bg-wds-neutral-100') : cn(!mobile && 'border-l-transparent', 'hover:bg-wds-neutral-100'),
        selected && mobile && !blocked && 'border-l-wds-espresso-700',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn('font-wds-sans text-wds-text-ink', mobile ? 'text-wds-section font-semibold' : 'text-wds-body', !mobile && (selected || blocked ? 'font-semibold' : 'font-medium'))}>{department.name}</span>
        <StatusLabel status={department.status} />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-wds-sans text-wds-caption text-wds-text-copy-muted">{railDetail(department, formatClock, shortName)}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0 -translate-x-0.5 opacity-0 transition-[opacity,transform] duration-150 group-hover/row:translate-x-0 group-hover/row:opacity-100 motion-reduce:transition-none">
          <path d="M9 6l6 6-6 6" fill="none" stroke="var(--wds-text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- footer */

export interface DayFooterProps {
  today: BranchDayToday;
  onSign: () => void;
  onReopen: () => void;
  mobile?: boolean;
}

/** The rail footer (`19C8-0` blocked · `1EE4-0` ready · `1EJY-0` closed): message + the one action that fits the day's state. */
export function DayFooter({ today, onSign, onReopen, mobile = false }: DayFooterProps) {
  const closed = today.status === 'CLOSED';
  const wrap = cn('flex shrink-0 flex-col gap-2 border-t border-wds-border', mobile ? 'bg-wds-surface px-4 pb-6 pt-3' : 'bg-wds-neutral-50 px-5 py-4');
  const btn = mobile ? 'h-[52px] w-full rounded-[4px] text-wds-section' : 'h-10 w-full text-wds-body';

  if (closed) {
    return (
      <div className={wrap}>
        <p className="font-wds-sans text-wds-caption text-wds-text-copy-muted">
          Closed {today.closedAt ? formatClock(today.closedAt) : ''} · signed by {today.closedBy?.name ?? '—'}, PIN verified
        </p>
        <Button asChild variant="secondary" className={btn}>
          <Link href={`/app/branch/day/document/${today.id}`}>View signed document</Link>
        </Button>
        <Button variant="secondary" className={btn} onClick={onReopen}>
          Reopen day
        </Button>
      </div>
    );
  }

  const blockedText = blockerSummary(today.closeBlockers, today.departments);
  const summary = today.canClose ? `All ${today.departments.length} counted · every gap over KES ${today.reasonRequiredKes.toLocaleString('en-US')} has a reason.` : blockedText;
  return (
    <div className={wrap}>
      <p className={cn('font-wds-sans text-wds-caption', today.canClose ? 'text-wds-success-fg' : 'text-wds-warning-fg')} aria-live="polite">
        {summary}
      </p>
      {today.canClose ? (
        <Button className={btn} onClick={onSign}>
          Sign &amp; close day
        </Button>
      ) : (
        <HintTooltip hint={blockedText || 'Finish counting every department first'} side="top" className="flex w-full">
          {(describedBy) => (
            <button
              type="button"
              aria-disabled="true"
              aria-describedby={describedBy}
              onClick={(e) => e.preventDefault()}
              className={cn(btn, 'cursor-not-allowed bg-wds-neutral-300 font-wds-sans font-medium text-wds-text-faint outline-none focus-visible:shadow-wds-ring', mobile ? 'bg-wds-neutral-200' : 'rounded-wds-sm')}
            >
              Sign &amp; close day
            </button>
          )}
        </HintTooltip>
      )}
    </div>
  );
}
