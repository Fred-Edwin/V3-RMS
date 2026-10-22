import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import type { HomeKpi } from '../types/role-home-types';

/**
 * The number cards (Paper 1.1 to 1.11): one bordered band, a 2 px rule on top of each cell in the colour of its tone. The number is
 * ink when nothing is asked of the person, amber when something needs acting on, red-brown for a real problem (the server sets `tone`).
 * A card with a link is a link. Five across on a desktop; two across on a phone, with an odd last card spanning both.
 */
const TOP: Record<HomeKpi['tone'], string> = { normal: 'border-t-wds-espresso-700', attention: 'border-t-wds-warning-fg', problem: 'border-t-wds-error-fg' };
const NUMBER: Record<HomeKpi['tone'], string> = { normal: 'text-wds-text-ink', attention: 'text-wds-warning-fg', problem: 'text-wds-error-fg' };
const DETAIL: Record<HomeKpi['tone'], string> = { normal: 'text-wds-text-secondary', attention: 'text-wds-text-secondary', problem: 'text-wds-error-fg' };

function Cell({ kpi, className }: { kpi: HomeKpi; className?: string }) {
  const body = (
    <>
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{kpi.label.toUpperCase()}</span>
      <span className={cn('font-wds-sans text-[30px] font-semibold leading-[34px] tracking-[-0.025em]', NUMBER[kpi.tone])}>{kpi.value}</span>
      <span className={cn('font-wds-sans text-[12px] leading-4', DETAIL[kpi.tone])}>{kpi.detail}</span>
    </>
  );
  const base = cn('flex min-w-0 flex-col gap-1.5 border-t-2 px-5 py-4 text-left', TOP[kpi.tone], className);
  return kpi.href ? (
    <Link href={kpi.href} className={cn(base, MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'), 'focus-visible:relative')}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export function HomeKpiCards({ kpis, phone = false, className }: { kpis: readonly HomeKpi[]; phone?: boolean; className?: string }) {
  if (kpis.length === 0) return null;
  const odd = kpis.length % 2 === 1;
  return (
    <section
      aria-label="The numbers"
      className={cn('grid border border-wds-border bg-wds-surface', phone ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 xl:[grid-template-columns:repeat(var(--cards),minmax(0,1fr))]', className)}
      style={{ ['--cards' as string]: Math.min(kpis.length, 5) }}
    >
      {kpis.map((kpi, i) => (
        <Cell
          key={kpi.key}
          kpi={kpi}
          className={cn('border-r border-r-wds-border last:border-r-0', phone && odd && i === kpis.length - 1 && 'col-span-2')}
        />
      ))}
    </section>
  );
}
