import type { UserRole } from '@prisma/client';
import { ConflictError, ForbiddenError } from '../../../utils/errors';
import { ABOVE_STORE_MANAGER, assertInScope, assertNotSelf, scopeOf, type AccessSubject, type AccessTarget } from '../_shared/workforce-access';
import type { ScopeFilter } from './employees/employees-repository';

/**
 * The access helpers every People service shares, so the scope rules are written once: what a file is checked
 * against, what a viewer may list, and when a manager may still edit a file.
 */

/** The row shape any employee query returns for access checks. */
export interface TargetRow {
  userId: string | null;
  siteId: string;
  departmentId: string | null;
  department?: { key: AccessTarget['departmentTag'] } | null;
  user?: { role: AccessTarget['userRole'] } | null;
}

export const targetOf = (row: TargetRow): AccessTarget => ({
  userId: row.userId,
  siteId: row.siteId,
  departmentId: row.departmentId,
  departmentTag: row.department?.key ?? null,
  userRole: row.user?.role ?? null,
});

/** What the viewer's read scope lets them list. Refuses a viewer with no read capability at all. */
export function readScopeOf(subject: AccessSubject): ScopeFilter {
  const scope = scopeOf(subject, 'employee.read_basic');
  switch (scope) {
    case 'all':
      return { kind: 'all' };
    case 'unit':
      if (!subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
      return { kind: 'site', siteId: subject.siteId, ...(subject.role === 'STORE_MANAGER' ? { excludeUserRoles: ABOVE_STORE_MANAGER } : {}) };
    case 'dept':
      return { kind: 'departments', departmentIds: subject.headOfDepartmentIds ?? [] };
    default:
      throw new ForbiddenError('You do not have permission to perform this action');
  }
}

/**
 * The positions this viewer may hire into (finding 56). A Store Manager hires floor staff, never a position whose login sits
 * at or above the manager's own level. HR and the Branch Manager are not narrowed here.
 */
export const mayHireInto = (subject: AccessSubject, position: { loginRole: UserRole | null }): boolean =>
  !(subject.role === 'STORE_MANAGER' && position.loginRole !== null && (ABOVE_STORE_MANAGER.includes(position.loginRole) || position.loginRole === 'STORE_MANAGER'));

/** A manager (unit scope) edits a file only while it is onboarding; HR and the System Admin always (question 2). */
export function assertCanEditBasics(
  subject: AccessSubject,
  row: TargetRow & { status: string; hiredById?: string | null; createdAt?: Date },
  now: Date = new Date(),
): void {
  const scope = scopeOf(subject, 'employee.write_basic');
  if (scope === null) throw new ForbiddenError('You do not have permission to perform this action');
  assertInScope(subject, 'employee.write_basic', targetOf(row));
  assertNotSelf(subject, targetOf(row)); // someone else changes the job details; people edit their own contact details elsewhere
  if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
  if (scope !== 'all' && row.status !== 'ONBOARDING' && !madeThisHireRecently(subject, row, now)) {
    throw new ForbiddenError('Ask HR to change this', 'FILE_LOCKED_FOR_EDIT');
  }
}

/** The manager who made the hire may correct it for 24 hours (owner decision Q5, 21 Oct 2026); after that it goes through HR. */
export const HIRE_CORRECTION_HOURS = 24;

/** When this viewer's 24-hour correction window on a file ends (an ISO instant), or null when it is not running for them (HR, onboarding, not their hire, or over). */
export function correctionEndsAt(subject: AccessSubject, row: { status: string; hiredById?: string | null; createdAt?: Date }, now: Date = new Date()): string | null {
  if (scopeOf(subject, 'employee.write_basic') === 'all' || row.status === 'ONBOARDING' || row.status === 'EXITED') return null;
  if (!madeThisHireRecently(subject, row, now) || !row.createdAt) return null;
  return new Date(row.createdAt.getTime() + HIRE_CORRECTION_HOURS * 3_600_000).toISOString();
}
const madeThisHireRecently = (subject: AccessSubject, row: { hiredById?: string | null; createdAt?: Date }, now: Date): boolean =>
  !!row.hiredById && row.hiredById === subject.id && !!row.createdAt && now.getTime() - row.createdAt.getTime() < HIRE_CORRECTION_HOURS * 3_600_000;
