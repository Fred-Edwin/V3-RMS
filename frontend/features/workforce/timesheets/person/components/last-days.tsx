import { hmOf } from '../../../attendance';
import { dayTitle } from '../../_shared/lib/timesheet-words';
import type { LastDay } from '../../_shared/types/month-types';
import { shortResult } from '../lib/person-view';

const cell = 'py-2 font-wds-mono text-[12px] leading-4';

/** "06:00 to 14:00", "Day off" or "·": the planned column. */
const plannedOf = (d: LastDay): string => (d.plannedStart && d.plannedEnd ? `${d.plannedStart} to ${d.plannedEnd}` : d.resultKey === 'REST' ? 'Day off' : '·');
const clockedOf = (d: LastDay): string => (d.clockIn ? `${hmOf(d.clockIn)} to ${d.clockOut ? hmOf(d.clockOut) : 'open'}` : '·');

/** The last 7 days of the range, most recent first (spec S4). A plain table with an ink top rule. */
export function LastDays({ days }: { days: readonly LastDay[] }) {
  return (
    <table className="w-full border-collapse border-t border-wds-text-ink text-left">
      <caption className="sr-only">The last 7 days</caption>
      <thead>
        <tr className="border-b border-wds-border font-wds-mono text-[10px] leading-3 tracking-[0.08em] text-wds-text-secondary">
          <th scope="col" className="w-[110px] py-2 font-normal">DAY</th>
          <th scope="col" className="w-[130px] py-2 font-normal">PLANNED</th>
          <th scope="col" className="w-[130px] py-2 font-normal">CLOCKED</th>
          <th scope="col" className="py-2 font-normal">RESULT</th>
        </tr>
      </thead>
      <tbody>
        {days.map((d) => (
          <tr key={d.date} className="border-b border-wds-neutral-100">
            <th scope="row" className="py-2 text-left font-wds-sans text-[13px] font-normal leading-4 text-wds-text-ink">{dayTitle(d.date)}</th>
            <td className={`${cell} ${d.plannedStart ? 'text-wds-text-ink' : 'text-wds-text-faint'}`}>{plannedOf(d)}</td>
            <td className={`${cell} ${d.clockIn ? 'text-wds-text-ink' : 'text-wds-text-faint'}`}>{clockedOf(d)}</td>
            <td className="py-2 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{shortResult(d.resultKey)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
