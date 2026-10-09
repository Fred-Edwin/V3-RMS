'use client';

import * as React from 'react';

import { cn } from '@/lib/cn';
import { MonoLabel, StatusChip } from '../../../requisitions/components/req-parts';
import type { Chip } from '../../../requisitions/_shared/lib/requisitions-words';

/**
 * The card under the tracker (Paper D13, D14, E1, E2, E3): "NEXT STEP", a title, a body, and the one main button on the right. A
 * 3px edge: caramel while someone has to act, green when it is settled, neutral otherwise. Values from D13: 760px text column,
 * 20px padding, 18/24 title, 14/20 body.
 */
export function NextStepCard({ eyebrow = 'Next step', title, body, tone, action, children }: { eyebrow?: string; title: string; body: string; tone: 'amber' | 'green' | 'neutral'; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section aria-label={eyebrow} className={cn('flex flex-col items-stretch justify-between gap-5 border border-wds-border-strong bg-wds-surface py-5 pl-6 pr-6 sm:flex-row sm:items-center sm:gap-8', 'border-l-[3px]', tone === 'green' ? 'border-l-wds-success-fg' : tone === 'amber' ? 'border-l-wds-caramel-500' : 'border-l-wds-border-strong')}>
      <div className="flex max-w-[760px] flex-col gap-1.5">
        <MonoLabel>{eyebrow}</MonoLabel>
        <h2 className="font-wds-sans text-[18px] font-semibold leading-6 tracking-[-0.01em] text-wds-text-ink">{title}</h2>
        <p className="font-wds-sans text-[14px] leading-5 text-wds-text-secondary">{body}</p>
        {children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </section>
  );
}

/** Title, chip and the sub-line of a file (Paper D13: 24/30 title, the chip beside it, a 13/18 line beneath). */
export function FileHeader({ title, chip, subline, actions }: { title: string; chip: Chip; subline: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-wds-sans text-wds-mobile-title tracking-[-0.01em] text-wds-text-ink">{title}</h1>
          <StatusChip chip={chip} />
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1.5 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{subline}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A mono-labelled block with a heavy top rule, the "THE GAP" and "WHO HANDLED IT" headings of D14. */
export function RuledBlock({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn('flex min-w-0 flex-col', className)}>
      <MonoLabel className="pb-3">{label}</MonoLabel>
      <div className="border-t border-wds-neutral-950">{children}</div>
    </section>
  );
}

export function RuledRow({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'amber' | 'green' }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-wds-border px-1 py-[17px]', tone === 'amber' && 'bg-wds-warning-bg px-3', tone === 'green' && 'bg-wds-success-bg px-3')}>
      <span className={cn('font-wds-sans text-[15px] leading-5', tone ? 'font-medium text-wds-text-ink' : 'text-wds-text-secondary')}>{label}</span>
      <span className={cn('text-right font-wds-sans text-[15px] leading-5', tone === 'amber' ? 'font-mono font-semibold text-wds-warning-fg' : tone === 'green' ? 'font-semibold text-wds-success-fg' : 'text-wds-text-ink')}>{children}</span>
    </div>
  );
}
