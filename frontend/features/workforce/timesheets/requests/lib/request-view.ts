import type { ReasonOption } from '../../../_shared';
import type { InboxRequest, Request, RequestKind } from '../../_shared/types/timesheet-types';

/** The manager's side of Report a problem (Chapter 9 draws the person's side). Pure. */

export const REQUEST_DECLINE_REASONS: ReasonOption[] = [
  { key: 'recorded-right', label: 'The clock was right' },
  { key: 'not-agreed', label: 'Not agreed beforehand' },
  { key: 'no-evidence', label: 'I cannot see the work' },
  { key: 'ask-hr', label: 'This is for HR' },
];

export const isClockKind = (kind: RequestKind): boolean => kind === 'CLOCK_TIME_WRONG' || kind === 'WORKED_NOT_RECORDED' || kind === 'CLOCKED_OUT_BY_MISTAKE';

/** What approving does, so nobody approves blind. */
export function approveNote(kind: RequestKind): string {
  if (isClockKind(kind)) return 'Approving fixes the clock time through a correction. The old time stays in the history, and the person is told.';
  if (kind === 'PAY_OTHER') return 'Approving only records your answer. Pay is decided by payroll.';
  return 'Approving records your answer. Nothing else changes by itself; the person is told.';
}

/** "Waiting 3 days", "Waiting since today", "Escalated to HR · Mercy Achieng", or how it was answered. */
export function waitingWords(request: Pick<Request, 'state' | 'waitingDays' | 'escalatedToHr' | 'waitingOnName' | 'decidedByName'>): string {
  if (request.state === 'APPROVED') return `Approved${request.decidedByName ? ` by ${request.decidedByName}` : ''}`;
  if (request.state === 'DECLINED') return `Not approved${request.decidedByName ? ` by ${request.decidedByName}` : ''}`;
  if (request.state === 'WITHDRAWN') return 'Withdrawn';
  if (request.escalatedToHr) return `Escalated to HR${request.waitingOnName ? ` · ${request.waitingOnName}` : ''}`;
  if (request.waitingDays === 0) return 'Waiting since today';
  return `Waiting ${request.waitingDays} ${request.waitingDays === 1 ? 'day' : 'days'}`;
}

export const inboxState = (chip: string | undefined): 'WAITING' | 'ANSWERED' | 'ALL' => (chip === 'ANSWERED' ? 'ANSWERED' : chip === 'ALL' ? 'ALL' : 'WAITING');

/** Oldest waiting first is the server's order; this only says which rows have gone to HR, for the tag. */
export const isEscalated = (row: InboxRequest): boolean => row.state === 'WAITING' && row.escalatedToHr;
