import type { UserRole } from '@prisma/client';
import { ESCALATION_MS, type DeciderRole } from '../leave.constants';
import type { LeaveStageCode, Routing } from '../leave.types';

export type SiteKind = 'BRANCH' | 'CENTRAL_STORE';

const stageOf = (role: DeciderRole): LeaveStageCode => (role === 'DIRECTOR' ? 'DIRECTOR' : role === 'HR_MANAGER' ? 'HR' : 'MANAGER');

/**
 * Who decides first (spec section 5, L18). Decided from the person's role and the type, never sent by the client.
 *  Branch Manager / Store Manager -> HR; HR -> Director; Director -> HR; Head office (Accountant, System Admin) -> Director;
 *  everyone else -> the manager of their site (Store Manager at the Central Store);
 *  a type that HR approves (Maternity, Paternity) -> HR from the start (the Director for HR's own).
 */
export function routeFor(personRole: UserRole, site: SiteKind, approvedBy: 'MANAGER' | 'HR'): Routing {
  const role = firstDecider(personRole, site, approvedBy);
  return { role, stage: stageOf(role) };
}

function firstDecider(personRole: UserRole, site: SiteKind, approvedBy: 'MANAGER' | 'HR'): DeciderRole {
  if (personRole === 'HR_MANAGER') return 'DIRECTOR';
  if (personRole === 'DIRECTOR') return 'HR_MANAGER';
  if (personRole === 'ACCOUNTANT' || personRole === 'SYSTEM_ADMIN') return 'DIRECTOR';
  if (personRole === 'MANAGER' || personRole === 'STORE_MANAGER') return 'HR_MANAGER';
  if (approvedBy === 'HR') return 'HR_MANAGER';
  return site === 'CENTRAL_STORE' ? 'STORE_MANAGER' : 'MANAGER';
}

export interface RoutedApplication {
  status: 'WAITING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';
  stage: LeaveStageCode;
  routedToRole: string;
  askedAt: Date;
  withHrAt: Date | null;
}

/** The moment a request with a site manager moves to HR: 72 hours after it was asked (L20). */
export const movesToHrAt = (askedAt: Date): Date => new Date(askedAt.getTime() + ESCALATION_MS);

const isSiteManagerRole = (role: string): boolean => role === 'MANAGER' || role === 'STORE_MANAGER';

/**
 * The stage right now. It is DERIVED from the ask time so it is right even if the hourly job is down (L20): a waiting request
 * with a site manager is with HR once 72 hours have passed or the job has written `withHrAt`.
 */
export function effectiveStage(application: RoutedApplication, now: Date): LeaveStageCode {
  if (application.status !== 'WAITING') return application.stage;
  if (application.stage === 'MANAGER' && isSiteManagerRole(application.routedToRole) && (application.withHrAt !== null || now >= movesToHrAt(application.askedAt))) return 'HR';
  return application.stage;
}

/** The role that may decide the request at this moment. */
export function currentDecider(application: RoutedApplication, now: Date): DeciderRole {
  const stage = effectiveStage(application, now);
  if (stage === 'HR') return 'HR_MANAGER';
  if (stage === 'DIRECTOR') return 'DIRECTOR';
  return application.routedToRole as DeciderRole;
}

/** True when this request is still with a site manager and will move to HR on its own. */
export const willMoveToHr = (application: RoutedApplication, now: Date): boolean => application.status === 'WAITING' && application.stage === 'MANAGER' && isSiteManagerRole(application.routedToRole) && effectiveStage(application, now) === 'MANAGER';

export type DecideRefusal = 'OWN_REQUEST' | 'NOT_WITH_YOU_YET' | 'NOT_YOUR_DECISION' | null;

/**
 * May this person decide? `actorRole` and `sameSite` come from the caller's account. The System Admin is a fallback only: allowed
 * when nobody holds the deciding role (`roleHolderExists` false). Returns the refusal code, or null.
 */
export function refusalFor(args: { application: RoutedApplication; actorRole: UserRole; actorIsSubject: boolean; sameSite: boolean; roleHolderExists: boolean; now: Date }): DecideRefusal {
  if (args.actorIsSubject) return 'OWN_REQUEST';
  const decider = currentDecider(args.application, args.now);
  if (args.actorRole === 'SYSTEM_ADMIN') return args.roleHolderExists ? 'NOT_YOUR_DECISION' : null;
  if (args.actorRole === 'HR_MANAGER' && decider !== 'HR_MANAGER' && willMoveToHr(args.application, args.now)) return 'NOT_WITH_YOU_YET';
  if (args.actorRole !== decider) return 'NOT_YOUR_DECISION';
  if (isSiteManagerRole(decider) && !args.sameSite) return 'NOT_YOUR_DECISION';
  return null;
}
