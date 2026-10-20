import type { ApplicationRow } from '../data/applications-repository';
import { phaseOf, type LeavePhase } from '../engine/leave-phase';
import { effectiveStage, movesToHrAt } from '../engine/leave-routing';
import type { DeciderRole } from '../leave.constants';
import { DECIDER_WORDS } from '../leave-words';
import type { LeaveStageCode } from '../leave.types';
import { nairobiToday } from '../../_shared/time/nairobi-time';

/** What a screen needs to name a request in a list or after an action. Dates are Nairobi dates. */
export interface ApplicationSummary {
  id: string;
  employeeId: string;
  typeCode: string;
  typeLabel: string;
  paid: boolean;
  start: string;
  end: string;
  days: number;
  unpaidTailDays: number;
  status: ApplicationRow['status'];
  phase: LeavePhase;
  stage: LeaveStageCode;
  /** Who decides it right now, in words ("Branch Manager"). */
  decidingRole: string | null;
  askedAt: string;
  /** When a waiting request with a site manager moves to HR on its own; null once moved or when it never moves. */
  movesToHrAt: string | null;
  decidedAt: string | null;
  slipNumber: number | null;
  version: number;
}

/** The short shape of a request, with its stage worked out for `now` (the 72 hours is derived, L20). */
export function summaryOf(application: ApplicationRow, now: Date): ApplicationSummary {
  const stage = effectiveStage(application, now);
  const siteManager = application.routedToRole === 'MANAGER' || application.routedToRole === 'STORE_MANAGER';
  const decider: DeciderRole | null = application.status !== 'WAITING' ? null : stage === 'HR' ? 'HR_MANAGER' : stage === 'DIRECTOR' ? 'DIRECTOR' : (application.routedToRole as DeciderRole);
  return {
    id: application.id,
    employeeId: application.employeeId,
    typeCode: application.typeCode,
    typeLabel: application.type.label,
    paid: application.type.paid,
    start: application.start,
    end: application.end,
    days: application.days,
    unpaidTailDays: application.unpaidTailDays,
    status: application.status,
    phase: phaseOf(application, nairobiToday(now)),
    stage,
    decidingRole: decider ? DECIDER_WORDS[decider] : null,
    askedAt: application.askedAt.toISOString(),
    movesToHrAt: application.status === 'WAITING' && siteManager && stage === 'MANAGER' ? movesToHrAt(application.askedAt).toISOString() : null,
    decidedAt: application.decidedAt?.toISOString() ?? null,
    slipNumber: application.slipNumber,
    version: application.version,
  };
}
