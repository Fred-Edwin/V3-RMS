import { parseClock } from '../../../_shared';
import { hmOf, hoursAndMinutes, instantAt } from '../../_shared/lib/nairobi-clock';
import type { DayHistory, DayNumbers, FixBody, HistoryEvent } from '../../_shared/types/attendance-types';

/** The model of the "Edit time" dialog: what the manager picked, whether it can be sent, and the words that describe it. Pure. */

export type Change =
  | { action: 'EDIT'; eventId: string; hm: string }
  | { action: 'ADD'; type: 'IN' | 'OUT'; hm: string }
  | { action: 'VOID'; eventId: string };

export const FIX_REASONS = [
  { key: 'saw', label: 'I saw them working' },
  { key: 'phone', label: 'Phone problem' },
  { key: 'asked', label: 'Staff asked' },
] as const;

export const CLOCK_FOR_REASONS = [
  { key: 'signal', label: 'Phone had no signal' },
  { key: 'forgot', label: 'Forgot' },
  { key: 'lost', label: 'Phone lost or broken' },
] as const;

export const SOURCE_WORDS: Record<string, string> = {
  PHONE: 'Their phone',
  HEAD: 'A department head',
  MANAGER: 'A manager',
  SYSTEM: 'Set by the system',
  LEGACY: 'The old clock',
};

/** The events on a shift that still count and are a real clock-in or clock-out (a correction row is only the trail). */
export const countingEvents = (events: readonly HistoryEvent[]): HistoryEvent[] => events.filter((e) => e.status === 'COUNTS' && (e.type === 'IN' || e.type === 'OUT'));

/** The time a change would set, as an instant the API takes, or null when the words are not a real time. */
export function instantOf(date: string, hm: string): string | null {
  const parsed = parseClock(hm);
  return parsed ? instantAt(date, parsed) : null;
}

/** Why a change cannot be sent yet, in words; null when it can. */
export function changeProblem(change: Change | null, date: string, reasonText: string | null, nowMs: number): string | null {
  if (!change) return 'Choose what to change first.';
  if (change.action !== 'VOID') {
    const at = instantOf(date, change.hm);
    if (!at) return 'Use a time like 14:30.';
    if (Date.parse(at) > nowMs) return 'That time has not happened yet.';
  }
  if (!reasonText || reasonText.trim().length < 3) return 'Say why.';
  return null;
}

export function bodyOf(change: Change, employeeId: string, date: string, reason: string, rotaEntryId?: string): FixBody | null {
  const common = { employeeId, date, reason, ...(rotaEntryId ? { rotaEntryId } : {}) };
  if (change.action === 'VOID') return { action: 'VOID', eventId: change.eventId, ...common };
  const at = instantOf(date, change.hm);
  if (!at) return null;
  return change.action === 'EDIT' ? { action: 'EDIT', eventId: change.eventId, at, ...common } : { action: 'ADD', type: change.type, at, ...common };
}

/** "In 05:58 · Out 11:20" for a day's numbers. */
export function inOutWords(n: DayNumbers | null): string {
  if (!n) return 'No clock events';
  const parts = [n.clockedInAt ? `In ${hmOf(n.clockedInAt)}` : null, n.clockedOutAt ? `Out ${hmOf(n.clockedOutAt)}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No clock events';
}

/** "8 h 2 m worked, 12 min late" under the in and out. */
export function totalWords(n: DayNumbers | null): string {
  if (!n) return '';
  const late = n.countsAsLate ? `, ${n.minutesLate} min late` : '';
  return `${hoursAndMinutes(n.workedMinutes)} worked${late}`;
}

/** The change in worked time, for the line "Paid time changes from 8 h to 8 h 40 min". */
export function workedChangeWords(before: DayNumbers | null, after: DayNumbers | null): string {
  const a = before?.workedMinutes ?? 0;
  const b = after?.workedMinutes ?? 0;
  if (a === b) return 'Worked time stays the same.';
  return `Worked time changes from ${hoursAndMinutes(a)} to ${hoursAndMinutes(b)}.`;
}

/** The clock events of one shift, for the table: label, recorded time, source. */
export function eventRows(history: DayHistory, entryId: string | null): { id: string; label: string; recorded: string; type: 'IN' | 'OUT'; source: string; auto: boolean }[] {
  const events = entryId === null ? history.unscheduled : (history.entries.find((e) => e.entryId === entryId)?.events ?? []);
  return countingEvents(events).map((e) => ({
    id: e.id,
    label: e.type === 'IN' ? 'Clock in' : 'Clock out',
    recorded: hmOf(e.countsAt ?? e.recordedAt),
    type: e.type as 'IN' | 'OUT',
    source: SOURCE_WORDS[e.source] ?? e.source,
    auto: e.source === 'SYSTEM',
  }));
}
