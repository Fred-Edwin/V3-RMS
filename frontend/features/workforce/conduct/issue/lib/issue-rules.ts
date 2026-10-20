import type { SegmentItem } from '../../../_shared';
import { dayMonthYear, monthsBetween, shortDay } from '../../_shared/lib/conduct-dates';
import { hasTimesheetFacts, LEVEL_LABELS, OWN_LINE_MAX, OWN_LINE_MIN } from '../../_shared/lib/conduct-words';
import type { ConductAbout, ConductLevel, Draft, IssuePerson } from '../../_shared/types/conduct-types';

/**
 * The rules of the Issue a warning panel as pure functions (spec S9): which levels can be chosen, the helper under them, why Sign and
 * send waits, and the small print. The server enforces every one of these again; the panel only says it early and in plain words.
 */
export const LEVELS: readonly ConductLevel[] = ['VERBAL_NOTE', 'WRITTEN_WARNING', 'FINAL_WRITTEN_WARNING'];

export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

export function levelItems(draft: Draft | null): SegmentItem[] {
  return LEVELS.map((level) => ({ value: level, label: LEVEL_LABELS[level], disabled: level === 'FINAL_WRITTEN_WARNING' && draft !== null && !draft.finalAllowed }));
}

/** The helper under the three choices. */
export function levelHelper(level: ConductLevel, draft: Draft | null, person: IssuePerson | null): string {
  if (level === 'VERBAL_NOTE') return `A verbal note has no letter. ${person ? firstName(person.name) : 'The person'} can read it and appeal.`;
  if (draft && !draft.finalAllowed && !draft.finalAlreadyActive) return 'A final written warning needs an active written warning on the file.';
  return 'Suggested from the notices on file. A verbal note has no letter; written and final warnings are signed notices. A final warning needs an earlier written warning.';
}

/** "6 months · 9 Apr 2027" for the level chosen. */
export function endsLine(level: ConductLevel, draft: Draft | null, now: Date): string {
  const end = draft?.validUntilByLevel[level];
  if (!end) return '—';
  const months = monthsBetween(now, end);
  return `${months} ${months === 1 ? 'month' : 'months'} · ${dayMonthYear(end)}`;
}

export const ownLineLength = (text: string): number => text.replace(/\s+/g, ' ').trim().length;

export interface SubmitInputs {
  person: IssuePerson | null;
  level: ConductLevel;
  about: ConductAbout;
  draft: Draft | null;
  ownLine: string;
  pin: string;
  online: boolean;
  hasPin: boolean | null;
}

/** Why Sign and send waits, in the spec's words, or null when it can go. The first problem wins. */
export function submitBlock(i: SubmitInputs): string | null {
  if (!i.person) return 'Choose who first.';
  if (!i.draft) return 'Checking the timesheets…';
  if (i.level === 'FINAL_WRITTEN_WARNING' && i.draft.finalAlreadyActive) return 'A final written warning is already on file. Speak to HR.';
  if (i.level === 'FINAL_WRITTEN_WARNING' && !i.draft.finalAllowed) return 'A final written warning needs an active written warning on the file.';
  if (hasTimesheetFacts(i.about) && i.draft.noFacts) return 'There are no unexcused days for the month shown. Choose another month or add your own line.';
  if (ownLineLength(i.ownLine) < OWN_LINE_MIN) return `Add your own line (at least ${OWN_LINE_MIN} characters).`;
  if (ownLineLength(i.ownLine) > OWN_LINE_MAX) return `Keep your line to ${OWN_LINE_MAX} characters.`;
  if (i.hasPin === false) return 'Set your PIN first.';
  if (i.pin.length < 4) return 'Enter your PIN.';
  if (!i.online) return 'No signal. The notice was not sent. Try again when you are back online.';
  return null;
}

/** The small print under the PIN. Roles, not names: names appear on the signed record only. */
export function smallPrint(person: IssuePerson | null, level: ConductLevel, draft: Draft | null): string {
  const who = person ? firstName(person.name) : 'The person';
  if (level === 'VERBAL_NOTE') return `${who} is told on the phone. HR is told. Recorded in the audit log with your name and the time.`;
  const days = draft?.appealDays ?? 7;
  return `${who} is told on the phone and asked to sign, with ${days} days to appeal. HR is told. Recorded in the audit log with your name and the time.`;
}

/** The right-hand note on a person row in the picker. */
export function noticeNote(person: IssuePerson): { text: string; tone: 'warning' | 'muted' | 'ink' } {
  if (person.activeNotices.length === 0) return { text: 'No notices on file', tone: 'muted' };
  if (person.activeNotices.some((n) => n.level === 'FINAL_WRITTEN_WARNING')) return { text: 'Final warning on file', tone: 'ink' };
  return { text: `${person.activeNotices.length} active`, tone: 'warning' };
}

/** "Notice sent to Mark. They have until Mon 12 Oct to sign." The sign limit is the issue day plus the days to sign, in Nairobi days. */
export function sentMessage(person: IssuePerson, level: ConductLevel, ackDays: number, now: Date): string {
  const name = firstName(person.name);
  if (level === 'VERBAL_NOTE') return `Verbal note recorded for ${name}. HR has been told.`;
  const limit = new Date(now.getTime() + ackDays * 86_400_000);
  return `Notice sent to ${name}. ${person.hasLogin ? `They have until ${shortDay(limit)} to sign.` : 'Print the letter, give it by hand, then record that it was given.'}`;
}
