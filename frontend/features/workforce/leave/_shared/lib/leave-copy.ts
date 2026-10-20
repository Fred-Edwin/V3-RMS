import { ApiError } from '@/types/api';

import type { AdjustReason, ApplicationSummary, BarTone, CancelReason, DeclineReason } from '../types/leave-types';
import { momentLabel, rangeShort } from './leave-dates';

/** Leave words (spec screens, copy blocks). Roles stand in for names inside sentences; records carry name plus role (L29). */
export const LEAVE_SCREEN = 'My leave';

export const DECLINE_CHIPS: readonly { value: DeclineReason; label: string }[] = [
  { value: 'TOO_FEW', label: 'Too few people that week' },
  { value: 'BUSY', label: 'Busy period' },
  { value: 'NOTICE', label: 'Not enough notice' },
  { value: 'OTHER', label: 'Other' },
];

export const CANCEL_CHIPS: readonly { value: CancelReason; label: string }[] = [
  { value: 'STAFFING', label: 'Staffing need' },
  { value: 'PERSON_ASKED', label: 'Asked by the person' },
  { value: 'MISTAKE', label: 'Entered by mistake' },
  { value: 'OTHER', label: 'Other' },
];

export const ADJUST_CHIPS: readonly { value: AdjustReason; label: string }[] = [
  { value: 'CORRECTION', label: 'Fixing a mistake' },
  { value: 'DIRECTOR_GRANT', label: 'Granted by the Director' },
  { value: 'RETURNED_EARLY', label: 'Carried over' },
  { value: 'BIRTH_OR_ADOPTION', label: 'Birth or adoption' },
  { value: 'OTHER', label: 'Other' },
];

/** The sentence a person reads for a decline chip (Step 4). "Other" is the note alone. */
export function declineSentence(code: string | null, note: string | null, department: string | null): string {
  const chip: Record<string, string> = {
    TOO_FEW: `Too few people on the ${department ?? 'team'} team on those days.`,
    BUSY: 'It is a busy period.',
    NOTICE: 'There was not enough notice.',
  };
  const lead = code && code !== 'OTHER' ? (chip[code] ?? '') : '';
  return [lead, note?.trim() ?? ''].filter(Boolean).join(' ');
}

const chipLabel = (list: readonly { value: string; label: string }[], code: string | null): string => list.find((c) => c.value === code)?.label ?? '';
export const declineLabel = (code: string | null): string => chipLabel(DECLINE_CHIPS, code);
export const cancelLabel = (code: string | null): string => chipLabel(CANCEL_CHIPS, code);
export const adjustLabel = (code: string | null): string => chipLabel(ADJUST_CHIPS, code);

/** Who the person is waiting on, from the server's deciding role ("Branch Manager" becomes "your Branch Manager"). */
export function waitingOn(role: string | null): string {
  if (!role) return 'your Branch Manager';
  return role === 'HR' || role === 'HR Manager' ? 'HR' : role === 'Director' ? 'the Director' : `your ${role}`;
}

/** The line under a row in History (Step 3). */
export function statusLine(app: ApplicationSummary, reasonCode?: string | null): { text: string; tone: 'warning' | 'success' | 'error' | 'muted' } {
  switch (app.phase) {
    case 'WAITING':
      return { text: `Waiting for ${waitingOn(app.decidingRole)}`, tone: 'warning' };
    case 'BOOKED':
      return { text: 'Approved · booked', tone: 'success' };
    case 'ON_LEAVE':
      return { text: 'Approved · on leave now', tone: 'success' };
    case 'TAKEN':
      return { text: 'Approved · taken', tone: 'success' };
    case 'DECLINED':
      return { text: reasonCode ? `Declined · ${declineLabel(reasonCode).toLowerCase()}` : 'Declined', tone: 'error' };
    default:
      return { text: 'Cancelled', tone: 'muted' };
  }
}

/** The server's reason a decision button is missing ("... It moves to HR on 2026-10-12T12:10:00.000Z.") with the moment in Nairobi words. */
export const whyNotText = (text: string): string => text.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/, (iso) => momentLabel(iso));

/** "Annual leave · 3 days", or "7 days (2 unpaid)". */
export function titleLine(app: Pick<ApplicationSummary, 'typeLabel' | 'days' | 'unpaidTailDays'>): string {
  const n = `${app.days} ${app.days === 1 ? 'day' : 'days'}`;
  return `${app.typeLabel} · ${n}${app.unpaidTailDays > 0 ? ` (${app.unpaidTailDays} unpaid)` : ''}`;
}

export const datesLine = (app: Pick<ApplicationSummary, 'start' | 'end'>): string => rangeShort(app.start, app.end);

export const TONE_FILL: Record<BarTone, string> = {
  GREEN: 'bg-wds-success-fg',
  AMBER: 'bg-wds-caramel-600',
  RED: 'bg-wds-error-fg',
  NONE: 'bg-wds-neutral-300',
};

/** What an error code says on the screen, in the spec's words; anything else uses the server's own message. */
export function leaveErrorText(err: unknown, fallback: string): { code: string; text: string; status: number } {
  if (!(err instanceof ApiError)) return { code: 'NETWORK', text: fallback, status: 0 };
  const known: Record<string, string> = {
    NETWORK: 'Could not send. Nothing was saved. Try again.',
    OVERLAP: 'You already have leave on those days. Open it.',
    LEAVE_CROSSES_YEAR: 'This runs into next year. Send two requests.',
    CASUAL_NO_LEAVE: 'Leave starts when your contract starts.',
    PIN_INVALID: 'That PIN is not right. Try again.',
    PIN_NOT_SET: 'Set your PIN first.',
    ALREADY_DECIDED: 'Someone answered this a moment ago.',
    STALE_REQUEST: 'Someone answered this a moment ago.',
    BALANCE_CHANGED: 'This balance changed a moment ago. Check the new figure.',
    STARTED_WHILE_WAITING: 'These days have already started. Decline it or ask the person to send new dates.',
  };
  return { code: err.code, text: known[err.code] ?? err.message ?? fallback, status: err.statusCode };
}
