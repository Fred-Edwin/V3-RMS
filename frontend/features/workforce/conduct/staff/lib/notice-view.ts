import type { CircleStep } from '../../../_shared';
import { dayMonthYear, monthsBetween, shortDay } from '../../_shared/lib/conduct-dates';
import { LEVEL_LABELS, OUTCOME_PHRASE, plural } from '../../_shared/lib/conduct-words';
import type { StaffDetail } from '../../_shared/types/conduct-types';

/**
 * What the staff notice screen shows for each state, as pure rules the tests can pin (spec S2, S4). The server sends the steps with
 * their dates; nothing here computes a date from the phone's clock.
 */
export type PrimaryAction = 'sign' | 'download' | null;

/** The brown button: Sign while Issued and signable, otherwise Download while a letter exists. */
export function primaryAction(d: StaffDetail): PrimaryAction {
  if (d.actions.canSign) return 'sign';
  return d.actions.canDownload ? 'download' : null;
}

/** Whether the appeal step exists on this notice at all (a notice made by a reduction has none). */
const hasAppealStep = (d: StaffDetail): boolean => d.steps.some((s) => s.key === 'appeal');

/** The grey line that stands in for the Appeal button, or null while the button shows or the notice cannot be appealed at all. */
export function appealLine(d: StaffDetail): string | null {
  if (d.actions.canAppeal || !hasAppealStep(d)) return null;
  if (d.appeal) return d.decision ? null : 'Your appeal is with HR.';
  if (d.status === 'REPLACED' || d.status === 'WITHDRAWN') return null;
  return 'You can no longer appeal this notice. Speak to HR.';
}

/** The server's steps as the kit's stepper takes them. The "See the new notice" link is added by the screen (it is a link, not data). */
export function toCircleSteps(d: StaffDetail): CircleStep[] {
  return d.steps.map((s) => ({ key: s.key, state: s.state, title: s.title, line: s.line }));
}

/** "Written warning" or "Verbal note": the level word the header shows. */
export const levelTitle = (d: StaffDetail): string => LEVEL_LABELS[d.level];

/** The two header figures of the notice before signing: "SIGN WITHIN 3 days" and "STAYS ON FILE 6 months". */
export function signStats(d: StaffDetail): { label: string; value: string }[] {
  return [
    { label: 'SIGN WITHIN', value: plural(d.ackDays, 'day') },
    { label: 'STAYS ON FILE', value: plural(monthsBetween(d.issuedAt, d.validUntil), 'month') },
  ];
}

/** The quiet block after HR decided: the outcome in words and the reason, which the staff member is allowed to read. */
export function decisionLine(d: StaffDetail): { title: string; reason: string; by: string } | null {
  if (!d.decision) return null;
  return {
    title: `Decided: ${OUTCOME_PHRASE[d.decision.outcome]}`,
    reason: d.decision.reason,
    by: `Decided by ${d.decision.decidedByLabel} · ${shortDay(d.decision.decidedAt)}`,
  };
}

/** The line under the title on a notice: who gave it and what it is about. */
export const fromLine = (d: StaffDetail): string => `From your ${d.issuerRole} · ${d.aboutLabel.toLowerCase()}`;

/** The end date for a heading, "9 Apr 2027". */
export const endsOn = (d: StaffDetail): string => dayMonthYear(d.validUntil);
