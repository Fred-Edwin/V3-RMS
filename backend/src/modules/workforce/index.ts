/**
 * The public door of Workforce. Other modules import from here and from nowhere else inside `modules/workforce/`
 * (`.dependency-cruiser.cjs` enforces it). Slice 0 exports what it builds, declares the types for what later slices
 * build, and stubs the calls that need data from later slices (they throw NotBuiltYetError). Slice 1 made
 * `getEmployee` real and added the People exports.
 * Spec: docs/features/workforce/slice-0-contract.md section 7.
 */
import { NotBuiltYetError } from './_shared/errors';
import type { NairobiDate } from './_shared/time/nairobi-time';

// HTTP: the routers `routes/index.ts` mounts (the one shared touch-point). Amendment 1 in the contract's log.
export { default as workforcePermissionsRouter } from './_shared/permissions-routes';
export { default as workforceRulesRouter } from './rules/rules-routes';
export { default as workforcePeopleRouter } from './people/people-routes';
export { default as workforceOrgRouter } from './people/org-routes'; // Organisation: departments, heads, positions (slice 1b)
export { default as workforceRotaRouter } from './rota/rota-routes'; // Rota: shift templates, the week grid, edits (slice 2)
export { carryOverLegacyRota } from './rota/legacy/legacy-carry-over'; // the repeatable legacy-to-rota copy (slice 2)
export { default as workforceAttendanceRouter } from './attendance/attendance-routes'; // Attendance: clock, Today board, fixes, lateness, the switch (slice 3)
export { refuseLegacyClockWhenSwitched } from './attendance/switch/legacy-clock-guard'; // the four legacy clock routes answer 409 for a switched site
export { sweepAutoClose } from './attendance/prompt/auto-close-service'; // the minute job: closes unanswered and forgotten shifts
export { setPeriodClosedCheck, type PeriodClosedCheck } from './attendance/fixes/period-lock'; // slice 4 registers the closed-period answer
export { default as workforceTimesheetsRouter } from './timesheets/timesheets-routes'; // Timesheets, overtime and requests (slice 4a)
export { registerTimesheets } from './timesheets/register-timesheets'; // the closed-period answer for attendance fixes
export { sweepTimesheets } from './timesheets/timesheets-sweep'; // the ten-minute job: refreshes open months, escalates old requests (closes nothing)
export { getApprovedHours, type ApprovedHours } from './timesheets/approved-hours'; // reporting and payroll read approved hours only, never raw clock events
export { isSitePeriodOnNewPayroll } from './payroll/rollout/rollout-guard'; // the old payslip code asks this before it saves, publishes or reverts (Segment 2A)
export { default as workforcePayrollRouter } from './payroll/payroll-routes'; // Payroll part 1: the month, the engine, the review and the approval (Segment 2A)
export { sweepPayroll, refreshEstimates as refreshPayrollEstimates } from './payroll/payroll-sweep'; // the job: month rows, automatic calculation, nightly estimate
export { getOnShiftNow } from './attendance/board/on-shift-now';
export type { OnShiftPerson } from './attendance/attendance.types';

// People (slice 1)
export { registerPeople } from './people/register-people';
export { getEmployee, getActiveLoans, payAmountOn, type EmployeeSummary, type ActiveLoan } from './people/people-door';
export { registerImpactProvider, type ImpactProvider, type ImpactQuery, type ImpactLine, type ImpactKind } from './people/people-hooks';
export { runPeopleScheduler, PEOPLE_SCHEDULER_TASKS, type TaskReport, type PeopleTask } from './people/scheduler/people-scheduler';

// Access table
export {
  CAPABILITIES,
  SCOPES,
  ROLE_GRANTS,
  grantsOf,
  scopeOf,
  workforceCan,
  inScope,
  assertInScope,
  assertNotSelf,
  requireCapability,
  lockedGroupsFor,
  redactSensitive,
  defaultTracksTime,
  type AccessSubject,
  type AccessTarget,
  type Capability,
  type Grants,
  type Scope,
  type SensitiveGroup,
  type Redacted,
} from './_shared/workforce-access';
export { tracksTime, requireTracksTime, setTracksTimeResolver } from './_shared/tracks-time';

// Time engine (pure)
export * from './_shared/time/nairobi-time';
export * from './_shared/time/time-types';
export { computeLateness, assertNoOvernight, shiftInstants } from './_shared/time/lateness';
export { resolveClockPairs, computeDayHours } from './_shared/time/day-hours';
export { makeUpMinutes, overtimeCandidate, weeklyOvertime, type OvertimeCandidate, type OvertimeEvidence, type WeeklyOvertime } from './_shared/time/overtime';
export { weeklyTotals, periodTotals, deductibleLateness, type WeekTotal, type PeriodTotal, type LateDay, type DeductibleLateness } from './_shared/time/totals';
export { periodContaining, periodsBetween, isInPeriod, type Period, type PeriodRule } from './_shared/time/periods';

// Audit
export { writeAuditEntry, runAudited, type AuditedChange } from './_shared/audit/audit-writer';
export { verifyAuditChain, GENESIS_HASH, type ChainVerdict } from './_shared/audit/audit-hash';
export { auditReadScopeOf, type AuditReadScope, type AuditReader, type AuditQuery, type AuditPage } from './_shared/audit/audit-read';
export { AUDIT_ACTIONS, type AuditActionCode } from './_shared/audit/audit-actions';
export { AUDIT_CATEGORIES, type AuditCategoryCode, type AuditEntryInput, type AuditEntryRecord, type AuditContext } from './_shared/audit/audit.types';

// Rules
export { getEffectiveRules, getEffectiveRuleGroup, isPayConfirmed } from './rules/rules-service';
export { RULE_DEFAULTS } from './rules/rules-defaults';
export {
  RULE_SCHEMAS,
  type RuleGroupCode,
  type RuleValues,
  type LatenessRules,
  type OvertimeRules,
  type AttendanceRules,
  type WeekAndBreaksRules,
} from './rules/rules-schemas';
export type { EffectiveRules, EffectiveRuleGroup, PayReadiness } from './rules/rules.types';

// Events
export {
  workforceEvents,
  setWorkforceNotifier,
  type WorkforceEvent,
  type WorkforceEventName,
  type WorkforceEventPayloads,
  type WorkforceNotifier,
} from './_shared/events';

// Calls that need later slices: declared now, stubbed (they throw NotBuiltYetError)
/** Slice 5. */
export async function isOnLeave(_userId: string, _date: NairobiDate): Promise<boolean> {
  throw new NotBuiltYetError('isOnLeave', 5);
}
