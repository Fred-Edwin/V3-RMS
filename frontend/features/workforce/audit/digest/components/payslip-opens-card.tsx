'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, Panel, nameAndRole, onHover } from '../../../_shared';
import { DIGEST_COPY, countWords, dayHeading, logLink, nairobiDay, spanWords, type DigestDay } from '../lib/digest';

/**
 * Payslip openings (6a A9): the Director's card on Home, last 7 days by day, one row per opener with the count and the time span. A row
 * opens the Audit log on that opener and that day, where the Director reads which payslip. Counts and times only; never an amount, never
 * a name of the person whose payslip it was. A week with nothing is not drawn (the Home leaves out an empty card).
 */
export function PayslipOpensCard({ days }: { days: readonly DigestDay[] }) {
  const today = nairobiDay(new Date());
  return (
    <Panel title={DIGEST_COPY.title} padded={false}>
      <p className="m-0 border-b border-wds-neutral-100 px-[18px] py-2.5 font-wds-sans text-[12px] leading-[18px] text-wds-text-secondary">{DIGEST_COPY.subtitle}</p>
      <div className="flex flex-col">
        {days.map((d) => (
          <section key={d.day} aria-label={dayHeading(d.day, today)} className="flex flex-col">
            <h4 className="m-0 px-[18px] pb-1 pt-3 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.08em] text-wds-text-secondary">{dayHeading(d.day, today)}</h4>
            <ul className="m-0 flex list-none flex-col p-0">
              {d.rows.map((row) => {
                const span = spanWords(row.firstAt, row.lastAt);
                return (
                  <li key={`${row.openerId}:${row.day}`}>
                    <Link href={logLink(row)} className={cn('flex items-start justify-between gap-3 border-t border-wds-neutral-100 px-[18px] py-2.5', MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
                      <span className="min-w-0 font-wds-sans text-[13px] leading-4 text-wds-text-ink">{nameAndRole(row.name, row.role)}</span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className={cn('font-wds-sans text-[13px] leading-4', row.many ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-ink')}>
                          {row.many ? `${DIGEST_COPY.many} · ` : ''}
                          {countWords(row.count)}
                        </span>
                        {span ? <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{span}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
