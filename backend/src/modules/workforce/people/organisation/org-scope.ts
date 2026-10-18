import { ForbiddenError } from '../../../../utils/errors';
import { assertInScope, scopeOf, workforceCan, type AccessSubject, type Capability } from '../../_shared/workforce-access';

/**
 * The scope rules the Organisation services share, written once. Reads out of scope answer 404 (a department's
 * existence is not revealed); writes out of scope answer 403.
 */
export type OrgReadScope = { kind: 'all' } | { kind: 'site'; siteId: string } | { kind: 'departments'; siteId: string; departmentIds: readonly string[] };

export function orgReadScope(subject: AccessSubject): OrgReadScope {
  const scope = scopeOf(subject, 'org.read');
  if (scope === 'all') return { kind: 'all' };
  if (!subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
  if (scope === 'unit') return { kind: 'site', siteId: subject.siteId };
  if (scope === 'dept') return { kind: 'departments', siteId: subject.siteId, departmentIds: subject.headOfDepartmentIds ?? [] };
  throw new ForbiddenError('You do not have permission to perform this action');
}

export const assertCanReadDepartment = (subject: AccessSubject, department: { id: string; siteId: string }): void =>
  assertInScope(subject, 'org.read', { userId: null, siteId: department.siteId, departmentId: department.id }, 'not_found');

/** A write on a department (or a site, when `id` is absent): 403 outside the caller's scope. */
export const assertCanWriteIn = (subject: AccessSubject, capability: Capability, target: { siteId: string; id?: string }): void =>
  assertInScope(subject, capability, { userId: null, siteId: target.siteId, ...(target.id ? { departmentId: target.id } : {}) });

/** Positions belong to the company, not to a site: changing one needs company-wide `org.write` (HR, System Admin). */
export function assertCompanyWideWrite(subject: AccessSubject): void {
  if (scopeOf(subject, 'org.write') !== 'all') throw new ForbiddenError('You do not have permission to perform this action');
}

export const can =(subject: AccessSubject, capability: Capability): boolean => workforceCan(subject, capability);
