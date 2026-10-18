import * as React from 'react';

import { weekdayName } from '../../_shared/lib/rota-dates';
import type { RotaWarning } from '../../_shared/types/rota-types';

/**
 * The warnings behind "Needs a look" in words: leave, thin cover, weekly hours, a double shift. They inform and never block; each is
 * also marked on the grid (an amber cell, an amber note under a name, "3 thin" in the footer).
 */
export const WarningsList = React.forwardRef<HTMLElement, { warnings: readonly RotaWarning[] }>(function WarningsList({ warnings }, ref) {
  if (warnings.length === 0) return null;
  return (
    <section ref={ref} tabIndex={-1} aria-label="Needs a look" className="mt-4 flex flex-col gap-2 outline-none">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">NEEDS A LOOK</h3>
      <ul className="m-0 flex list-none flex-col border border-wds-border bg-wds-surface p-0">
        {warnings.map((w, i) => (
          <li key={`${w.code}${w.employeeId ?? w.departmentId ?? ''}${w.date ?? i}`} className="flex items-baseline gap-2.5 border-b border-wds-neutral-100 px-3.5 py-2.5 last:border-b-0">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-wds-caramel-600" />
            <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-ink">{w.message}</span>
            {w.date ? <span className="ml-auto shrink-0 font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{weekdayName(w.date).slice(0, 3)}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
});
