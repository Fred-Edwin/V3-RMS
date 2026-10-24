/**
 * What the Attendance endpoints send, as the wire carries it (the back end calls a site `siteId`; on the wire it is `organizationId`,
 * see `backend/src/shared/utils/wire-names.ts`). Dates are Nairobi calendar strings ("2026-10-12"), instants are ISO strings.
 */

export type EntryState = 'UPCOMING' | 'CLOCK_IN_OPEN' | 'NOT_IN' | 'ON_SHIFT' | 'PROMPT_DUE' | 'STAYING_ON' | 'DONE' | 'AUTO_CLOSED' | 'MISSED';

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
  headsUpFrom: string;
  autoCloseAt: string;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  closedBy: 'OUT' | 'AUTO_OUT' | null;
  secondsOnShift: number;
  workedMinutes: number;
  minutesLate: number;
  countsAsLate: boolean;
  undo: { kind: 'IN' | 'OUT'; until: string } | null;
  stayedOn: { reasonCode: string | null; estimateMinutes: number | null } | null;
}

export interface WeekBarData {
  date: string;
  plannedMinutes: number;
  workedMinutes: number;
  state: 'OFF' | 'PLANNED' | 'TODAY' | 'WORKED' | 'MISSED';
}

export interface MyNotice {
  type: 'AUTO_CLOSED';
  entryId: string;
  date: string;
  templateName: string;
  endTime: string;
  closedAt: string;
}

export type Leftover =
  | { kind: 'OPEN_TABLES'; items: { orderId: string; orderNumber: number; table: string | null; unpaid: number }[] }
  | { kind: 'OPEN_TICKETS'; items: { ticketId: string; station: string; status: string }[] }
  | { kind: 'PENDING_DISPATCHES'; items: { dispatchId: string; reference: string | null; toSiteName: string | null }[] };

export interface MyDay {
  /** False: this branch still clocks the old way (or the person has no file): the screen keeps the old clock. */
  enabled: boolean;
  serverNow: string;
  date?: string;
  /** `siteName` on the server; every site field is named `organization…` on the wire. */
  organizationName?: string;
  rules?: { clockInOpensMinutesBefore: number; undoWindowSeconds: number; shiftEndHeadsUpMinutes: number; shiftEndPromptRepeatMinutes: number; autoCloseAfterMinutes: number };
  current: MyEntry | null;
  today: MyEntry[];
  next: { date: string; templateName: string; startTime: string; endTime: string } | null;
  week: { first: string; last: string; plannedMinutes: number; workedMinutes: number; days: WeekBarData[] };
  leftovers: Leftover[];
  notices: MyNotice[];
}

export interface ClockResult {
  replayed: boolean;
  event: { id: string; type: string; occurredAt: string; rotaEntryId: string | null; shiftDate: string; skewFlagged: boolean };
  undoUntil: string | null;
  lateness?: { minutesLate: number; countsAsLate: boolean; minutesAfterGrace: number };
  leftEarlyMinutes?: number;
}

export interface TapBody {
  clientEventId: string;
  rotaEntryId?: string;
  deviceAt?: string;
  sentAt?: string;
  latitude?: number;
  longitude?: number;
}

export interface ClockOutBody extends TapBody {
  reasonCode?: string;
  reason?: string;
}

export interface StayOnBody {
  rotaEntryId: string;
  answer: 'STAY_ON';
  reasonCode: string;
  estimateMinutes?: 15 | 30 | 60;
}

export type BoardState = 'NOT_STARTED' | 'NOT_IN' | 'ON_SHIFT' | 'LATE' | 'ENDING' | 'STAYED_ON' | 'FINISHED' | 'AUTO_CLOSED' | 'MISSED';

export interface BoardShift {
  entryId: string;
  templateName: string;
  startTime: string;
  endTime: string;
  state: BoardState;
  clockedInAt: string | null;
  clockedOutAt: string | null;
  minutesLate: number;
  minutesAfterGrace: number;
  late: boolean;
  recordedForBy: string | null;
  skewFlagged: boolean;
}

export interface BoardPerson {
  employeeId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  positionName: string | null;
  /** True for the head of the person's department; the person label then reads "Barista · Head". */
  isHead: boolean;
  state: BoardState | 'NO_SHIFT';
  shifts: BoardShift[];
}

export interface BoardDepartment {
  departmentId: string | null;
  name: string;
  head: { name: string; isActing: boolean } | null;
  present: number;
  expected: number;
  late: number;
  notIn: number;
  complete: boolean;
}

export interface BoardAttention {
  kind: 'AUTO_CLOSED';
  employeeId: string;
  name: string;
  entryId: string;
  date: string;
  templateName: string;
  closedAt: string | null;
}

export interface Board {
  enabled: boolean;
  organizationId: string;
  date: string;
  asOf: string;
  tiles: {
    onShift: { count: number; expected: number };
    late: { count: number; minutesPastGrace: number };
    notIn: { count: number };
    onLeave: { count: number; available: boolean };
  };
  departments: BoardDepartment[];
  people: BoardPerson[];
  attention: BoardAttention[];
}

export interface ClockForBody {
  employeeId: string;
  type: 'IN' | 'OUT';
  at: string;
  reason: string;
  rotaEntryId?: string;
}

export interface DayNumbers {
  workedMinutes: number;
  afterEndMinutes: number;
  leftEarlyMinutes: number;
  minutesLate: number;
  countsAsLate: boolean;
  clockedInAt: string | null;
  clockedOutAt: string | null;
}

export interface FixView {
  employeeId: string;
  date: string;
  action: 'EDIT' | 'ADD' | 'VOID';
  before: DayNumbers | null;
  after: DayNumbers | null;
}

export interface FixResult extends FixView {
  eventId: string;
}

export type FixBody =
  | { action: 'EDIT'; employeeId: string; date: string; eventId: string; at: string; reason: string; rotaEntryId?: string }
  | { action: 'ADD'; employeeId: string; date: string; type: 'IN' | 'OUT'; at: string; reason: string; rotaEntryId?: string }
  | { action: 'VOID'; employeeId: string; date: string; eventId: string; reason: string; rotaEntryId?: string };

export interface HistoryEvent {
  id: string;
  type: string;
  source: string;
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
  unscheduled: HistoryEvent[];
}

export interface LatenessLine {
  employeeId: string;
  name: string;
  departmentId: string | null;
  date: string;
  entryId: string;
  templateName: string;
  startTime: string;
  clockedInAt: string;
  minutesLate: number;
  countsAsLate: boolean;
  graceMinutes: number;
  minutesAfterGrace: number;
  earlyMinutes: number;
  recordedForBy: string | null;
}

export interface LatenessReport {
  enabled: boolean;
  organizationId: string;
  from: string;
  to: string;
  lines: LatenessLine[];
  summary: { employeeId: string; name: string; lateDays: number; minutesAfterGrace: number }[];
}

export interface SwitchView {
  organizationId: string;
  organizationName: string;
  enabled: boolean;
  enabledAt: string | null;
  changedAt: string | null;
  carriedFromLegacy?: number;
  mirroredToLegacy?: number;
  notMirrored?: string[];
}
