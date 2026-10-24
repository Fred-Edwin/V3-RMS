import type { NextFunction, Request, Response } from 'express';
import type { DepartmentTag, UserRole } from '@prisma/client';
import { sameDepartmentGroup } from '../../../utils/departments';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../../utils/errors';
import { SCOPES, type Capability, type Grants, type Scope } from './access/workforce-capabilities';
import { HEAD_EXTRAS, ROLE_GRANTS } from './access/workforce-grants';

/**
 * The Workforce access table: role by capability by scope. Routes, services and the front end all read it (the front
 * end through GET /workforce/permissions/me). Never guard a Workforce route with a list of roles; use requireCapability.
 * The names are in `access/workforce-capabilities.ts` and who holds what in `access/workforce-grants.ts`; both are re-exported here so every
 * caller keeps importing from this file.
 */
export { AUDIT_CAPABILITIES_COMPLETE, CAPABILITIES, SCOPES, auditReadCapability } from './access/workforce-capabilities';
export type { Capability, Grants, Scope } from './access/workforce-capabilities';
export { ROLE_GRANTS } from './access/workforce-grants';

export interface AccessSubject {
  id: string;
  role: UserRole;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
  /** Real value from the employee file (slice 1). When absent the role default (decision D2) applies. */
  tracksTime?: boolean;
  /**
   * Slice 1: set by attachWorkforceSubject from the DepartmentHead rows (substantive or acting, active today). When
   * defined it is the only source of department scope and of head status for Workforce.
   */
  headOfDepartmentIds?: readonly string[];
}

/** Decision D2: who clocks in when no employee file says otherwise. */
export const defaultTracksTime = (role: UserRole): boolean =>
  ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'DEPARTMENT_HEAD', 'STORE_ATTENDANT', 'ACCOUNTANT'].includes(role);

const widest = (a: Scope, b: Scope): Scope => (SCOPES.indexOf(a) >= SCOPES.indexOf(b) ? a : b);

const isHead = (subject: AccessSubject): boolean =>
  subject.isDepartmentHead === true || subject.role === 'DEPARTMENT_HEAD' || (subject.headOfDepartmentIds?.length ?? 0) > 0;

/** Every capability the person holds, with its scope. Base role plus head extras, minus time.own if they do not clock. */
export const grantsOf = (subject: AccessSubject): Grants => {
  const merged: Grants = { ...(ROLE_GRANTS[subject.role] ?? {}) };
  if (isHead(subject)) {
    for (const [capability, scope] of Object.entries(HEAD_EXTRAS) as [Capability, Scope][]) {
      const current = merged[capability];
      merged[capability] = current ? widest(current, scope) : scope;
    }
  }
  if ((subject.tracksTime ?? defaultTracksTime(subject.role)) === false) delete merged['time.own'];
  return merged;
};

export const scopeOf = (subject: AccessSubject, capability: Capability): Scope | null => grantsOf(subject)[capability] ?? null;
export const workforceCan = (subject: AccessSubject, capability: Capability): boolean => scopeOf(subject, capability) !== null;

/** What a capability is checked against: the person, place and department the action touches. */
export interface AccessTarget {
  userId: string | null;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  /** Slice 1: the employee's department id (compared with the subject's head rows). */
  departmentId?: string | null;
  /** The person's login role, when the caller loaded it. A Store Manager's reach stops at this line (finding 55). */
  userRole?: UserRole | null;
}

/**
 * The Central Store site also holds head-office and company-level people. A Store Manager's unit reach leaves out every
 * login at or above the manager's own level, so they are neither listed, opened nor disciplined by that manager.
 */
export const ABOVE_STORE_MANAGER: readonly UserRole[] = ['DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN', 'MANAGER'];
export const hiddenFromUnitManager = (subject: AccessSubject, userRole: UserRole | null | undefined): boolean =>
  subject.role === 'STORE_MANAGER' && !!userRole && ABOVE_STORE_MANAGER.includes(userRole);

const withinScope = (subject: AccessSubject, scope: Scope, target: AccessTarget): boolean => {
  switch (scope) {
    case 'all':
      return true;
    case 'unit':
      return subject.siteId !== null && target.siteId === subject.siteId && !hiddenFromUnitManager(subject, target.userRole);
    case 'dept': {
      if (subject.siteId === null || target.siteId !== subject.siteId) return false;
      // Slice 1: the head rows are the only source when present (a Pastry head no longer needs Kitchen cover).
      if (subject.headOfDepartmentIds !== undefined) {
        return !!target.departmentId && subject.headOfDepartmentIds.includes(target.departmentId);
      }
      return !!subject.departmentTag && !!target.departmentTag && sameDepartmentGroup(subject.departmentTag, target.departmentTag);
    }
    case 'own':
      return target.userId !== null && target.userId === subject.id;
  }
};

export const inScope = (subject: AccessSubject, capability: Capability, target: AccessTarget): boolean => {
  const scope = scopeOf(subject, capability);
  return scope !== null && withinScope(subject, scope, target);
};

/**
 * Service guard. Writes out of scope are refused (403). Reads out of scope answer 404 so a record's existence is not
 * revealed (`onDeny: 'not_found'`).
 */
export const assertInScope = (
  subject: AccessSubject,
  capability: Capability,
  target: AccessTarget,
  onDeny: 'forbidden' | 'not_found' = 'forbidden',
): void => {
  if (inScope(subject, capability, target)) return;
  if (onDeny === 'not_found') throw new NotFoundError('Not found');
  throw new ForbiddenError('You do not have permission to perform this action');
};

/** Nobody approves their own request (leave, overtime, corrections). */
export const assertNotSelf = (subject: AccessSubject, target: AccessTarget): void => {
  if (target.userId !== null && target.userId === subject.id) {
    throw new ForbiddenError('You cannot approve your own request');
  }
};

/** Route guard: the caller needs at least one of these capabilities. Scope is then checked by the service. */
export const requireCapability = (...capabilities: Capability[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    const subject: AccessSubject = req.workforceSubject ?? req.user;
    if (!capabilities.some((c) => workforceCan(subject, c))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
};

/** Sensitive fields, hidden by omission. `own` is the capability that reveals them on the person's own record. */
export const SENSITIVE_GROUPS = {
  pay: { own: 'me.payprofile', other: 'payprofile.read' },
  bank: { own: 'me.file', other: 'employee.read_sensitive' },
  ids: { own: 'me.file', other: 'employee.read_sensitive' },
  documents: { own: 'me.file', other: 'employee.read_sensitive' },
  discipline: { own: 'discipline.read_own', other: 'discipline.read' },
  payslip_opens: { own: 'audit.read_own', other: 'audit.read.payslip_access' },
} as const satisfies Record<string, { own: Capability; other: Capability }>;
export type SensitiveGroup = keyof typeof SENSITIVE_GROUPS;

/** The groups this person may NOT see on this record. The response carries the list so the screen can show a lock. */
export const lockedGroupsFor = (subject: AccessSubject, target: AccessTarget): SensitiveGroup[] =>
  (Object.keys(SENSITIVE_GROUPS) as SensitiveGroup[]).filter((group) => {
    const { own, other } = SENSITIVE_GROUPS[group];
    const mine = target.userId !== null && target.userId === subject.id;
    return !((mine && inScope(subject, own, target)) || inScope(subject, other, target));
  });

export interface Redacted<T> {
  data: Partial<T>;
  locked: SensitiveGroup[];
}

/** `fieldsByGroup` names which keys of a record belong to each sensitive group; locked keys are removed. */
export const redactSensitive = <T extends object>(
  subject: AccessSubject,
  target: AccessTarget,
  record: T,
  fieldsByGroup: Partial<Record<SensitiveGroup, readonly (keyof T)[]>>,
): Redacted<T> => {
  const locked = lockedGroupsFor(subject, target);
  const copy: Partial<T> = { ...record };
  for (const group of locked) for (const key of fieldsByGroup[group] ?? []) delete copy[key];
  return { data: copy, locked };
};
