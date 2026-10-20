import { addDays, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { RequestableType } from '../balances/balance-service';
import type { ApplicationRow } from '../data/applications-repository';
import type { LeavePerson } from '../data/people-repository';
import { shortfallOf } from '../engine/leave-balance';
import { countDays, crossesYear } from '../engine/leave-days';
import { MAX_REQUEST_DAYS } from '../leave.constants';

export interface AskError {
  code: string;
  message: string;
  /** 'state' errors are a 409 (the world says no), 'input' errors a 400 (the request is wrong). */
  kind: 'input' | 'state';
  details?: Record<string, unknown>;
}

export interface AskAssessment {
  errors: AskError[];
  days: number;
  returnOn: NairobiDate;
  left: number | null;
  leftAfter: number | null;
  shortfall: number;
  suggestedTail: number;
  tailAllowed: boolean;
  /** The days of the request that are unpaid: the tail actually applied. */
  appliedTail: number;
  sickNote: boolean;
}

export interface AskInput {
  typeCode: string;
  start: NairobiDate;
  end: NairobiDate;
  unpaidTailDays?: number | undefined;
}

const input = (code: string, message: string, details?: Record<string, unknown>): AskError => ({ code, message, kind: 'input', ...(details ? { details } : {}) });
const state = (code: string, message: string, details?: Record<string, unknown>): AskError => ({ code, message, kind: 'state', ...(details ? { details } : {}) });

/**
 * Everything that decides whether a request may be sent, in the order the spec lists (section 12, M5): casual, type, start not before
 * today, end not before start, one leave year, not after the exit date, no overlap, then days against days left (with an unpaid tail
 * only when the shortfall is exactly that tail). The same function answers the preview and the create, so they never disagree.
 */
export function assessAsk(args: { person: LeavePerson; requestable: RequestableType | undefined; ask: AskInput; overlap: ApplicationRow | null; today: NairobiDate }): AskAssessment {
  const { person, requestable, ask, today } = args;
  const errors: AskError[] = [];
  const ordered = ask.end >= ask.start;
  const days = ordered ? countDays(ask.start, ask.end) : 0;
  const left = requestable?.left ?? null;
  const tailAllowed = requestable?.tailAllowed ?? false;
  const shortfall = left === null ? 0 : shortfallOf(days, left);
  const tail = ask.unpaidTailDays ?? 0;

  if (person.isCasual) errors.push(state('CASUAL_NO_LEAVE', 'Leave starts when your contract starts.'));
  else if (!requestable) errors.push(input('TYPE_UNKNOWN', 'That kind of leave is not available to you.'));
  if (ask.start < today) errors.push(input('START_IN_PAST', "Earlier dates can't be picked."));
  if (!ordered) errors.push(input('END_BEFORE_START', 'The last day is before the first day.'));
  else {
    if (crossesYear(ask.start, ask.end)) errors.push(input('LEAVE_CROSSES_YEAR', 'This runs into next year. Send two requests.'));
    if (days > MAX_REQUEST_DAYS) errors.push(input('TOO_LONG', 'That is too many days for one request.'));
    if (person.exitedOn && ask.end > person.exitedOn) errors.push(input('AFTER_EXIT', `Your last day is ${person.exitedOn}.`));
  }
  if (args.overlap) errors.push(state('OVERLAP', 'You already have leave asked for or approved on some of those days.', { id: args.overlap.id, start: args.overlap.start, end: args.overlap.end, status: args.overlap.status }));

  if (requestable && ordered && errors.length === 0) {
    if (left === null || shortfall === 0) {
      if (tail > 0) errors.push(input('TAIL_NOT_NEEDED', left === null ? 'Unpaid leave has no unpaid tail.' : 'You have enough days, so no unpaid days are needed.'));
    } else if (!tailAllowed) {
      errors.push(state('BALANCE_TOO_LOW', `You have ${left} days of ${requestable.label.toLowerCase()} left, and this is ${days}.`, { left, days, shortfall, tailAllowed: false }));
    } else if (tail === 0) {
      errors.push(state('BALANCE_TOO_LOW', `You have ${left} ${requestable.label.toLowerCase()} days left, and this is ${days}.`, { left, days, shortfall, suggestedTail: shortfall, tailAllowed: true }));
    } else if (tail !== shortfall) {
      errors.push(input('TAIL_MISMATCH', `The unpaid days must be exactly ${shortfall}.`, { shortfall }));
    }
  }

  const appliedTail = left !== null && shortfall > 0 && tailAllowed && tail === shortfall ? tail : 0;
  return {
    errors,
    days,
    returnOn: addDays(ask.end, 1),
    left,
    leftAfter: left === null ? null : Math.max(0, left - (days - appliedTail)),
    shortfall,
    suggestedTail: tailAllowed ? shortfall : 0,
    tailAllowed,
    appliedTail,
    sickNote: requestable?.sickNoteAfterDays != null && days > requestable.sickNoteAfterDays,
  };
}
