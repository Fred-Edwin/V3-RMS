import { hmOf } from '../../../attendance';
import type { Request } from '../types/timesheet-types';

/**
 * "Recorded" against "I say it should be" for a request, and "was" against "now" once it is answered (Paper Chapter 9, steps 2 and 3).
 * The server keeps times as instants in `recorded`, `requested` and `answerAfter`; they are written here as Nairobi clock times.
 * Pure, so the words are tested once.
 */

export interface Compare {
  /** Left box, "Out 11:20" (struck through once answered). */
  was: string;
  /** Right box, "Out 14:00". */
  want: string;
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const time = (value: unknown): string | null => {
  const iso = text(value);
  return iso ? hmOf(iso) : null;
};

const side = (label: string, value: string | null): string => (value ? `${label} ${value}` : 'Nothing recorded');
const both = (inAt: string | null, outAt: string | null): string => (inAt && outAt ? `In ${inAt} · Out ${outAt}` : inAt ? `In ${inAt}` : outAt ? `Out ${outAt}` : 'Nothing recorded');

/** What the person said was wrong and what they say it should be. Null for a request that changes no time. */
export function requestedCompare(request: Pick<Request, 'kind' | 'recorded' | 'requested'>): Compare | null {
  const { recorded, requested } = request;
  switch (request.kind) {
    case 'CLOCK_TIME_WRONG': {
      const isIn = requested.type === 'IN';
      return { was: side(isIn ? 'In' : 'Out', time(isIn ? recorded.clockIn : recorded.clockOut)), want: side(isIn ? 'In' : 'Out', time(requested.at)) };
    }
    case 'WORKED_NOT_RECORDED':
      return { was: both(time(recorded.clockIn), time(recorded.clockOut)), want: both(time(requested.clockIn), time(requested.clockOut)) };
    case 'CLOCKED_OUT_BY_MISTAKE': {
      const real = time(requested.at);
      return { was: side('Out', time(recorded.clockOut)), want: real ? `Out ${real}` : 'Still on shift' };
    }
    default:
      return null;
  }
}

/** After a clock request is accepted: the day before and after the correction the server made. Null when nothing changed or it was declined. */
export function answeredCompare(request: Pick<Request, 'kind' | 'state' | 'answerAfter'>): Compare | null {
  const after = request.answerAfter;
  if (request.state !== 'APPROVED' || !after) return null;
  const before = after.before as Record<string, unknown> | undefined;
  const now = after.after as Record<string, unknown> | undefined;
  if (!before || !now) return null;
  const isIn = request.kind === 'CLOCK_TIME_WRONG' && JSON.stringify(before.clockIn) !== JSON.stringify(now.clockIn);
  if (request.kind === 'WORKED_NOT_RECORDED') return { was: both(time(before.clockIn), time(before.clockOut)), want: both(time(now.clockIn), time(now.clockOut)) };
  return { was: side(isIn ? 'In' : 'Out', time(isIn ? before.clockIn : before.clockOut)), want: now.clockOut === null && !isIn ? 'Still on shift' : side(isIn ? 'In' : 'Out', time(isIn ? now.clockIn : now.clockOut)) };
}

/** "Out 11:20, should be 14:00": the one line under a request title on a list. */
export function shortCompare(request: Pick<Request, 'kind' | 'recorded' | 'requested' | 'note'>): string {
  const compare = requestedCompare(request);
  if (!compare) return request.note;
  return `${compare.was}, should be ${compare.want.replace(/^(In|Out) /, '')}`;
}

/** The day's worked time after an accepted request, when the server sent it: "Your Friday now shows 8 h 02". */
export function dayNowMinutes(request: Pick<Request, 'answerAfter'>): number | null {
  const day = request.answerAfter?.day as { workedMinutes?: unknown } | null | undefined;
  return day && typeof day.workedMinutes === 'number' ? day.workedMinutes : null;
}
