import * as React from 'react';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../lib/style/interaction';

/**
 * Workforce KPI strip — the approved Catalog strip (Paper QX1-0 / SUY-0):
 * one bordered band with a soft white-to-grey fill; each cell has a 10 px mono
 * caption, a 30 px semibold number and a 12 px grey line. A cell you can act on
 * gets a 2 px warning top border, a warning-coloured number and an arrow.
 *
 * Words come in as props; nothing here knows a role.
 */
export interface WorkforceKpiCell {
  key: string;
  /** Caption, written in capitals by the screen's copy ("NEEDS FINISHING"). */
  label: string;
  value: string;
  /** The grey line under the number. */
  detail?: string;
  /** Marks the cell as something to act on. Gives the warning edge, number and arrow. */
  actionable?: boolean;
  /** Makes the actionable cell a button. */
  onSelect?: () => void;
  /** `success` is the green "done" cell (a month approved): green fill, green top edge, green words. */
  tone?: 'success';
}

export interface WorkforceKpiStripProps {
  cells: WorkforceKpiCell[];
  className?: string;
  'aria-label'?: string;
}

function Cell({ cell, last }: { cell: WorkforceKpiCell; last: boolean }) {
  const body = (
    <>
      <span className="flex items-start justify-between">
        <span className={cn('font-wds-mono text-[10px] leading-3 tracking-[0.06em]', cell.tone === 'success' ? 'text-wds-success-fg' : cell.actionable ? 'text-wds-warning-fg' : 'text-wds-text-secondary')}>
          {cell.label}
        </span>
        {cell.actionable ? (
          <span aria-hidden className="font-wds-sans text-[12px] leading-3 text-wds-text-faint">
            →
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'font-wds-sans text-[30px] font-semibold leading-[34px] tracking-[-0.025em]',
          cell.tone === 'success' ? 'text-wds-success-fg' : cell.actionable ? 'text-wds-warning-fg' : 'text-wds-text-ink'
        )}
      >
        {cell.value}
      </span>
      {cell.detail ? (
        <span className={cn('font-wds-sans text-[12px] leading-4', cell.tone === 'success' ? 'text-wds-success-fg' : 'text-wds-text-secondary')}>{cell.detail}</span>
      ) : null}
    </>
  );

  const base = cn(
    'flex min-w-0 flex-1 flex-col gap-1.5 border-t-2 px-5 py-4 text-left',
    cell.tone === 'success' ? 'border-t-wds-success-fg bg-wds-success-bg' : cell.actionable ? 'border-t-wds-warning-fg bg-wds-caramel-100' : 'border-t-transparent',
    !last && 'border-r border-r-wds-border'
  );

  if (cell.actionable && cell.onSelect) {
    return (
      <button
        type="button"
        onClick={cell.onSelect}
        className={cn(base, MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'), 'focus-visible:relative')}
      >
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}

export function WorkforceKpiStrip({ cells, className, ...rest }: WorkforceKpiStripProps) {
  return (
    <div
      role="group"
      aria-label={rest['aria-label']}
      className={cn(
        'flex w-full flex-col border border-wds-border bg-wds-gradient-surface-raise sm:flex-row',
        // On a phone the cells stack and get a hairline between them instead of a wall.
        '[&>*:not(:last-child)]:max-sm:border-b [&>*:not(:last-child)]:max-sm:border-b-wds-border [&>*]:max-sm:border-r-0',
        className
      )}
    >
      {cells.map((cell, i) => (
        <Cell key={cell.key} cell={cell} last={i === cells.length - 1} />
      ))}
    </div>
  );
}
