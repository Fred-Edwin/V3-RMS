import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryRow, EventRow, PersonDay, PersonRow } from '../attendance.types';
import { buildEntryDay } from './day-model';

export interface DayGroups {
  entries: EntryRow[];
  byEntry: Map<string, EventRow[]>;
  unscheduled: EventRow[];
}

/**
 * Which events belong to which shift on one person's day. An event with no shift of its own (the shift was removed from
 * the rota after the clock, or a fix on a free day) joins the day's only shift, or is listed as unscheduled when the day
 * has none or several.
 */
export function groupDay(employeeId: string, date: NairobiDate, data: DayData): DayGroups {
  const entries = data.entries.filter((e) => e.employeeId === employeeId && e.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const entryIds = new Set(entries.map((e) => e.id));
  const onlyEntry = entries.length === 1 ? entries[0]!.id : null;
  const byEntry = new Map<string, EventRow[]>(entries.map((e) => [e.id, []]));
  const unscheduled: EventRow[] = [];
  for (const event of data.events.filter((e) => e.employeeId === employeeId && e.shiftDate === date)) {
    const target = event.rotaEntryId !== null && entryIds.has(event.rotaEntryId) ? event.rotaEntryId : onlyEntry;
    if (target === null) unscheduled.push(event);
    else byEntry.get(target)!.push(event);
  }
  return { entries, byEntry, unscheduled };
}

/** One person's day: each rostered shift built against its own events, at the moment `now`. */
export function buildPersonDay(person: PersonRow, date: NairobiDate, data: DayData, rules: AttendanceRuleSet, now: Date): PersonDay {
  const { entries, byEntry, unscheduled } = groupDay(person.id, date, data);
  const answers = new Map(data.answers.map((a) => [a.rotaEntryId, a] as const));
  return {
    person,
    date,
    entries: entries.map((entry) => buildEntryDay(entry, byEntry.get(entry.id) ?? [], answers.get(entry.id) ?? null, rules, now)),
    unscheduled,
  };
}
