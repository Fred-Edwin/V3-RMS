import { hmOf } from '../../../attendance';
import { hmWords } from '../../_shared/lib/timesheet-words';
import type { OvertimeAnswer, OvertimeChoice, OvertimeDetail } from '../../_shared/types/month-types';

/** The pure rules of the overtime decision (spec S6, D3, D4). No money: approving only authorises the time; payroll decides pay. */

export const REASON_MIN = 5;
export const REASON_MAX = 280;

const humanCode = (code: string): string => {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** "WHY, FROM THE RECORD": counts and notes only, never takings. */
export function evidenceLines(d: OvertimeDetail): string[] {
  const e = d.evidence;
  const note = e.headNote ? `${e.headNote.by ? `${e.headNote.by.name}, ${e.headNote.by.role}: ` : ''}${e.headNote.text}` : 'none';
  return [
    `Reason given: ${e.reasonGiven ? humanCode(e.reasonGiven) : 'none'}`,
    e.openWork ? `Open at ${e.openWork.at ?? 'the end of the shift'}: ${e.openWork.orders} ${e.openWork.orders === 1 ? 'order' : 'orders'}` : 'Open at the end of the shift: nothing',
    `Colleagues in: ${e.colleagues.present} of ${e.colleagues.rostered}${e.colleagues.team ? `, the ${e.colleagues.team} team` : ''}`,
    `Orders taken ${e.ordersTaken}, tickets cleared ${e.ticketsCleared}`,
    `Asked in advance: ${e.askedInAdvance ? 'yes' : 'no'}`,
    `Head's note: ${note}`,
  ];
}

/** "THE LIMITS": information for the manager; a manager may approve above them with a reason. */
export function limitLines(d: OvertimeDetail): string[] {
  const l = d.limits;
  return [
    l.weekCapMinutes === null ? `That week: ${hmWords(l.weekMinutes)}, no weekly limit set` : `That week: ${hmWords(l.weekMinutes)} of the ${hmWords(l.weekCapMinutes)} limit`,
    `Overtime this month: ${hmWords(l.monthMinutes)} so far`,
    `Branch overtime that week: ${hmWords(l.branchWeekMinutes)}`,
  ];
}

/** Where the "approve part" stepper starts: half the extra rounded down to 5, kept inside the allowed range. */
export function partStart(part: NonNullable<OvertimeDetail['part']>, extra: number): number {
  const half = Math.floor(extra / 2 / part.step) * part.step;
  return Math.min(part.max, Math.max(part.min, half));
}

export const stepPart = (part: NonNullable<OvertimeDetail['part']>, value: number, direction: 1 | -1): number => Math.min(part.max, Math.max(part.min, value + direction * part.step));

/** The choice an earlier answer maps to, so "Change my answer" opens on it. */
export function choiceOf(status: OvertimeDetail['status']): OvertimeChoice {
  if (status === 'DECLINED') return 'DECLINE';
  if (status === 'APPROVED_PART') return 'APPROVE_PART';
  return 'APPROVE_ALL';
}

/** Why Save is not yet possible, in words under the button, or null when it is. */
export function saveProblem(choice: OvertimeChoice, reason: string, pin: string): string | null {
  if (choice !== 'APPROVE_ALL' && reason.trim().length < REASON_MIN) return 'Add your reason';
  if (pin.length < 4) return 'Enter your PIN';
  return null;
}

export function answerBody(choice: OvertimeChoice, part: number, reason: string, pin: string, version: number): OvertimeAnswer {
  const text = reason.trim();
  return { decision: choice, ...(choice === 'APPROVE_PART' ? { approvedMinutes: part } : {}), ...(text ? { reason: text } : {}), pin, version };
}

/** "14:00 → 22:00" for the planned times and "13:58 → 22:35" for the worked instants. */
export const plannedText = (d: OvertimeDetail): string => (d.plannedStart && d.plannedEnd ? `${d.plannedStart} → ${d.plannedEnd}` : '—');
export const workedText = (d: OvertimeDetail): string => (d.workedStart ? `${hmOf(d.workedStart)} → ${d.workedEnd ? hmOf(d.workedEnd) : 'open'}` : '—');

/** What the server's refusal codes say on this dialog. */
export function overtimeWords(code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_PIN':
      return 'That PIN is not right.';
    case 'CHANGED_UNDERNEATH':
      return 'This changed while you were looking. Check it again.';
    case 'PIN_NOT_SET':
      return 'Set your PIN first. Open your profile and choose Set PIN.';
    case 'PERIOD_APPROVED':
      return 'This month is approved. Tell HR if the overtime needs to change.';
    default:
      return fallback || 'That did not go through. Nothing was changed.';
  }
}
