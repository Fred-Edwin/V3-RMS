import type { ClockEventSource, ClockEventType, DepartmentTag, UserRole } from '@prisma/client';
import type { AttendanceRules, LatenessRules } from '../rules/rules-schemas';
import type { NairobiDate } from '../_shared/time/nairobi-time';
import type { DayHours, LatenessResult, ShiftWindow } from '../_shared/time/time-types';

/** The two rule groups attendance reads for a site on a day. */
export interface AttendanceRuleSet {
  attendance: AttendanceRules;
  lateness: LatenessRules;
}

/** A clock event as the services see it (the database row with dates as Nairobi dates). */
export interface EventRow {
  id: string;
  employeeId: string;
  rotaEntryId: string | null;
  shiftDate: NairobiDate;
  type: ClockEventType;
  source: ClockEventSource;
  occurredAt: Date;
  serverAt: Date;
  createdAt: Date;
  clientEventId: string | null;
  correctsEventId: string | null;
  voidsCorrected: boolean;
  skewFlagged: boolean;
  reasonCode: string | null;
  reason: string | null;
  recordedById: string | null;
}

export interface AnswerRow {
  rotaEntryId: string;
  answer: 'STAY_ON' | 'FINISH_NOW';
  reasonCode: string | null;
  estimateMinutes: number | null;
  answeredAt: Date;
}

/** One rostered shift on one person's day. */
export interface EntryRow {
  id: string;
  employeeId: string;
  date: NairobiDate;
  templateName: string;
  colour: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
}

export interface PersonRow {
  id: string;
  name: string;
  userId: string | null;
  siteId: string;
  departmentId: string | null;
  departmentName: string | null;
  tracksTime: boolean;
}

/**
 * Where a rostered shift stands at a given moment.
 *  UPCOMING        clock-in not open yet (it opens `opensAt`)
 *  CLOCK_IN_OPEN   open, the shift has not started
 *  NOT_IN          the shift has started and there is no clock-in (clocking in now counts as late)
 *  ON_SHIFT        clocked in, before the scheduled end
 *  PROMPT_DUE      clocked in, the scheduled end has passed and nobody has answered (the full-screen prompt)
 *  STAYING_ON      clocked in past the end after answering "Stay on"
 *  DONE            clocked out
 *  AUTO_CLOSED     the phone closed it at the scheduled end (no answer, or a forgotten clock-out)
 *  MISSED          the shift is over and there was no clock-in
 */
export type EntryState = 'UPCOMING' | 'CLOCK_IN_OPEN' | 'NOT_IN' | 'ON_SHIFT' | 'PROMPT_DUE' | 'STAYING_ON' | 'DONE' | 'AUTO_CLOSED' | 'MISSED';

export interface EntryDay {
  entryId: string;
  employeeId: string;
  date: NairobiDate;
  templateName: string;
  colour: string;
  shift: ShiftWindow;
  state: EntryState;
  opensAt: Date;
  startsAt: Date;
  endsAt: Date;
  /** When a prompt nobody answered closes the shift (the scheduled end plus the rule). */
  autoCloseAt: Date;
  clockedInAt: Date | null;
  clockedOutAt: Date | null;
  closedBy: 'OUT' | 'AUTO_OUT' | null;
  hours: DayHours;
  lateness: LatenessResult | null;
  answer: AnswerRow | null;
  /** The last tap that can still be undone: its kind and the instant the window closes. Null when none. */
  undo: { kind: 'IN' | 'OUT'; eventId: string; until: Date } | null;
  /**
   * autoClosed: the phone closed it. reviewed: a manager put that close right (a correction points at it). fixed: a manager
   * or head touched the day in any way (clocked someone, corrected a time). The person's own undo is none of these.
   */
  flags: { skew: boolean; autoClosed: boolean; reviewed: boolean; fixed: boolean; recordedForBy: string | null };
}

/** The day of one person at one site: their shifts and any clock time that belongs to no shift. */
export interface PersonDay {
  person: PersonRow;
  date: NairobiDate;
  entries: EntryDay[];
  /** Events on the day with no rostered shift to belong to (the shift was removed after the clock, or a fix on a free day). */
  unscheduled: EventRow[];
}

/** Who is clocked in now, for the kitchen and barista displays (the door's `getOnShiftNow`). */
export interface OnShiftPerson {
  userId: string;
  name: string;
  role: UserRole;
  departmentTag: DepartmentTag | null;
  clockedInAt: string;
}

export interface DayData {
  entries: EntryRow[];
  events: EventRow[];
  answers: AnswerRow[];
}
