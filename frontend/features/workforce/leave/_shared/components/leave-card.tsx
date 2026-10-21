import { cn } from '@/lib/cn';

import { TONE_FILL } from '../lib/leave-copy';
import type { TypeBalance } from '../types/leave-types';

/** The 8 px track and fill of a card (Step 2). Width is left ÷ the year's days; a type with no yearly figure draws no bar. */
export function LeaveBar({ left, perYear, tone }: { left: number; perYear: number | null; tone: TypeBalance['tone'] }) {
  if (!perYear || tone === 'NONE') return null;
  const share = Math.max(0, Math.min(1, left / perYear));
  return (
    <div aria-hidden className="h-2 w-full bg-wds-border">
      <div className={cn('h-2', TONE_FILL[tone])} style={{ width: `${Math.round(share * 100)}%` }} />
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">{label}</span>
      <span className={cn('font-wds-mono text-[22px] leading-[26px] text-wds-text-ink', strong && 'font-semibold')}>{value}</span>
    </div>
  );
}

/** One leave type on the Leave home: name, days a year, the bar and LEFT, TAKEN, BOOKED. Not a button. */
export function LeaveCard({ card }: { card: TypeBalance }) {
  return (
    <section role="group" aria-label={card.spoken} className="flex flex-col gap-3 border border-wds-border bg-wds-surface p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-wds-sans text-[14px] font-semibold leading-[18px] text-wds-text-ink">{card.label}</h2>
        <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{card.perYear ? `${card.perYear} days a year` : 'No limit'}</span>
      </div>
      <LeaveBar left={card.left} perYear={card.perYear} tone={card.tone} />
      <div className="flex gap-3.5">
        <Figure label="LEFT" value={card.left} strong />
        <Figure label="TAKEN" value={card.taken} />
        <Figure label="BOOKED" value={card.booked} />
      </div>
      {card.builds ? <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{`Builds up ${card.builds.perMonth} days a month`}</p> : null}
    </section>
  );
}

/** The three bar colours, once, under the cards. Colour is never the only signal: the figures carry the same facts. */
export function LeaveLegend() {
  const items: { cls: string; label: string }[] = [
    { cls: 'bg-wds-success-fg', label: 'Plenty left' },
    { cls: 'bg-wds-caramel-600', label: 'Under half' },
    { cls: 'bg-wds-error-fg', label: 'Under a quarter' },
  ];
  return (
    <ul aria-hidden className="m-0 flex list-none flex-wrap gap-3.5 p-0">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 font-wds-sans text-[11px] leading-[14px] text-wds-neutral-600">
          <span className={cn('h-2 w-2', i.cls)} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
