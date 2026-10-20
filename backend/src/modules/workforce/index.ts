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
export { registerPayroll } from './payroll/register-payroll'; // a branch's clock cannot be switched off while its payroll month is unpaid
export { default as workforcePayrollRouter } from './payroll/payroll-routes'; // Payroll part 1: the month, the engine, the review and the approval (Segment 2A)
export { sweepPayroll, refreshEstimates as refreshPayrollEstimates } from './payroll/payroll-sweep'; // the job: month rows, automatic calculation, nightly estimate
export { workforceCasualRouter, casualMonthSummary } from './casual'; // Casual pay: workers, daily sheets, approval, receipts, the payroll memo line (Segment 3)
export { workforcePayslipsRouter, setPublicationSource, setDeviceConfirmationSource, ensureFileForPayslip } from './payslips'; // Staff payslips: the code, reads, A4 file, P9 (Segment 3)
// Segment 6a (Shared parts): the real notifier. Leave and Conduct call `notify` / `notifyMany`; the worker calls `dispatchHeldWorkforcePush`.
export { notify, notifyMany, registerWorkforceNotifier, workforceNotificationsRouter, dispatchHeldWorkforcePush, WORKFORCE_NOTICE_JOB, renderNotification, knownKinds } from './notifications';
export type { NotifyData, NotifyOptions, NotificationTone, RenderedNotification, HeldPush } from './notifications';
export { workforceSecurityRouter, workforceSessionGate, registerSecurity, wasntMe, claimAlertWindow, insertAlertForEntry, tellAdminsOfAlert } from './security'; // phones, alerts, "This wasn't me", the session gate
export { workforceNeedsYouRouter, registerNeedsYou, registerNeedsYouSource, type NeedsYouSource, type NeedsYouRow, type NeedsYouContext } from './needs-you'; // the card, badges, Overdue; Leave and Conduct register a source
// Segment 4 (Leave): the router, start-up registration, the hourly sweep, the guard the old leave code calls, and the slip hooks back end B uses.
export { workforceLeaveRouter, registerLeave, sweepLeave, assertLegacyLeaveWritable, verifyLeaveSlip, registerLeaveSlipDocument } from './leave';
export type { LeaveSlipVerdict, DocumentKindRegistration } from './leave';
export { workforceAuditRouter, runNightlyChainCheck, backfillAuditIndex, backfillAllAuditIndexes, verifyRange, type NightlyResult } from './audit'; // Segment 6b: the Audit log read side, Activity on my record, the chain check
export { workforceDocumentsRouter, registerDocuments, reconcileDocuments } from './documents'; // Segment 6b: the Signed documents index
export { publicVerifyRouter, workforceVerifyRouter } from './verify'; // Segment 6b: what the QR opens
export { registerDocument, withdrawDocument, type WithdrawDocumentInput } from './_shared/documents/register-document'; // the door Leave and Conduct call inside their signing transaction
export type { RegisterDocumentInput, RegisteredDocument, DocumentPerson } from './_shared/documents/documents.types';
export { registerPinTries } from './_shared/pin/register-pin'; // wrong PIN tries live in the database
export { attemptWithPause, type PinAttempt, type PinPurpose } from './_shared/pin/pin-door'; // the shared door Conduct signing will use
export { isSiteOnNewConduct, refuseLegacyConductWhenSwitched } from './conduct/rollout/rollout-guard'; // the old HR disciplinary create and acknowledge ask this (Segment 5, C1)
export { default as workforceConductRouter } from './conduct/conduct-routes'; // Conduct: notices, signing, appeals, the letter (Segment 5)
export { registerConduct } from './conduct/register-conduct'; // Conduct's rows join the Needs you card and badge
export { sweepConduct, type ConductSweepReport } from './conduct/notices/conduct-sweep'; // the nightly job: ends notices, tells the Director of overdue appeals
export { registerConductDocuments, type ConductDocumentProvider } from './conduct/documents/register-documents'; // the documents door (back end B) plugs the letter in here
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
