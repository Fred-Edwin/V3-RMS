import type { DepartmentTag } from '@prisma/client';
import { logger } from '../../../utils/logger';
import type { RuleChangeNotice } from '../rules/rules.types';
import type { RuleGroupCode } from '../rules/rules-schemas';
import type { NairobiDate } from './time/nairobi-time';

export interface WorkforceEventPayloads {
  // slice 2: the rota has no publish step; one event per affected person after a quiet period (rota/changes/)
  'rota.shifts_changed': { siteId: string; employeeId: string; userId: string | null; dates: NairobiDate[]; changeCount: number; changedById: string };
  'clock.in': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; source: 'PHONE' | 'HEAD' | 'MANAGER' | 'SYSTEM' };
  'clock.out': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; closedBy: 'OUT' | 'AUTO_OUT' };
  // slice 3 (Attendance). The two `clock.*` events above stay declared for the kitchen and barista displays' future use;
  // Attendance emits these richer ones. None carries a pay figure.
  'attendance.clocked_in': {
    siteId: string;
    employeeId: string;
    userId: string | null;
    rotaEntryId: string | null;
    shiftDate: NairobiDate;
    occurredAt: string;
    source: 'PHONE' | 'HEAD' | 'MANAGER' | 'SYSTEM' | 'LEGACY';
    minutesLate: number;
    countsAsLate: boolean;
  };
  'attendance.clocked_out': {
    siteId: string;
    employeeId: string;
    userId: string | null;
    rotaEntryId: string | null;
    shiftDate: NairobiDate;
    occurredAt: string;
    closedBy: 'OUT' | 'AUTO_OUT';
    leftEarlyMinutes: number;
    afterEndMinutes: number;
  };
  'attendance.undone': { siteId: string; employeeId: string; userId: string | null; shiftDate: NairobiDate; undid: 'IN' | 'OUT' };
  'attendance.late': { siteId: string; employeeId: string; userId: string | null; rotaEntryId: string | null; shiftDate: NairobiDate; minutesLate: number; minutesAfterGrace: number };
  'attendance.stayed_on': { siteId: string; employeeId: string; userId: string | null; rotaEntryId: string; shiftDate: NairobiDate; reasonCode: string; estimateMinutes: number | null };
  'attendance.auto_closed': { siteId: string; employeeId: string; userId: string | null; rotaEntryId: string | null; shiftDate: NairobiDate; closedAt: string; cause: 'NO_ANSWER' | 'FORGOT' };
  'attendance.fixed': {
    siteId: string;
    employeeId: string;
    userId: string | null;
    shiftDate: NairobiDate;
    fixedById: string;
    kind: 'EDIT' | 'ADD' | 'VOID' | 'CLOCK_FOR';
    workedMinutesBefore: number;
    workedMinutesAfter: number;
    afterEndMinutesBefore: number;
    afterEndMinutesAfter: number;
  };
  'attendance.switch_changed': { siteId: string; enabled: boolean; changedById: string };
  'overtime.requested': { siteId: string; employeeId: string; overtimeRequestId: string; minutesRequested: number };
  'timesheet.approved': { siteId: string; periodId: string; employeeId: string | null; approvedById: string; scope: 'LINE' | 'PERIOD' };
  // slice 4a (Timesheets). Minutes and names only, never a pay figure.
  // Segment 1A: the site's manager approved the month. Payroll (Segment 2) reads this; hours only, never pay.
  'timesheets.month_approved': { siteId: string; periodId: string; monthKey: string; approvedById: string; documentNumber: number; headcount: number; workedMinutes: number; overtimeAuthorisedMinutes: number };
  'timesheet.day_decided': { siteId: string; periodId: string; employeeId: string; userId: string | null; shiftDate: NairobiDate; outcome: 'ACCEPT' | 'EXCUSE' | 'HOLD'; decidedById: string };
  'overtime.decided': { siteId: string; employeeId: string; userId: string | null; shiftDate: NairobiDate; outcome: 'APPROVED' | 'APPROVED_PART' | 'DECLINED'; authorisedMinutes: number; decidedById: string };
  'time_request.created': { siteId: string; requestId: string; employeeId: string; userId: string | null; kind: string; waitingOnRole: string; waitingOnUserId: string | null };
  'time_request.decided': { siteId: string; requestId: string; employeeId: string; userId: string | null; kind: string; outcome: 'APPROVED' | 'DECLINED'; decidedById: string };
  'time_request.escalated': { siteId: string; requestId: string; employeeId: string; userId: string | null; kind: string; waitingDays: number };
  'time_request.withdrawn': { siteId: string; requestId: string; employeeId: string };
  'payroll.published':{ siteId: string; payRunId: string; publishedById: string };
  'department.head_changed': {
    siteId: string;
    departmentId: string;
    departmentTag: DepartmentTag | null;
    previousHeadUserId: string | null;
    newHeadUserId: string | null;
    effectiveOn: NairobiDate;
  };
  // slice 0
  'rules.version_created': {
    companyId: string;
    siteId: string | null;
    group: RuleGroupCode;
    version: number;
    effectiveFrom: NairobiDate;
    createdById: string;
    notice: RuleChangeNotice;
    pay: boolean; // 1B: a pay field changed. Told without figures (D1); `changes` is then empty.
    changes: { field: string; from: unknown; to: unknown }[]; // old and new for fields that are not pay
  };
  'rules.version_confirmed': { versionId: string; group: RuleGroupCode; scope: string; confirmedById: string };
  'rules.version_withdrawn': { versionId: string; companyId: string; siteId: string | null; group: RuleGroupCode; version: number; effectiveFrom: NairobiDate; withdrawnById: string; notice: RuleChangeNotice };
  // slice 1 (People). None carries an amount or an ID number.
  'employee.hired': { siteId: string; employeeId: string; userId: string | null; departmentId: string | null; startDate: NairobiDate };
  'employee.transferred': {
    employeeId: string;
    userId: string | null;
    fromSiteId: string;
    toSiteId: string;
    fromDepartmentId: string | null;
    toDepartmentId: string | null;
    effectiveOn: NairobiDate;
  };
  'employee.loaned': { employeeId: string; userId: string | null; homeSiteId: string; hostSiteId: string; from: NairobiDate; until: NairobiDate | null };
  'employee.exit_recorded': { employeeId: string; userId: string | null; siteId: string; lastDay: NairobiDate; reason: string };
  'employee.exit_finalized': { employeeId: string; userId: string | null; siteId: string; lastDay: NairobiDate };
  'employee.exit_undone': { employeeId: string; userId: string | null; siteId: string };
  'employee.rehired': { employeeId: string; userId: string | null; siteId: string; startsOn: NairobiDate };
  'employee.tracks_time_changed': { employeeId: string; userId: string | null; siteId: string; tracksTime: boolean; effectiveOn: NairobiDate };
  'pay.change_requested': { employeeId: string; payChangeId: string; requestedById: string };
  'pay.change_decided': { employeeId: string; payChangeId: string; decision: 'APPROVED' | 'DECLINED'; decidedById: string };
}

export type WorkforceEventName = keyof WorkforceEventPayloads;
export type WorkforceEvent = { [N in WorkforceEventName]: { name: N; payload: WorkforceEventPayloads[N]; occurredAt: string } }[WorkforceEventName];

export interface WorkforceEventBus {
  emit<N extends WorkforceEventName>(name: N, payload: WorkforceEventPayloads[N]): void;
  on<N extends WorkforceEventName>(name: N, handler: (event: Extract<WorkforceEvent, { name: N }>) => void): () => void;
}

type AnyHandler = (event: WorkforceEvent) => void;

const handlers = new Map<WorkforceEventName, Set<AnyHandler>>();

/** Hands a ready-made event to its listeners. runAudited uses this after the transaction has committed. */
export function deliverEvent(event: WorkforceEvent): void {
  for (const handler of [...(handlers.get(event.name) ?? [])]) {
    try {
      handler(event);
    } catch (error) {
      // One failing listener must never undo or block the change that has already committed.
      logger.error({ err: error, event: event.name }, 'workforce event handler failed');
    }
  }
}

/** In-process, typed, synchronous handlers. Events are emitted by runAudited only AFTER the transaction commits. */
export const workforceEvents: WorkforceEventBus = {
  emit(name, payload) {
    deliverEvent({ name, payload, occurredAt: new Date().toISOString() } as WorkforceEvent);
  },
  on(name, handler) {
    const set = handlers.get(name) ?? new Set<AnyHandler>();
    handlers.set(name, set);
    const stored = handler as unknown as AnyHandler;
    set.add(stored);
    return () => {
      set.delete(stored);
    };
  },
};

/** Delivery of "X is told" is a later slice (Notifications). Until then this logs and does nothing else. */
export interface WorkforceNotifier {
  notify(recipientUserId: string, kind: string, data: Record<string, string | number | null>): Promise<void>;
}

const loggingNotifier: WorkforceNotifier = {
  async notify(recipientUserId, kind, data) {
    logger.info({ recipientUserId, kind, data }, 'workforce notification (not delivered yet)');
  },
};
let notifier: WorkforceNotifier = loggingNotifier;

export function setWorkforceNotifier(next: WorkforceNotifier): void {
  notifier = next;
}

export function getWorkforceNotifier(): WorkforceNotifier {
  return notifier;
}
