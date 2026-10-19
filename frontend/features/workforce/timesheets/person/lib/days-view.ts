import type { PersonDayRow } from '../../_shared/types/month-types';

/** The small button an exception row may carry (spec S5). `overtime` opens the decision, `fix` the Edit time dialog, `request` the inbox. */
export interface RowAction {
  action: 'overtime' | 'fix' | 'request';
  label: string;
}

/** "14:00 to 22:00", or null when there is no shift. */
export const timePair = (start: string | null, end: string | null): string | null => (start && end ? `${start} to ${end}` : null);

/** The row's fill: amber for a late day or overtime waiting, grey for a rest day (colour is never the only signal; the result says it too). */
export function rowFill(day: Pick<PersonDayRow, 'resultKey' | 'beforeEmployment'>): string {
  if (day.beforeEmployment) return 'bg-wds-neutral-50 text-wds-neutral-500';
  if (day.resultKey === 'LATE' || day.resultKey === 'OVERTIME_TO_DECIDE' || day.resultKey === 'CLOCK_OUT_MISSING') return 'bg-wds-warning-bg';
  if (day.resultKey === 'REST') return 'bg-wds-neutral-50';
  return '';
}

export function rowSecondary(day: Pick<PersonDayRow, 'resultKey'>): string {
  return day.resultKey === 'LATE' || day.resultKey === 'OVERTIME_TO_DECIDE' || day.resultKey === 'CLOCK_OUT_MISSING' ? 'font-semibold text-wds-warning-fg' : 'text-wds-text-secondary';
}

/** Which small button a day gets, given what the viewer may do. Absent when they may not, or the month is approved. */
export function rowAction(day: PersonDayRow, can: { decide: boolean; fix: boolean; request: boolean }): RowAction | null {
  if (day.overtimeItemId && day.resultKey === 'OVERTIME_TO_DECIDE' && can.decide) return { action: 'overtime', label: 'Decide the overtime' };
  if (day.resultKey === 'CLOCK_OUT_MISSING' && can.fix) return { action: 'fix', label: 'Fix the clock-out' };
  if (day.requestId && can.request) return { action: 'request', label: 'Answer the request' };
  return null;
}

export type DaysChip = 'all' | 'needs' | 'worked';
