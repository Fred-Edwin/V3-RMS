import type { CellChange, GridPerson, TemplateView, WeekView } from '../types/rota-types';
import { isPastDay, needsReasonOn, shortDay } from './rota-dates';

/**
 * Working out an edit before it is sent. Every edit saves at once (no publish step), so the screen only stops to ask when the server
 * would: a change to today or tomorrow needs a reason, and a shift on an approved-leave day needs an override reason. The server still
 * checks both; this only lets the screen ask first, with the names in front of the person.
 */

export const REASON_MIN = 3;
export const REASON_MAX = 200;

export const cellChange = (employeeId: string, date: string, templateId: string | null): CellChange => ({ employeeId, date, templateIds: templateId ? [templateId] : [] });

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

const personOf = (week: WeekView, employeeId: string): GridPerson | undefined => week.people.find((p) => p.employeeId === employeeId);
const currentIds = (person: GridPerson | undefined, date: string): string[] => (person?.cells[date] ?? []).map((s) => s.templateId);

/** Drops cells that already hold what is asked, and cells on days that have passed. Nothing left means nothing to send. */
export function effectiveChanges(week: WeekView, changes: readonly CellChange[]): CellChange[] {
  return changes.filter((c) => !isPastDay(c.date, week.today) && !sameSet(currentIds(personOf(week, c.employeeId), c.date), c.templateIds));
}

export interface EditGate {
  /** Days that fall today or tomorrow. */
  reasonDates: string[];
  /** Cells that would put a shift on an approved-leave day. */
  leaveCells: { employeeId: string; name: string; date: string }[];
}

export function gateOf(week: WeekView, changes: readonly CellChange[]): EditGate {
  const reasonDates = Array.from(new Set(changes.filter((c) => needsReasonOn(c.date, week.today)).map((c) => c.date))).sort();
  const leaveCells = changes
    .filter((c) => c.templateIds.length > 0)
    .flatMap((c) => {
      const person = personOf(week, c.employeeId);
      return person && person.leaveDates.includes(c.date) ? [{ employeeId: c.employeeId, name: person.name, date: c.date }] : [];
    });
  return { reasonDates, leaveCells };
}

export interface ChangeLine {
  text: string;
  /** First name, for "Amina is told". */
  told: string;
  employeeId: string;
}

/** "Amina Hassan · Tue 13: Morning becomes Afternoon", "Dan Kiprop · Tue 13: day off becomes Morning", "Joy Chebet · Mon 12: Afternoon removed". */
export function changeLines(week: WeekView, changes: readonly CellChange[], templates: ReadonlyMap<string, TemplateView>): ChangeLine[] {
  const nameOf = (ids: readonly string[]): string => ids.map((id) => templates.get(id)?.name ?? 'a shift').join(' and ');
  return changes.flatMap((c) => {
    const person = personOf(week, c.employeeId);
    if (!person) return [];
    const before = currentIds(person, c.date);
    const head = `${person.name} · ${shortDay(c.date)}:`;
    const text =
      c.templateIds.length === 0 ? `${head} ${nameOf(before)} removed` : before.length === 0 ? `${head} day off becomes ${nameOf(c.templateIds)}` : `${head} ${nameOf(before)} becomes ${nameOf(c.templateIds)}`;
    return [{ text, told: person.name.split(' ')[0] ?? person.name, employeeId: c.employeeId }];
  });
}

/** "Amina is told", "Dan and Joy are told". */
export function toldWords(first: readonly string[]): string {
  const names = Array.from(new Set(first));
  if (names.length === 1) return `${names[0]} is told`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are told`;
}

export const peopleToldCount = (lines: readonly ChangeLine[]): number => new Set(lines.map((l) => l.employeeId)).size;

/** A reason has to be 3 to 200 characters once trimmed; null when it is fine. */
export function reasonProblem(text: string | null): string | null {
  const trimmed = (text ?? '').trim();
  if (trimmed.length < REASON_MIN) return `Give a reason of at least ${REASON_MIN} characters.`;
  if (trimmed.length > REASON_MAX) return `Keep the reason to ${REASON_MAX} characters or fewer.`;
  return null;
}

/** The days a drag covers, from the first to the last column touched in one row, never before today. */
export function dragDates(days: readonly string[], from: number, to: number, today: string): string[] {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return days.slice(a, b + 1).filter((d) => !isPastDay(d, today));
}

/** "Copy day": the source day's shifts onto the target day, empty cells only (the same rule as "start from last week"). */
export function copyDayChanges(week: WeekView, people: readonly GridPerson[], from: string, to: string): CellChange[] {
  if (from === to || isPastDay(to, week.today)) return [];
  return people.flatMap((p) => {
    const source = (p.cells[from] ?? []).map((s) => s.templateId);
    const target = p.cells[to] ?? [];
    return source.length > 0 && target.length === 0 && !p.leaveDates.includes(to) ? [{ employeeId: p.employeeId, date: to, templateIds: source }] : [];
  });
}
