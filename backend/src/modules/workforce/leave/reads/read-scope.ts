import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { inScope, scopeOf, type AccessSubject, type Capability } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import type { ApplicationRow } from '../data/applications-repository';
import type { LeavePerson } from '../data/people-repository';
import { currentDecider } from '../engine/leave-routing';

export interface LeaveViewer {
  companyId: string;
  scope: 'unit' | 'all';
  /** The one site the list is held to: a manager's own, or the one a company-wide reader picked. Undefined = every site. */
  siteId: string | undefined;
}

/**
 * Who may open a Leave list (spec section 10). The capability must be held at site or company scope; a department head holds
 * `leave.read` at department scope and has NO Leave page (L34), so they are refused. A manager asking for another site gets 404 so
 * the site's existence is not revealed.
 */
export async function viewerFor(subject: AccessSubject, capability: Capability, requestedSite?: string): Promise<LeaveViewer> {
  const scope = scopeOf(subject, capability);
  if (scope !== 'unit' && scope !== 'all') throw new ForbiddenError('You do not have permission to perform this action');
  const ctx = await resolveActor(subject);
  if (scope === 'unit') {
    if (!subject.siteId || (requestedSite && requestedSite !== subject.siteId)) throw new NotFoundError('Not found');
    return { companyId: ctx.companyId, scope, siteId: subject.siteId };
  }
  return { companyId: ctx.companyId, scope, siteId: requestedSite };
}

/** May this caller open this person's request: their own, or in `leave.read` scope. Anything else answers 404. */
export function assertCanOpen(subject: AccessSubject, person: LeavePerson): 'own' | 'reader' {
  if (person.userId !== null && person.userId === subject.id) return 'own';
  if (inScope(subject, 'leave.read', { userId: person.userId, siteId: person.siteId, departmentId: person.departmentId })) return 'reader';
  throw new NotFoundError('That leave request was not found', 'LEAVE_NOT_FOUND');
}

/**
 * Is this waiting request the caller's to decide right now? One function for the badge, the Needs you card and the Requests list,
 * so the three can never disagree (spec section 9). Their own request is never theirs; the System Admin is a fallback and gets no badge.
 */
export function routedToMe(app: Pick<ApplicationRow, 'status' | 'stage' | 'routedToRole' | 'askedAt' | 'withHrAt' | 'siteId'>, personUserId: string | null, subject: AccessSubject, now: Date): boolean {
  if (app.status !== 'WAITING') return false;
  if (personUserId !== null && personUserId === subject.id) return false;
  const decider = currentDecider(app, now);
  if (subject.role !== decider) return false;
  return decider === 'MANAGER' || decider === 'STORE_MANAGER' ? app.siteId === subject.siteId : true;
}
