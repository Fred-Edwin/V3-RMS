import type { UserRole } from '@prisma/client';
import { ConflictError, ForbiddenError } from '../../../utils/errors';
import { ABOVE_STORE_MANAGER, assertInScope, scopeOf, type AccessSubject, type AccessTarget } from '../_shared/workforce-access';
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
export function assertCanEditBasics(subject: AccessSubject, row: TargetRow & { status: string }): void {
  const scope = scopeOf(subject, 'employee.write_basic');
  if (scope === null) throw new ForbiddenError('You do not have permission to perform this action');
  assertInScope(subject, 'employee.write_basic', targetOf(row));
  if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
  if (scope !== 'all' && row.status !== 'ONBOARDING') {
    throw new ForbiddenError('Ask HR to change this file', 'FILE_LOCKED_FOR_EDIT');
  }
}
