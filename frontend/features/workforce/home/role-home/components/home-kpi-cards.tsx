import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import type { HomeKpi } from '../types/role-home-types';

/**
 * The number cards (Paper 1.1 to 1.11). On a desktop one bordered band with a 2 px rule on top of each cell in the colour of its tone;
 * on a phone separate cards, two across with an 8 px gap, an odd last card spanning both. The number is ink when nothing is asked of the
 * person, amber when something needs acting on, red-brown for a real problem (the server sets `tone`). A card with a link is a link.
 */
const TOP: Record<HomeKpi['tone'], string> = { normal: 'border-t-wds-espresso-700', attention: 'border-t-wds-warning-fg', problem: 'border-t-wds-error-fg' };
const NUMBER: Record<HomeKpi['tone'], string> = { normal: 'text-wds-text-ink', attention: 'text-wds-warning-fg', problem: 'text-wds-error-fg' };
const DETAIL: Record<HomeKpi['tone'], string> = { normal: 'text-wds-text-secondary', attention: 'text-wds-text-secondary', problem: 'text-wds-error-fg' };

function Cell({ kpi, phone, className }: { kpi: HomeKpi; phone: boolean; className?: string }) {
  const body = (
    <>
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{kpi.label.toUpperCase()}</span>
      <span className={cn('font-wds-sans font-semibold tracking-[-0.025em]', phone ? 'text-[26px] leading-[30px]' : 'text-[30px] leading-[34px]', NUMBER[kpi.tone])}>{kpi.value}</span>
      <span className={cn('font-wds-sans text-[12px] leading-4', DETAIL[kpi.tone])}>{kpi.detail}</span>
    </>
  );
  const base = cn(
    'flex min-w-0 flex-col border-t-2 text-left',
    phone ? 'gap-1 border border-t-2 border-wds-border bg-wds-surface px-3.5 py-3' : 'gap-1.5 px-5 py-4',
    TOP[kpi.tone],
    className,
  );
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
      className={cn(
        'grid',
        phone ? 'grid-cols-2 gap-2' : 'grid-cols-2 border border-wds-border bg-wds-surface md:grid-cols-3 xl:[grid-template-columns:repeat(var(--cards),minmax(0,1fr))]',
        className,
      )}
      style={{ ['--cards' as string]: Math.min(kpis.length, 5) }}
    >
      {kpis.map((kpi, i) => (
        <Cell key={kpi.key} kpi={kpi} phone={phone} className={cn(!phone && 'border-r border-r-wds-border last:border-r-0', phone && odd && i === kpis.length - 1 && 'col-span-2')} />
      ))}
    </section>
  );
}
