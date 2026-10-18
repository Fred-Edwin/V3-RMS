import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { assertInScope, scopeOf, type AccessSubject, type Capability, type Scope } from '../_shared/workforce-access';

/**
 * The scope rules the rota services share, written once. Reads out of scope answer 404 (a person's or a site's rota is
 * not revealed); writes out of scope answer 403.
 */
export type RotaReadScope = { kind: 'site'; siteId: string } | { kind: 'departments'; siteId: string; departmentIds: readonly string[] };

const denied = (): never => {
  throw new ForbiddenError('You do not have permission to perform this action');
};

/**
 * The site and departments a grid read covers. Scope all picks the site from the request; unit is the caller's own site;
 * dept is the caller's departments; own (a staff member) has no grid, only their own shifts.
 */
export function gridScope(subject: AccessSubject, capability: Capability, requestedSiteId: string | undefined): RotaReadScope {
  const scope: Scope | null = scopeOf(subject, capability);
  if (scope === null || scope === 'own') return denied();
  if (scope === 'all') {
    const siteId = requestedSiteId ?? subject.siteId;
    if (!siteId) throw new ValidationError('Say which site', 'SITE_REQUIRED');
    return { kind: 'site', siteId };
  }
  if (!subject.siteId) return denied();
  if (requestedSiteId && requestedSiteId !== subject.siteId) throw new NotFoundError('Not found');
  if (scope === 'unit') return { kind: 'site', siteId: subject.siteId };
  return { kind: 'departments', siteId: subject.siteId, departmentIds: subject.headOfDepartmentIds ?? [] };
}

/** Whether a department id is inside a grid scope. */
export const departmentAllowed = (scope: RotaReadScope, departmentId: string | null): boolean =>
  scope.kind === 'site' || (departmentId !== null && scope.departmentIds.includes(departmentId));

/** A write on a person: 403 outside the caller's scope. */
export const assertCanWriteFor = (subject: AccessSubject, person: { userId: string | null; siteId: string; departmentId: string | null }): void =>
  assertInScope(subject, 'rota.write', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId });

/**
 * Template writes: a company-wide shift needs scope all (HR, Director, System Admin); a site shift needs scope all or the
 * caller's own site. A Branch Manager therefore cannot change a company-wide shift.
 */
export function assertTemplateWrite(subject: AccessSubject, siteId: string | null): void {
  const scope = scopeOf(subject, 'rota.template_write');
  if (scope === 'all') return;
  if (scope === 'unit' && siteId !== null && subject.siteId === siteId) return;
  denied();
}
