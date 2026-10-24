'use client';

import * as React from 'react';

import { Callout, ShiftGrid } from '../../../_shared';
import { dayLong, weekdayShort, dayNumber } from '../../_shared/lib/leave-dates';
import type { RotaPanel } from '../../_shared/types/leave-types';
import { MAX_COLUMNS, columnLabel, coverSentence, footerCells, gridRows, tightDays } from '../lib/rota-view';

/**
 * "The team on those days" (spec Step 10): usual shifts or the planned rota, the person's days as dashed Asked for, an IF APPROVED row,
 * and one sentence that warns and never blocks. A request longer than 14 days draws the first 14 and lists the tight days below.
 */
export function RotaStrip({ rota, personId }: { rota: RotaPanel; personId: string }) {
  const [showAll, setShowAll] = React.useState(false);
  const planned = rota.days.some((d) => d.planned);
  const long = rota.days.length > MAX_COLUMNS;
  const shown = long && !showAll ? rota.days.slice(0, MAX_COLUMNS) : rota.days;
  const tight = tightDays(rota.days);
  const label = `The ${rota.department ?? 'team'} on those days`;
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.08em] text-wds-text-secondary">{`${label} · ${planned ? 'shifts planned' : 'usual shifts, not planned yet'}`}</h3>
      {rota.days.length === 0 ? <p className="m-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">No days to show.</p> : (
        <ShiftGrid
          label={`${label}, ${dayLong(rota.days[0]?.date ?? '')} onward`}
          days={shown.map((d) => columnLabel(d.date))}
          rows={gridRows(shown, personId)}
          hoursHeading=""
          footer={{ label: 'IF APPROVED', cells: footerCells(shown) }}
        />
      )}
      {long ? (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start font-wds-sans text-[13px] font-medium text-wds-primary underline focus-visible:outline-none focus-visible:shadow-wds-ring">
            {showAll ? 'Show the first 14 days' : `Show all ${rota.days.length} days`}
          </button>
          {tight.length > 0 ? (
            <Callout tone="warning" size="sm" title={`Days below the minimum: ${tight.length}`}>
              {tight.slice(0, 20).map((d) => `${weekdayShort(d.date)} ${dayNumber(d.date)}: ${d.working} of ${d.rows.length}`).join(' · ')}
            </Callout>
          ) : null}
        </div>
      ) : null}
      <p className={tight.length > 0 ? 'm-0 font-wds-sans text-[13px] leading-[18px] text-wds-warning-fg' : 'm-0 font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary'} role="status">
        {coverSentence(rota.days, rota.department)}
      </p>
    </section>
  );
}
