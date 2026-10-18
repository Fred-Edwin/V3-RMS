import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { assertInScope, scopeOf, type AccessSubject, type Capability, type Scope } from '../_shared/workforce-access';

/** What a viewer may see under a capability: one site (or all), and for a department head only their departments. */
export interface Viewer {
  scope: Scope;
  siteId: string;
  /** Null = the whole site. A head sees only the departments they head. */
  departmentIds: readonly string[] | null;
}

/**
 * The site a list or period is read at. Staff-wide roles (scope all) name the site; a manager or head is held to their
 * own. Another site answers 404 so its existence is not revealed.
 */
export function viewerFor(subject: AccessSubject, capability: Capability, requestedSiteId?: string): Viewer {
  const scope = scopeOf(subject, capability);
  if (scope === null) throw new NotFoundError('Not found');
  if (scope === 'all') {
    const siteId = requestedSiteId ?? subject.siteId;
    if (!siteId) throw new ValidationError('Say which branch', 'SITE_REQUIRED');
    return { scope, siteId, departmentIds: null };
  }
  if (!subject.siteId || (requestedSiteId && requestedSiteId !== subject.siteId)) throw new NotFoundError('Not found');
  return { scope, siteId: subject.siteId, departmentIds: scope === 'dept' ? (subject.headOfDepartmentIds ?? []) : null };
}

/** A write needs the capability itself: a reader without it is refused (403) before anything about the record is looked up. */
export function assertCan(subject: AccessSubject, capability: Capability): void {
  if (scopeOf(subject, capability) === null) throw new ForbiddenError('You do not have permission to perform this action');
}

/** As `viewerFor`, for a write: no capability is 403, another branch is 404. */
export function writerFor(subject: AccessSubject, capability: Capability, siteId: string): Viewer {
  assertCan(subject, capability);
  return viewerFor(subject, capability, siteId);
}

/** A record at a site: the same answer as `viewerFor`, for a row found by id. */
export function assertSiteVisible(subject: AccessSubject, capability: Capability, siteId: string, departmentId: string | null, userId: string | null, mode: 'read' | 'write'): Viewer {
  const viewer = viewerFor(subject, capability, siteId);
  assertInScope(subject, capability, { userId, siteId, departmentId }, mode === 'read' ? 'not_found' : 'forbidden');
  return viewer;
}
