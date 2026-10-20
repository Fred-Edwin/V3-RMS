import type { Prisma } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import type { AuditActor, AuditCategoryCode, AuditEntryInput, JsonValue } from '../_shared/audit/audit.types';
import { toDateColumn, type NairobiDate } from '../_shared/time/nairobi-time';
import { inScope, workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { formatCents, parseCents } from '../payroll/engine/money';
import { resolveActor, type ActorCtx } from '../people/people-context';
import { getEffectiveRuleGroup } from '../rules';
import { recordingRepository } from './recording/recording-repository';
import { sheetRepository } from './sheet/sheet-repository';

export { eventOf } from '../timesheets/timesheets-audit';

/** A caller who holds none of these capabilities gets a 403 (the page exists but is not theirs). */
export async function casualActor(subject: AccessSubject, capabilities: readonly Capability[]): Promise<ActorCtx> {
  if (!capabilities.some((c) => workforceCan(subject, c))) throw new ForbiddenError('You do not have permission to perform this action');
  return resolveActor(subject);
}

/** The department with its site, only when it is in the caller's company and on the named site. Anything else is a 404. */
export async function departmentOf(companyId: string, siteId: string, departmentId: string): Promise<{ id: string; name: string; siteId: string; siteName: string }> {
  const dept = await sheetRepository.department(companyId, departmentId);
  if (!dept || dept.siteId !== siteId || dept.status !== 'ACTIVE') throw new NotFoundError('There is no such department at that site', 'NO_DEPARTMENT');
  return { id: dept.id, name: dept.name, siteId: dept.siteId, siteName: dept.site.name };
}

/** Who may read a sheet: the head of its department, the manager of its site, HR, the Accountant and the Director. Anyone else gets the 404 a missing sheet gets. */
export function assertCanSee(subject: AccessSubject, target: { siteId: string; departmentId: string }): void {
  const t = { userId: null, siteId: target.siteId, departmentId: target.departmentId };
  if (!(['casual.read', 'casual.record', 'casual.approve'] as const).some((c) => inScope(subject, c, t))) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
}

export interface DayRate {
  rate: string | null;
  version: number;
}

/** The daily rate for a department on a work date (Rules, Casual work: the department's rate, else the default). null = none set. */
export async function dayRateFor(siteId: string, departmentId: string, workDate: NairobiDate): Promise<DayRate> {
  const group = await getEffectiveRuleGroup(siteId, workDate, 'CASUAL_WORK');
  const own = group.values.rates.find((r) => r.departmentId === departmentId);
  const rate = own?.dailyRate ?? group.values.defaultDailyRate ?? null;
  // Always two decimals ("900.00"), the way a stored rate reads back, so two rates compare as strings.
  return { rate: rate === null ? null : formatCents(parseCents(rate)), version: group.companyVersion };
}

/** The stored answer to a request key, or null. A key used for another action is a 409 (the client reused it by mistake). */
export async function priorResult<T>(companyId: string, key: string, action: string): Promise<T | null> {
  const prior = await recordingRepository.findKey(companyId, key);
  if (!prior) return null;
  if (prior.action !== action) throw new ConflictError('That request key was already used for something else.', 'IDEMPOTENCY_KEY_REUSED');
  return prior.response as unknown as T;
}

export const jsonOf = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export interface CasualEntryArgs {
  companyId: string;
  siteId: string | null;
  actor: AuditActor;
  action: string;
  category: Extract<AuditCategoryCode, 'PAY_RUN_PREPARE' | 'PAY_RUN_DECIDE'>;
  subjectType: 'CasualSheet' | 'CasualWorker';
  subjectId: string;
  /** Counts, document numbers, initials and reasons. Never a pay figure, a national ID number or a PIN. */
  after?: JsonValue | null;
  before?: JsonValue | null;
  reason?: string | null;
}

export const casualEntry = (args: CasualEntryArgs): AuditEntryInput => ({
  companyId: args.companyId,
  siteId: args.siteId,
  actor: args.actor,
  action: args.action,
  category: args.category,
  subjectType: args.subjectType,
  subjectId: args.subjectId,
  subjectUserId: null,
  before: args.before ?? null,
  after: args.after ?? null,
  reason: args.reason ?? null,
});

export const dateColumn = toDateColumn;

/** "Anna Wanjiru Kamau" -> "AWK": initials for the audit log (no full name of a worker is written there). */
export const initialsOf = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
