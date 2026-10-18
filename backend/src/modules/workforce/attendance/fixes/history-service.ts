import type { AccessSubject } from '../../_shared/workforce-access';
import { personInScope } from '../attendance-scope';
import type { EventRow } from '../attendance.types';
import { buildEntryDay, inAppendOrder } from '../days/day-model';
import { attendanceRulesFor } from '../days/day-rules';
import { daysRepository } from '../days/days-repository';
import { groupDay } from '../days/person-day';
import type { DayQuery } from './fixes-validators';

export interface HistoryEvent {
  id: string;
  type: string;
  source: string;
  /** The time as first recorded, and the time that counts now (the same unless a correction replaced it). */
  recordedAt: string;
  countsAt: string | null;
  status: 'COUNTS' | 'REPLACED' | 'REMOVED' | 'CORRECTION';
  reasonCode: string | null;
  reason: string | null;
  recordedBy: string | null;
  correctsEventId: string | null;
  skewFlagged: boolean;
  createdAt: string;
}

export interface DayHistory {
  employeeId: string;
  name: string;
  date: string;
  entries: {
    entryId: string;
    templateName: string;
    startTime: string;
    endTime: string;
    state: string;
    workedMinutes: number;
    afterEndMinutes: number;
    leftEarlyMinutes: number;
    minutesLate: number;
    countsAsLate: boolean;
    events: HistoryEvent[];
  }[];
  /** Clock events with no rostered shift to belong to. */
  unscheduled: HistoryEvent[];
}

function annotate(events: readonly EventRow[], names: Map<string, string>): HistoryEvent[] {
  const ordered = inAppendOrder(events);
  const latest = new Map<string, EventRow>();
  for (const event of ordered) if (event.type === 'CORRECTION' && event.correctsEventId) latest.set(event.correctsEventId, event);
  return ordered.map((event) => {
    const correction = latest.get(event.id);
    const status: HistoryEvent['status'] = event.type === 'CORRECTION' ? 'CORRECTION' : correction?.voidsCorrected ? 'REMOVED' : correction ? 'REPLACED' : 'COUNTS';
    return {
      id: event.id,
      type: event.type,
      source: event.source,
      recordedAt: event.occurredAt.toISOString(),
      countsAt: status === 'COUNTS' ? event.occurredAt.toISOString() : status === 'REPLACED' ? (correction as EventRow).occurredAt.toISOString() : null,
      status,
      reasonCode: event.reasonCode,
      reason: event.reason,
      recordedBy: event.recordedById ? (names.get(event.recordedById) ?? null) : null,
      correctsEventId: event.correctsEventId,
      skewFlagged: event.skewFlagged,
      createdAt: event.createdAt.toISOString(),
    };
  });
}

/** A person's day with every event, replaced and removed ones included ("See history"): the old value stays visible. */
export async function dayHistory(subject: AccessSubject, query: DayQuery, now: Date = new Date()): Promise<DayHistory> {
  const person = await personInScope(subject, 'timesheet.read', query.employeeId, 'read');
  const [data, rules] = await Promise.all([daysRepository.loadDayData(person.siteId, query.date, query.date, [person.id]), attendanceRulesFor(person.siteId, query.date)]);
  const groups = groupDay(person.id, query.date, data);
  const names = await daysRepository.userNames([...new Set(data.events.map((e) => e.recordedById).filter((id): id is string => id !== null))]);
  return {
    employeeId: person.id,
    name: person.name,
    date: query.date,
    entries: groups.entries.map((entry) => {
      const events = groups.byEntry.get(entry.id) ?? [];
      const day = buildEntryDay(entry, events, data.answers.find((a) => a.rotaEntryId === entry.id) ?? null, rules, now);
      return {
        entryId: entry.id,
        templateName: entry.templateName,
        startTime: entry.startTime,
        endTime: entry.endTime,
        state: day.state,
        workedMinutes: day.hours.workedMinutes,
        afterEndMinutes: day.hours.afterEndMinutes,
        leftEarlyMinutes: day.hours.leftEarlyMinutes,
        minutesLate: day.lateness?.minutesLate ?? 0,
        countsAsLate: day.lateness?.countsAsLate ?? false,
        events: annotate(events, names),
      };
    }),
    unscheduled: annotate(groups.unscheduled, names),
  };
}
