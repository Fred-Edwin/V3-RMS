import type { DepartmentTag } from '@prisma/client';
import { logger } from '../../../utils/logger';
import type { RuleChangeNotice } from '../rules/rules.types';
import type { RuleGroupCode } from '../rules/rules-schemas';
import type { NairobiDate } from './time/nairobi-time';

export interface WorkforceEventPayloads {
  'rota.published': { siteId: string; departmentId: string | null; weekStart: NairobiDate; publishedById: string; changedAfterPublish: boolean };
  'clock.in': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; source: 'PHONE' | 'HEAD' | 'MANAGER' | 'SYSTEM' };
  'clock.out': { siteId: string; employeeId: string; userId: string | null; shiftAssignmentId: string | null; occurredAt: string; closedBy: 'OUT' | 'AUTO_OUT' };
  'overtime.requested': { siteId: string; employeeId: string; overtimeRequestId: string; minutesRequested: number };
  'timesheet.approved': { siteId: string; periodId: string; employeeId: string | null; approvedById: string; scope: 'LINE' | 'PERIOD' };
  'payroll.published': { siteId: string; payRunId: string; publishedById: string };
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
  };
  'rules.version_confirmed': { versionId: string; group: RuleGroupCode; scope: string; confirmedById: string };
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
