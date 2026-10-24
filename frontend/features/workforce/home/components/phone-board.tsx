'use client';

import { cn } from '@/lib/cn';

import { FOCUS_RING, type WorkforceKpiCell } from '../../_shared';
import type { DepartmentCountRow } from '../../attendance';

const heading = 'm-0 flex items-baseline gap-2 border-b-2 border-wds-text-ink pb-2 font-wds-sans text-[18px] font-semibold leading-6 text-wds-text-ink';

/** The four numbers as 2 x 2 cards (Paper 2.4). Late and not in read red-brown, the rest ink; the top edge follows. */
export function PhoneKpis({ cells }: { cells: readonly WorkforceKpiCell[] }) {
  return (
    <div role="group" aria-label="The branch today" className="grid grid-cols-2 gap-3">
      {cells.map((c) => {
        const bad = c.key === 'late' || c.key === 'not-in';
        const active = bad && c.value !== '0' && c.tone !== 'muted';
        return (
          <div key={c.key} className={cn('flex min-h-[110px] min-w-0 flex-col gap-1 border border-wds-border border-t-2 bg-wds-surface px-4 py-3', active ? 'border-t-wds-error-fg' : 'border-t-wds-caramel-500')}>
            <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{c.label}</span>
            <span className={cn('font-wds-sans text-[28px] font-semibold leading-8 tracking-[-0.025em]', c.tone === 'muted' ? 'text-wds-text-faint' : active ? 'text-wds-error-fg' : 'text-wds-text-ink')}>{c.value}</span>
            {c.detail ? <span className={cn('font-wds-sans text-[13px] leading-[17px]', active ? 'text-wds-error-fg' : 'text-wds-text-secondary')}>{c.detail}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export interface PhoneLookRow {
  key: string;
  name: string;
  /** "Not in · due 06:00 · Service". */
  status: string;
  tone: 'error' | 'warning';
  /** The one button, 44 px tall, only when the viewer may use it. */
  action?: { label: string; onClick: () => void };
  onOpen: () => void;
}

/** "Needs a look 4 · not in and late first" as stacked cards with a coloured left edge. A card opens the person; its button is 44 px. */
export function PhoneNeedsALook({ rows }: { rows: readonly PhoneLookRow[] }) {
  return (
    <section aria-label="Needs a look" className="flex flex-col gap-3">
      <h2 className={heading}>
        Needs a look
        <span className="font-wds-sans text-[14px] font-normal leading-[18px] text-wds-text-secondary">
          {rows.length} · not in and late first
        </span>
      </h2>
      {rows.length === 0 ? <p className="m-0 font-wds-sans text-[14px] leading-5 text-wds-text-secondary">Nobody needs a look right now.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li key={row.key} className={cn('flex flex-col gap-3 border border-wds-border border-l-[3px] bg-wds-surface px-4 py-3', row.tone === 'error' ? 'border-l-wds-error-fg' : 'border-l-wds-caramel-600')}>
            <button type="button" onClick={row.onOpen} aria-label={`Open ${row.name}`} className={cn('flex min-h-11 flex-col justify-center gap-0.5 text-left', FOCUS_RING)}>
              <span className="font-wds-sans text-[16px] font-semibold leading-[22px] text-wds-text-ink">{row.name}</span>
              <span className={cn('font-wds-sans text-[13px] leading-4', row.tone === 'error' ? 'text-wds-error-fg' : 'text-wds-warning-fg')}>{row.status}</span>
            </button>
            {row.action ? (
              <button
                type="button"
                onClick={row.action.onClick}
                aria-label={`${row.action.label}: ${row.name}`}
                className={cn('flex min-h-11 w-full items-center justify-center border border-wds-border-strong bg-wds-surface font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink', FOCUS_RING)}
              >
                {row.action.label}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "By department" for the phone: the name and the head's line on the left, in over expected at the right. */
export function PhoneDepartments({ rows }: { rows: readonly DepartmentCountRow[] }) {
  return (
    <section aria-label="By department" className="flex flex-col gap-3">
      <h2 className={heading}>By department</h2>
      <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 border-b border-wds-border px-4 py-2.5 last:border-b-0">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-wds-sans text-[15px] font-medium leading-5 text-wds-text-ink">{row.name}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{row.note}</span>
            </div>
            <span className={cn('shrink-0 font-wds-mono text-[14px] leading-5', row.problem ? 'text-wds-warning-fg' : 'text-wds-text-ink')}>{row.ratio}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
