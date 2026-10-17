import { ConflictError, ForbiddenError } from '../../../utils/errors';
import { assertInScope, scopeOf, type AccessSubject, type AccessTarget } from '../_shared/workforce-access';
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
}

export const targetOf = (row: TargetRow): AccessTarget => ({
  userId: row.userId,
  siteId: row.siteId,
  departmentId: row.departmentId,
  departmentTag: row.department?.key ?? null,
});

/** What the viewer's read scope lets them list. Refuses a viewer with no read capability at all. */
export function readScopeOf(subject: AccessSubject): ScopeFilter {
  const scope = scopeOf(subject, 'employee.read_basic');
  switch (scope) {
    case 'all':
      return { kind: 'all' };
    case 'unit':
      if (!subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
      return { kind: 'site', siteId: subject.siteId };
    case 'dept':
      return { kind: 'departments', departmentIds: subject.headOfDepartmentIds ?? [] };
    default:
      throw new ForbiddenError('You do not have permission to perform this action');
  }
}

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
