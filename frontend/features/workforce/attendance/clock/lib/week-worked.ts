import type { WeekBar } from '../../../_shared';
import { hoursAndMinutes } from '../../_shared/lib/nairobi-clock';
import type { MyDay } from '../../_shared/types/attendance-types';

/** A 10-hour day fills the 40 px bar, as in the planned-hours card the Rota feeds. */
const FULL_BAR_MINUTES = 600;

export interface WorkedWeek {
  range: string;
  bars: readonly WeekBar[];
  hours: string;
  hoursOf: string;
}

/**
 * "This week" once the new clock is on: the same seven bars as the planned card, with each day that has worked time drawn green at the
 * hours worked, the footer reading hours so far against hours planned. `planned` is the Rota-fed card, so its range and letters carry over.
 */
export function withWorked(planned: WorkedWeek, day: MyDay): WorkedWeek {
  if (!day.enabled || day.week.days.length === 0) return planned;
  const byDate = new Map(day.week.days.map((d) => [d.date, d]));
  const bars = planned.bars.map((bar, i): WeekBar => {
    const date = day.week.days[i]?.date;
    const data = date ? byDate.get(date) : undefined;
    if (!data || data.workedMinutes <= 0) return bar;
    return { ...bar, state: 'worked', fraction: Math.min(1, data.workedMinutes / FULL_BAR_MINUTES), label: `${bar.label.split(',')[0]}, ${hoursAndMinutes(data.workedMinutes)} worked` };
  });
  const planMinutes = day.week.plannedMinutes;
  return { range: planned.range, bars, hours: hoursAndMinutes(day.week.workedMinutes), hoursOf: planMinutes > 0 ? `so far of ${hoursAndMinutes(planMinutes)} planned` : 'worked so far this week' };
}
