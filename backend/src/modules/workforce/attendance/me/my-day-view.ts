import { eachDay, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AttendanceRuleSet, DayData, EntryDay, EntryState, PersonRow } from '../attendance.types';
import { buildPersonDay } from '../days/person-day';

const MS_PER_MINUTE = 60_000;
const OPEN_STATES: readonly EntryState[] = ['ON_SHIFT', 'PROMPT_DUE', 'STAYING_ON'];
const WAITING_STATES: readonly EntryState[] = ['CLOCK_IN_OPEN', 'NOT_IN', 'UPCOMING'];

export interface MyEntry {
  entryId: string;
  templateName: string;
  colour: string;
  startTime: string;
  endTime: string;
  state: EntryState;
  opensAt: string;
  startsAt: string;
  endsAt: string;
  /** From here the heads-up banner shows (a dismissible "wrap up" notice). */
  headsUpFrom: string;
  /** The prompt closes the shift at the scheduled end if nobody answers by here. */
  autoCloseAt: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  closedBy: 'OUT' | 'AUTO_OUT' | null;
  /** The live counter, measured on the server's clock so a wrong phone clock cannot change it. */
  secondsOnShift: number;
  workedMinutes: number;
  minutesLate: number;
  countsAsLate: boolean;
  /** The Undo button: what it would undo and until when. */
  undo: { kind: 'IN' | 'OUT'; until: string } | null;
  stayedOn: { reasonCode: string | null; estimateMinutes: number | null } | null;
}

export interface WeekBar {
  date: NairobiDate;
  plannedMinutes: number;
  workedMinutes: number;
  /** OFF no shift · PLANNED later · TODAY · WORKED · MISSED (a shift with no clock). */
  state: 'OFF' | 'PLANNED' | 'TODAY' | 'WORKED' | 'MISSED';
}

export interface MyNotice {
  type: 'AUTO_CLOSED';
  entryId: string;
  date: NairobiDate;
  templateName: string;
  endTime: string;
  closedAt: string;
}

export const myEntryOf = (day: EntryDay, now: Date, headsUpMinutes: number): MyEntry => {
  const secondsOnShift = day.clockedInAt ? Math.max(0, Math.floor(((day.clockedOutAt ?? now).getTime() - day.clockedInAt.getTime()) / 1000)) : 0;
  return {
    entryId: day.entryId,
    templateName: day.templateName,
    colour: day.colour,
    startTime: day.shift.startTime,
    endTime: day.shift.endTime,
    state: day.state,
    opensAt: day.opensAt.toISOString(),
    startsAt: day.startsAt.toISOString(),
    endsAt: day.endsAt.toISOString(),
    headsUpFrom: new Date(day.endsAt.getTime() - headsUpMinutes * MS_PER_MINUTE).toISOString(),
    autoCloseAt: day.autoCloseAt.toISOString(),
    clockedInAt: day.clockedInAt?.toISOString() ?? null,
    clockedOutAt: day.clockedOutAt?.toISOString() ?? null,
    closedBy: day.closedBy,
    secondsOnShift,
    workedMinutes: day.hours.workedMinutes,
    minutesLate: day.lateness?.minutesLate ?? 0,
    countsAsLate: day.lateness?.countsAsLate ?? false,
    undo: day.undo ? { kind: day.undo.kind, until: day.undo.until.toISOString() } : null,
    stayedOn: day.answer?.answer === 'STAY_ON' ? { reasonCode: day.answer.reasonCode, estimateMinutes: day.answer.estimateMinutes } : null,
  };
};

/** The shift the card shows: the one being worked, else the next one waiting, else the last one of the day. */
export const currentOf = (entries: readonly EntryDay[]): EntryDay | null =>
  entries.find((e) => OPEN_STATES.includes(e.state)) ?? entries.find((e) => WAITING_STATES.includes(e.state)) ?? entries[entries.length - 1] ?? null;

/** Seven bars, planned against worked, for the week the card is in. */
export function weekBars(person: PersonRow, weekFirst: NairobiDate, weekLast: NairobiDate, today: NairobiDate, data: DayData, rules: AttendanceRuleSet, now: Date): WeekBar[] {
  return eachDay(weekFirst, weekLast).map((date) => {
    const entries = buildPersonDay(person, date, data, rules, now).entries;
    const plannedMinutes = entries.reduce((sum, e) => sum + e.hours.scheduledMinutes, 0);
    const workedMinutes = entries.reduce((sum, e) => sum + e.hours.workedMinutes, 0);
    const state: WeekBar['state'] =
      entries.length === 0 ? 'OFF' : date === today ? 'TODAY' : date > today ? 'PLANNED' : workedMinutes > 0 || entries.some((e) => e.clockedInAt) ? 'WORKED' : 'MISSED';
    return { date, plannedMinutes, workedMinutes, state };
  });
}

/** Shifts the phone closed on the person that nobody has put right yet: the "Your shift was closed at 14:00" screen. */
export function noticesOf(days: readonly EntryDay[]): MyNotice[] {
  return days
    .filter((d) => d.flags.autoClosed && !d.flags.fixed && d.clockedOutAt)
    .map((d) => ({ type: 'AUTO_CLOSED' as const, entryId: d.entryId, date: d.date, templateName: d.templateName, endTime: d.shift.endTime, closedAt: (d.clockedOutAt as Date).toISOString() }));
}
