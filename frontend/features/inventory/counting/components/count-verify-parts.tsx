'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import type { CountKind, CountListItem, CountReasonValue, VerifierCountLine } from '../types/count';
import { CountReasonControl } from './count-reason';
import { formatClock, formatCountDateShort, formatQty, formatSignedKes, formatVariance, shortName } from '../../_shared/components/stock-format';

/* ------------------------------------------------------------------ shared */

export function StatusDot({ tone }: { tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }) {
  const cls = {
    success: 'bg-wds-success-fg',
    warning: 'bg-wds-warning-fg',
    error: 'bg-wds-error-fg',
    info: 'bg-wds-info-fg',
    neutral: 'bg-wds-neutral-400',
  }[tone];
  return <span className={cn('size-[5px] shrink-0 rounded-full', cls)} aria-hidden />;
}

/**
 * Height transition for the reason control (`§4.3`): mounts collapsed and
 * opens on the next frame via a grid-rows transition (no layout-property
 * animation on scroll; instant under reduced motion).
 */
export function Reveal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** A queried line stays a "variance line" while its recount is pending (its count is cleared server-side). */
export const lineHasVariance = (l: VerifierCountLine): boolean =>
  l.decision === 'QUERIED' || (l.variance !== null && Number.parseFloat(l.variance) !== 0);

/** The figure to show as "counted": the recount, or — while a recount is pending — the first count. */
export function countedFigure(l: VerifierCountLine): { qty: string | null; pending: boolean } {
  if (l.countedQty !== null) return { qty: l.countedQty, pending: false };
  return { qty: l.firstCountedQty, pending: l.firstCountedQty !== null };
}

/** Variance judged on {@link countedFigure} (the server's is null while the recount is pending). */
export function varianceFigure(l: VerifierCountLine): string | null {
  if (l.variance !== null) return l.variance;
  const { qty } = countedFigure(l);
  if (qty === null || l.expectedQty === null) return null;
  return String(Number.parseFloat(qty) - Number.parseFloat(l.expectedQty));
}

/** Paper: a variance above the threshold reads red and bold, the rest amber. */
export const varianceTone = (l: VerifierCountLine): 'error' | 'warning' => (l.reasonRequired ? 'error' : 'warning');

export function VarianceCell({ line, className }: { line: VerifierCountLine; className?: string }) {
  const variance = varianceFigure(line);
  if (variance === null || Number.parseFloat(variance) === 0) return <span className={cn('font-wds-mono text-[13px]/4 text-wds-text-faint', className)}>—</span>;
  const tone = varianceTone(line);
  return (
    <span className={cn('flex items-center justify-end gap-[5px]', className)}>
      <StatusDot tone={tone} />
      <span className={cn('font-wds-mono text-[13px]/4', tone === 'error' ? 'font-semibold text-wds-error-fg' : 'text-wds-warning-fg')}>
        {formatVariance(variance, line.reasonRequired ? line.usageUnit : '')}
      </span>
    </span>
  );
}

/* --------------------------------------------------------------- rail rows */

export function countStatusCopy(c: CountListItem): { label: string; tone: 'warning' | 'success' | 'info' } {
  if (c.status === 'SUBMITTED') return { label: 'awaiting verify', tone: 'warning' };
  if (c.status === 'RETURNED') return { label: 'sent back', tone: 'info' };
  return { label: 'verified', tone: 'success' };
}

export function countRailDetail(c: CountListItem): string {
  if (c.kind === 'SPOT') {
    return `${c.itemCount} ${c.itemCount === 1 ? 'item' : 'items'} · signed ${shortName(c.verifierName ?? c.counterName)}`;
  }
  if (c.status === 'SUBMITTED') {
    return `Submitted ${c.counterSignedAt ? formatClock(c.counterSignedAt) : ''} by ${shortName(c.counterName)} · blind · ${c.itemCount} items`;
  }
  if (c.status === 'RETURNED') return `Sent back to ${shortName(c.counterName)} for a recount`;
  return `Counter ${shortName(c.counterName)} · verifier ${shortName(c.verifierName ?? '')}${c.itemCount ? ` · ${c.itemCount} items` : ''}`;
}

export const countRailTitle = (kind: CountKind, date: string): string => `${kind === 'SPOT' ? 'Spot count' : 'Daily count'} · ${formatCountDateShort(date)}`;

export function CountRailRow({
  count,
  selected,
  onSelect,
  mobile = false,
}: {
  count: CountListItem;
  selected: boolean;
  onSelect: () => void;
  mobile?: boolean;
}) {
  const status = countStatusCopy(count);
  const toneText = { warning: 'text-wds-warning-fg', success: 'text-wds-success-fg', info: 'text-wds-info-fg' }[status.tone];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected || undefined}
      className={cn(
        'group/row flex w-full flex-col gap-1 border-b border-wds-border text-left outline-none transition-colors duration-150 focus-visible:shadow-[inset_2px_0_0_var(--wds-primary)]',
        mobile ? 'px-4 py-3.5' : 'px-5 py-3.5',
        selected ? 'bg-wds-neutral-100' : 'hover:bg-wds-neutral-100',
        mobile && selected && 'border-l-[3px] border-l-wds-espresso-700 pl-[13px]',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn('font-wds-sans text-wds-text-ink', mobile ? 'text-[15px]/[18px]' : 'text-[14px]/[18px]', selected ? 'font-semibold' : 'font-medium')}>
          {countRailTitle(count.kind, count.countDate)}
        </span>
        <span className="flex items-center gap-[5px]">
          {status.tone !== 'warning' ? <StatusDot tone={status.tone} /> : null}
          <span className={cn('font-wds-mono text-[11px]/[14px]', toneText)}>{status.label}</span>
        </span>
      </span>
      <span className="font-wds-sans text-[12px]/4 text-wds-text-copy-muted">{countRailDetail(count)}</span>
    </button>
  );
}

/* ----------------------------------------------------------- desktop rows */

export interface LineHandlers {
  onAccept: (line: VerifierCountLine) => void;
  onQuery: (line: VerifierCountLine) => void;
  onUndo: (line: VerifierCountLine) => void;
  onReason: (line: VerifierCountLine, reason: CountReasonValue, note: string | null) => void;
  onQueryNote: (line: VerifierCountLine, note: string) => void;
}

const actionBtn =
  'touch-manipulation rounded-wds-sm border border-wds-border-strong font-wds-sans text-[12px]/4 text-wds-text-copy-muted outline-none transition-[transform,background-color,border-color,color] duration-150 ease-out hover:bg-wds-neutral-50 hover:text-wds-text-ink focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60';

export function QueryNoteField({ line, onSave, mobile = false }: { line: VerifierCountLine; onSave: (note: string) => void; mobile?: boolean }) {
  const [value, setValue] = React.useState(line.queryNote ?? '');
  React.useEffect(() => setValue(line.queryNote ?? ''), [line.queryNote]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn('font-wds-sans text-[11px]/[14px] font-semibold text-wds-info-fg', mobile && 'uppercase')}>
        {mobile ? 'QUERY — sent with the recount' : 'QUERY — sent to the attendant with the recount'}
      </span>
      <input
        type="text"
        value={value}
        maxLength={500}
        placeholder="Optional note — never mention the expected figure…"
        aria-label={`Query note for ${line.name}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() !== (line.queryNote ?? '').trim()) onSave(value.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={cn(
          'border border-wds-border-strong bg-wds-surface font-wds-sans text-[13px]/4 text-wds-text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-wds-text-faint focus:border-wds-primary focus:shadow-wds-ring',
          mobile ? 'h-[38px] rounded-[4px] px-3' : 'h-[34px] max-w-[560px] rounded-wds-sm px-2.5',
        )}
      />
    </div>
  );
}

function needsReasonFlag(line: VerifierCountLine): boolean {
  return line.decision === 'ACCEPTED' && line.reasonRequired && (!line.reason || (line.reason === 'OTHER' && !(line.reasonNote ?? '').trim()));
}

export function VerifyLineRow({ line, editable, handlers, last }: { line: VerifierCountLine; editable: boolean; handlers: LineHandlers; last: boolean }) {
  const figure = countedFigure(line);
  const counted = figure.qty !== null;
  const variance = lineHasVariance(line);
  const showReason = editable && variance && line.reasonRequired && line.decision !== 'QUERIED';
  const showQueryNote = line.decision === 'QUERIED';
  return (
    <div className={cn('flex flex-col', !last && 'border-b border-wds-neutral-200')}>
      <div className="flex items-center gap-4 py-3">
        <span className="min-w-0 grow-[2] basis-0 truncate font-wds-sans text-[13px]/4 text-wds-text-ink">{line.name}</span>
        <span className="grow basis-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
          {figure.qty !== null ? formatQty(figure.qty, line.usageUnit) : '—'}
          {figure.pending ? <span className="block font-wds-sans text-[11px]/[14px] text-wds-text-faint">recount pending</span> : null}
          {!figure.pending && line.firstCountedQty !== null ? (
            <span className="block font-wds-sans text-[11px]/[14px] text-wds-text-faint">first count {formatQty(line.firstCountedQty, line.usageUnit)}</span>
          ) : null}
        </span>
        <span className="grow basis-0 text-right font-wds-mono text-[13px]/4 text-wds-text-copy-muted">
          {line.expectedQty !== null ? formatQty(line.expectedQty, line.usageUnit) : '—'}
        </span>
        <VarianceCell line={line} className="grow basis-0" />
        <span className="flex w-[220px] shrink-0 items-center justify-end gap-2">
          {!counted ? (
            <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">Not counted</span>
          ) : !variance ? (
            <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">No variance</span>
          ) : line.decision === 'QUERIED' ? (
            <>
              <span className="flex items-center gap-[5px] font-wds-sans text-[12px]/4 text-wds-info-fg">
                <StatusDot tone="info" />
                Queried
              </span>
              {editable ? (
                <button type="button" className={cn(actionBtn, 'px-2.5 py-1')} onClick={() => handlers.onUndo(line)}>
                  Undo
                </button>
              ) : null}
            </>
          ) : line.decision === 'ACCEPTED' ? (
            <>
              <span className="flex items-center gap-[5px] font-wds-sans text-[12px]/4 text-wds-success-fg">
                <StatusDot tone="success" />
                Accepted
              </span>
              {editable ? (
                <button type="button" className={cn(actionBtn, 'px-2.5 py-1')} onClick={() => handlers.onQuery(line)}>
                  Query
                </button>
              ) : null}
            </>
          ) : editable ? (
            <>
              <button type="button" className={cn(actionBtn, 'px-3 py-[5px]')} onClick={() => handlers.onAccept(line)}>
                Accept
              </button>
              <button type="button" className={cn(actionBtn, 'px-3 py-[5px]')} onClick={() => handlers.onQuery(line)}>
                Query
              </button>
            </>
          ) : (
            <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">Undecided</span>
          )}
        </span>
      </div>
      {showQueryNote ? (
        <Reveal>
          <div className="pb-3.5">
            {editable ? (
              <QueryNoteField line={line} onSave={(note) => handlers.onQueryNote(line, note)} />
            ) : line.queryNote ? (
              <p className="font-wds-sans text-[12px]/4 text-wds-info-fg">Query: {line.queryNote}</p>
            ) : null}
          </div>
        </Reveal>
      ) : null}
      {showReason ? (
        <Reveal>
          <div className="pb-3.5">
            <CountReasonControl
              reason={line.reason}
              note={line.reasonNote}
              label="REASON — REQUIRED (variance above threshold)"
              ariaLabel={`Reason for ${line.name}`}
              invalid={needsReasonFlag(line)}
              onChange={(reason, note) => handlers.onReason(line, reason, note)}
            />
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- mobile card */

export function VerifyLineCard({ line, editable, handlers }: { line: VerifierCountLine; editable: boolean; handlers: LineHandlers }) {
  const figure = countedFigure(line);
  const counted = figure.qty !== null;
  const variance = lineHasVariance(line);
  const showReason = editable && variance && line.reasonRequired && line.decision !== 'QUERIED';
  const statusRight = !counted ? (
    <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">Not counted</span>
  ) : !variance ? (
    <span className="font-wds-sans text-[12px]/4 text-wds-text-faint">No variance</span>
  ) : line.decision === 'ACCEPTED' ? (
    <span className="flex items-center gap-[5px] font-wds-sans text-[12px]/4 text-wds-success-fg">
      <StatusDot tone="success" />
      Accepted
    </span>
  ) : line.decision === 'QUERIED' || line.reasonRequired ? (
    <VarianceCell line={line} />
  ) : null;
  const cell = (label: string, value: React.ReactNode, tone = 'text-wds-text-ink') => (
    <span className="flex flex-col gap-0.5">
      <span className="font-wds-mono text-[10px]/3 uppercase text-wds-text-copy-muted">{label}</span>
      <span className={cn('font-wds-mono text-[13px]/4', tone)}>{value}</span>
    </span>
  );
  const btn = 'touch-manipulation rounded-[4px] border border-wds-border-strong font-wds-sans text-[12px]/4 text-wds-text-copy-muted outline-none transition-[transform,background-color] duration-150 ease-out focus-visible:shadow-wds-ring active:bg-wds-neutral-100 motion-safe:active:scale-[0.97]';
  return (
    <div className="flex flex-col gap-2.5 border-b border-wds-neutral-200 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-wds-sans text-[14px]/[18px] font-medium text-wds-text-ink">{line.name}</span>
        {statusRight}
      </div>
      <div className="flex gap-4">
        {cell('Counted', counted ? `${formatQty(figure.qty as string, line.usageUnit)}${figure.pending ? ' · recount pending' : ''}` : '—')}
        {cell('Expected', line.expectedQty !== null ? formatQty(line.expectedQty, line.usageUnit) : '—', 'text-wds-text-copy-muted')}
        {variance && varianceFigure(line) !== null && !(line.decision === 'PENDING' && line.reasonRequired)
          ? cell('Variance', formatVariance(varianceFigure(line) as string, line.reasonRequired ? line.usageUnit : ''), line.reasonRequired ? 'text-wds-error-fg font-semibold' : 'text-wds-warning-fg')
          : null}
      </div>
      {line.decision === 'QUERIED' ? (
        <Reveal>
          <div className="flex flex-col gap-2.5">
            {editable ? <QueryNoteField line={line} mobile onSave={(note) => handlers.onQueryNote(line, note)} /> : line.queryNote ? <p className="font-wds-sans text-[12px]/4 text-wds-info-fg">Query: {line.queryNote}</p> : null}
          </div>
        </Reveal>
      ) : null}
      {showReason ? (
        <Reveal>
          <CountReasonControl
            mobile
            reason={line.reason}
            note={line.reasonNote}
            label="REASON — REQUIRED (above threshold)"
            ariaLabel={`Reason for ${line.name}`}
            invalid={needsReasonFlag(line)}
            onChange={(reason, note) => handlers.onReason(line, reason, note)}
          />
        </Reveal>
      ) : null}
      {editable && counted && variance ? (
        <div className="flex justify-end gap-2">
          {line.decision === 'QUERIED' ? (
            <>
              <span className="flex items-center gap-[5px] pr-1 font-wds-sans text-[12px]/4 text-wds-info-fg">
                <StatusDot tone="info" />
                Queried
              </span>
              <button type="button" className={cn(btn, 'px-4 py-2')} onClick={() => handlers.onUndo(line)}>
                Undo
              </button>
            </>
          ) : (
            <>
              <button type="button" className={cn(btn, 'px-4 py-2')} onClick={() => handlers.onQuery(line)}>
                Query
              </button>
              {line.decision !== 'ACCEPTED' ? (
                <button type="button" className={cn(btn, 'px-4 py-2')} onClick={() => handlers.onAccept(line)}>
                  Accept
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ stats */

export function StatCell({
  label,
  value,
  tone,
  last,
  size = 'sm',
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  last?: boolean;
  /** `sm` = the awaiting strip (18/22); `lg` = the verified record (28/34, `18GE-0`); `md` = its 24/30 net figure; `text` = the sans "No". */
  size?: 'sm' | 'md' | 'lg' | 'text';
  /** Mobile: 12px side padding, 16/20 values (`1C47-0`). */
  compact?: boolean;
}) {
  const big = size !== 'sm';
  const valueCls = {
    sm: compact ? 'font-wds-mono text-[16px]/5 font-medium' : 'font-wds-mono text-[18px]/[22px] font-medium',
    md: 'font-wds-mono text-[24px]/[30px] font-medium',
    lg: 'font-wds-mono text-[28px]/[34px] font-medium',
    text: 'font-wds-sans text-[20px]/6 font-medium',
  }[size];
  return (
    <div
      className={cn(
        'flex grow basis-0 flex-col justify-center',
        compact ? 'min-w-0 gap-1 px-3 py-3' : 'px-5',
        !compact && (big ? 'gap-1.5 border-wds-neutral-800 py-3' : 'h-[52px] items-baseline gap-[5px]'),
        !last && (big ? 'border-r' : 'border-r border-wds-border'),
      )}
    >
      <span className="w-max font-wds-mono text-[10px]/3 uppercase tracking-[0.04em] text-wds-text-copy-muted">{label}</span>
      <span className={cn(valueCls, tone ?? 'text-wds-text-ink')}>{value}</span>
    </div>
  );
}

export { formatSignedKes, Link };
