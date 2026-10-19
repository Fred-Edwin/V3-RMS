import type { DayResultKey, NeedLookItem, OvertimeStatus } from '../../_shared/types/month-types';
import { hmWords } from '../../_shared/lib/timesheet-words';

/** What the button of a day that needs a look does. The viewer's rights come from the server's answers, never a role name. */
export type NeedAction = 'overtime' | 'fix' | 'request' | 'day';

const SHORT_RESULT: Record<DayResultKey, string> = {
  REST: 'Rest day',
  ON_ROTA: 'On the rota',
  LATE: 'Late, recorded',
  LEFT_EARLY: 'Left early',
  OVERTIME_TO_DECIDE: 'Overtime to decide',
  OVERTIME_APPROVED: 'Overtime approved',
  OVERTIME_APPROVED_PART: 'Overtime approved in part',
  OVERTIME_NOT_APPROVED: 'Overtime not approved',
  CLOCK_OUT_MISSING: 'Clock-out missing',
  ABSENT: 'Absent, unpaid',
  REQUEST_WAITING: 'Request waiting',
  EDITED: 'Edited by a manager',
};

/** A day's result without minutes, for the drawer's small table. */
export const shortResult = (key: DayResultKey): string => SHORT_RESULT[key];

/** The one button a day that needs a look gets, or null when the viewer may not use it (the button is absent, not greyed). */
export function needLookAction(item: NeedLookItem, allowed: Record<NeedAction, boolean>): { action: NeedAction; label: string } | null {
  switch (item.kind) {
    case 'OVERTIME':
      return allowed.overtime ? { action: 'overtime', label: 'Decide the overtime' } : null;
    case 'CLOCK_OUT_FIX':
      return allowed.fix && item.timeFixAllowed ? { action: 'fix', label: 'Fix the clock-out' } : null;
    case 'REQUEST':
      return allowed.request ? { action: 'request', label: 'Answer the request' } : null;
    default:
      return allowed.day ? { action: 'day', label: 'Look at this day' } : null;
  }
}

const KIND_WORDS: Record<NeedLookItem['kind'], string> = {
  OVERTIME: 'overtime to decide',
  CLOCK_OUT_FIX: 'clock-out missing',
  REQUEST: 'request waiting',
  DAY_LOOK: 'day to look at',
};

export const needLookTitle = (item: NeedLookItem, dayWords: string): string => `${dayWords} · ${KIND_WORDS[item.kind]}`;

/** A quiet row of an approved month: "Overtime 35 min approved". */
export function decisionLine(status: OvertimeStatus, authorised: number, extra: number): string {
  if (status === 'DECLINED') return `Overtime ${hmWords(extra)} not approved`;
  if (status === 'APPROVED_PART') return `Overtime ${hmWords(authorised)} of ${hmWords(extra)} approved in part`;
  return `Overtime ${hmWords(authorised)} approved`;
}
