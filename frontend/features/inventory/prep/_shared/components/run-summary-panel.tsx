import * as React from 'react';

import { cn } from '@/lib/cn';
import { formatQuantity } from '../lib/prep-format';
import type { CheckResult } from '../types/prep-contract';

/**
 * RunSummaryPanel: what this run adds up to. One component, two homes (plan §6): the "Confirm this run" bottom sheet on a phone
 * (`6XV-0`, rows only) and the live "This run" side panel at tablet width and up (`1UF2-0`, with the expected-for-this-size box).
 * It only shows figures; the screen owns the Confirm button and passes it as `children`.
 */
export interface SummaryLine {
  name: string;
  quantity: string;
  unit: string;
}

export interface RunSummaryPanelProps {
  variant: 'sheet' | 'panel';
  made: SummaryLine;
  used: SummaryLine[];
  check: CheckResult | null;
  /** Manager roles with `prep.see_costs`: input cost and cost per unit. */
  showCost?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const line = (l: SummaryLine): string => `${l.name} ${formatQuantity(l.quantity)} ${l.unit}`;

const abs = (delta: string | null): string => (delta ?? '').replace(/^[−+-]/, '');

const comparedText = (check: CheckResult | null): { text: string; tone: 'success' | 'warning' | 'muted' } => {
  const vs = check?.vsUsual;
  if (!vs || vs.label === 'NO_BASIS') return { text: 'Nothing to compare with yet', tone: 'muted' };
  if (vs.label === 'ON_TARGET') return { text: 'On target', tone: 'success' };
  return { text: `${vs.label === 'LOW' ? 'Low' : 'High'} yield · ${vs.deltaAmount ?? ''}`.trim(), tone: 'warning' };
};

/** The green (on target), amber (off) or plain box above the facts: "about 76 portions" and how this run sits against it. */
function ExpectedBox({ made, check }: { made: SummaryLine; check: CheckResult | null }) {
  const vs = check?.vsUsual;
  const hasBasis = Boolean(check && check.expected.amount !== null);
  const off = vs?.label === 'LOW' || vs?.label === 'HIGH';
  const detail = !hasBasis
    ? 'No usual figure yet, so this run is not compared.'
    : vs && vs.label !== 'NO_BASIS'
      ? `You made ${formatQuantity(made.quantity)} · ${abs(vs.deltaAmount) === '0' || vs.label === 'ON_TARGET' ? 'on target' : `${abs(vs.deltaAmount)} ${vs.label === 'LOW' ? 'under' : 'over'}${off ? ', outside the usual range' : ', within the usual range'}`}`
      : 'Enter what you made to compare.';
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border px-wds-3 py-wds-2.5',
        !hasBasis ? 'border-wds-border bg-wds-neutral-50' : off ? 'border-wds-warning-border bg-wds-warning-bg' : 'border-wds-success-border bg-wds-success-bg'
      )}
    >
      <span className={cn('font-wds-mono text-[10px] uppercase leading-3 tracking-[0.06em]', !hasBasis ? 'text-wds-text-copy-muted' : off ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>Expected for this size</span>
      <span className="font-wds-sans text-[20px] font-medium leading-[26px] text-wds-text-ink">{hasBasis && check ? check.expected.text.replace(/, from past runs$/, '') : 'no usual yet'}</span>
      <span className={cn('font-wds-sans text-wds-caption', !hasBasis ? 'text-wds-text-copy-muted' : off ? 'text-wds-warning-fg' : 'text-wds-success-fg')}>{detail}</span>
    </div>
  );
}

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-wds-4 px-wds-3 py-wds-2.5', !last && 'border-b border-wds-neutral-100')}>
      <dt className="shrink-0 font-wds-sans text-wds-body-sm text-wds-text-copy-muted">{label}</dt>
      <dd className="min-w-0 text-right font-wds-sans text-wds-body-sm text-wds-text-ink">{children}</dd>
    </div>
  );
}

export function RunSummaryPanel({ variant, made, used, check, showCost = false, children, className }: RunSummaryPanelProps) {
  const compared = comparedText(check);
  const rows = (
    <dl className={cn(variant === 'sheet' ? 'border border-wds-border bg-wds-neutral-50' : 'border-t border-wds-text-ink')}>
      <Row label="Made">{`${made.name} · ${formatQuantity(made.quantity)} ${made.unit}`}</Row>
      <Row label="Used">{used.map(line).join(' · ')}</Row>
      <Row label="Compared with usual" last={!(showCost && check?.cost)}>
        <span className={cn('font-medium', compared.tone === 'success' && 'text-wds-success-fg', compared.tone === 'warning' && 'text-wds-warning-fg', compared.tone === 'muted' && 'font-normal text-wds-text-copy-muted')}>
          {compared.tone !== 'muted' ? <span aria-hidden>● </span> : null}
          {compared.text}
        </span>
      </Row>
      {showCost && check?.cost ? (
        <>
          <Row label="Input cost">
            <span className="font-wds-mono">KES {Number(check.cost.totalInput).toLocaleString('en-KE', { maximumFractionDigits: 0 })}</span>
          </Row>
          <Row label={`Cost per ${made.unit === 'portions' ? 'portion' : made.unit}`} last>
            <span className="font-wds-mono">{check.cost.perUnit !== null ? `KES ${Number(check.cost.perUnit).toLocaleString('en-KE', { maximumFractionDigits: 0 })}` : '—'}</span>
          </Row>
        </>
      ) : null}
    </dl>
  );

  if (variant === 'sheet') return <div className={className}>{rows}</div>;

  return (
    <section aria-label="This run" className={cn('border border-wds-border bg-wds-surface', className)}>
      <h2 className="border-b border-wds-border px-wds-4 py-wds-3.5 font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">This run</h2>
      <div className="flex flex-col gap-wds-4 p-wds-4">
        <ExpectedBox made={made} check={check} />
        {rows}
        {children}
      </div>
    </section>
  );
}
