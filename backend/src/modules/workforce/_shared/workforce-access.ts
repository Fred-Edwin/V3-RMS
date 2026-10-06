import type { NextFunction, Request, Response } from 'express';
import type { DepartmentTag, UserRole } from '@prisma/client';
import { sameDepartmentGroup } from '../../../utils/departments';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../../utils/errors';
import type { AuditCategoryCode } from './audit/audit.types';

/**
 * The Workforce access table: role by capability by scope. Routes, services and the front end all read it (the front
 * end through GET /workforce/permissions/me). Never guard a Workforce route with a list of roles; use requireCapability.
 */
export const SCOPES = ['own', 'dept', 'unit', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

export const CAPABILITIES = [
  // my own things
  'me.file', // my employee file, including my own IDs, bank and documents
  'me.payslip', // my payslips, behind the payslip gate
  'me.payprofile', // my own pay profile
  'time.own', // clock in/out/undo, My time, Report a problem (removed when the person does not track time)
  // rota and the day
  'rota.read',
  'rota.write', // edit and publish
  'today.read',
  'today.act', // clock for someone, mark absent, extend a shift
  // time
  'timesheet.read',
  'timesheet.approve',
  'overtime.approve',
  'clock_mistake.resolve',
  'casual.record',
  'casual.approve',
  'casual.read',
  // leave
  'leave.request',
  'leave.acknowledge',
  'leave.read',
  'leave.approve',
  // people
  'employee.read_basic',
  'employee.read_sensitive', // IDs, bank, documents
  'employee.write_basic', // hire basics, job details
  'employee.write_sensitive',
  'employee.lifecycle', // exit, rehire, transfer
  'payprofile.read', // other people's pay profiles
  'payprofile.write',
  'org.read',
  'org.write', // departments and positions
  'org.write_heads', // assign and replace department heads
  // rules
  'rules.read',
  'rules.edit.lateness',
  'rules.edit.overtime',
  'rules.edit.attendance',
  'rules.edit.leave',
  'rules.edit.probation',
  'rules.edit.casual_work',
  'rules.edit.conduct',
  'rules.edit.statutory',
  'rules.edit.holidays',
  'rules.edit.week_breaks',
  'rules.confirm.pay_rates', // overtime multipliers, holiday pay rate
  'rules.confirm.statutory',
  'rules.confirm.holiday_list',
  // pay
  'payrun.read',
  'payrun.prepare',
  'payrun.approve',
  'payrun.publish',
  'payrun.reopen',
  // conduct
  'discipline.read_own',
  'discipline.read',
  'discipline.issue',
  // audit log (what each role may read is one capability per category)
  'audit.read_own', // "Activity on my record"
  'audit.read.people',
  'audit.read.time',
  'audit.read.leave',
  'audit.read.pay_setup',
  'audit.read.pay_run_prepare',
  'audit.read.pay_run_decide',
  'audit.read.rules_operating',
  'audit.read.rules_pay',
  'audit.read.payslip_access',
  'audit.read.sensitive_view',
  'audit.read.discipline',
  'audit.read.security',
  'audit.read.documents',
  'audit.read.log_access',
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Grants = Partial<Record<Capability, Scope>>;

type AuditReadCapability = `audit.read.${Lowercase<AuditCategoryCode>}`;
/** Compile-time check: every audit category has its read capability (fails the build if one is missing). */
export const AUDIT_CAPABILITIES_COMPLETE: Exclude<AuditReadCapability, Capability> extends never ? true : never = true;

export const auditReadCapability = (category: AuditCategoryCode): Capability => `audit.read.${category.toLowerCase()}` as AuditReadCapability;

const ALL_AUDIT_READS: Grants = Object.fromEntries(CAPABILITIES.filter((c) => c.startsWith('audit.read.')).map((c) => [c, 'all' as const]));

const OWN_FILE: Grants = {
  'me.file': 'own',
  'me.payslip': 'own',
  'me.payprofile': 'own',
  'leave.request': 'own',
  'discipline.read_own': 'own',
  'audit.read_own': 'own',
};

const STAFF: Grants = { ...OWN_FILE, 'time.own': 'own', 'rota.read': 'own' };

const HEAD_EXTRAS: Grants = {
  'rota.read': 'dept',
  'rota.write': 'dept',
  'today.read': 'dept',
  'today.act': 'dept',
  'timesheet.read': 'dept',
  'timesheet.approve': 'dept', // inside the overtime allowance; the service checks the allowance
  'overtime.approve': 'dept',
  'casual.record': 'dept',
  'casual.read': 'dept',
  'leave.acknowledge': 'dept',
  'leave.read': 'dept',
  'employee.read_basic': 'dept',
  'org.read': 'dept',
};

const UNIT_MANAGER: Grants = {
  ...OWN_FILE,
  'rota.read': 'unit',
  'rota.write': 'unit',
  'today.read': 'unit',
  'today.act': 'unit',
  'timesheet.read': 'unit',
  'timesheet.approve': 'unit',
  'overtime.approve': 'unit',
  'clock_mistake.resolve': 'unit', // Store Manager resolves the Store Attendants' (decision D8)
  'casual.approve': 'unit',
  'casual.read': 'unit',
  'leave.read': 'unit',
  'leave.approve': 'unit', // never their own; a manager's own request goes to HR
  'employee.read_basic': 'unit',
  'employee.write_basic': 'unit',
  'rules.read': 'unit',
  'rules.edit.lateness': 'unit', // own site only: writes a site override
  'rules.edit.overtime': 'unit',
  'rules.edit.leave': 'unit', // minimum cover only (field policy, section 6)
  'discipline.read': 'unit',
  'discipline.issue': 'unit',
  'org.read': 'unit',
  'org.write_heads': 'unit',
  'audit.read.time': 'unit',
  'audit.read.leave': 'unit',
  'audit.read.rules_operating': 'unit', // they are told when their branch's rules change (question 7a, decided)
};

export const ROLE_GRANTS: Partial<Record<UserRole, Grants>> = {
  WAITER: STAFF,
  CHEF: STAFF,
  BARISTA: STAFF,
  STEWARD: STAFF,
  HOUSEKEEPING: STAFF,
  DEPARTMENT_HEAD: STAFF, // legacy value; always treated as a head too
  STORE_ATTENDANT: STAFF,
  ACCOUNTANT: {
    ...STAFF,
    'timesheet.read': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'payprofile.read': 'all',
    'rules.read': 'all',
    'rules.edit.statutory': 'all',
    'rules.confirm.pay_rates': 'all',
    'rules.confirm.statutory': 'all',
    'payrun.read': 'all',
    'payrun.approve': 'all',
    'audit.read.pay_run_decide': 'all',
    'audit.read.rules_pay': 'all',
  },
  MANAGER: UNIT_MANAGER,
  STORE_MANAGER: UNIT_MANAGER,
  HR_MANAGER: {
    ...OWN_FILE,
    'rota.read': 'all',
    'rota.write': 'all', // also builds the Accountant's rota (decision D18)
    'today.read': 'all',
    'timesheet.read': 'all',
    'timesheet.approve': 'all',
    'overtime.approve': 'all',
    'casual.read': 'all',
    'leave.read': 'all',
    'leave.approve': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'employee.write_basic': 'all',
    'employee.write_sensitive': 'all',
    'employee.lifecycle': 'all',
    'payprofile.read': 'all',
    'payprofile.write': 'all',
    'org.read': 'all',
    'org.write': 'all',
    'org.write_heads': 'all',
    'rules.read': 'all',
    'rules.edit.leave': 'all',
    'rules.edit.holidays': 'all',
    'payrun.read': 'all',
    'payrun.prepare': 'all',
    'payrun.publish': 'all',
    'discipline.read': 'all',
    'discipline.issue': 'all',
    'audit.read.people': 'all',
    'audit.read.time': 'all',
    'audit.read.leave': 'all',
    'audit.read.pay_setup': 'all',
    'audit.read.pay_run_prepare': 'all',
    'audit.read.discipline': 'all',
  },
  DIRECTOR: {
    ...OWN_FILE,
    'rota.read': 'all',
    'today.read': 'all',
    'timesheet.read': 'all',
    'casual.read': 'all',
    'leave.read': 'all',
    'leave.approve': 'all', // fallback only: the approvals sub-module routes to the Director when the approver is the subject or absent
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'payprofile.read': 'all',
    'org.read': 'all',
    'rules.read': 'all',
    'rules.edit.lateness': 'all',
    'rules.edit.overtime': 'all',
    'rules.edit.attendance': 'all',
    'rules.edit.leave': 'all',
    'rules.edit.probation': 'all',
    'rules.edit.casual_work': 'all',
    'rules.edit.conduct': 'all',
    'rules.edit.week_breaks': 'all',
    'rules.confirm.holiday_list': 'all',
    'payrun.read': 'all',
    'payrun.publish': 'all',
    'payrun.reopen': 'all',
    'discipline.read': 'all',
    ...ALL_AUDIT_READS,
  },
  SYSTEM_ADMIN: {
    // no "me.*": the System Admin has no payslip, no file and no clock (decisions D2, D15)
    'rota.read': 'all',
    'rota.write': 'all',
    'today.read': 'all',
    'today.act': 'all',
    'timesheet.read': 'all',
    'timesheet.approve': 'all',
    'overtime.approve': 'all',
    'clock_mistake.resolve': 'all',
    'leave.read': 'all',
    'leave.approve': 'all',
    'employee.read_basic': 'all',
    'employee.write_basic': 'all',
    'employee.lifecycle': 'all',
    'org.read': 'all',
    'org.write': 'all',
    'org.write_heads': 'all',
    'rules.read': 'all',
    'rules.edit.lateness': 'all',
    'rules.edit.overtime': 'all',
    'rules.edit.attendance': 'all',
    'payrun.read': 'all',
    'payrun.prepare': 'all',
    'payrun.approve': 'all',
    'payrun.publish': 'all',
    'payrun.reopen': 'all',
    'audit.read.security': 'all',
    'audit.read.rules_operating': 'all',
    'audit.read.rules_pay': 'all',
  },
};

export interface AccessSubject {
  id: string;
  role: UserRole;
  siteId: string | null;
  departmentTag?: DepartmentTag | null;
  isDepartmentHead?: boolean;
  /** Real value from the employee file (slice 1). When absent the role default (decision D2) applies. */
  tracksTime?: boolean;
}

/** Decision D2: who clocks in when no employee file says otherwise. */
export const defaultTracksTime = (role: UserRole): boolean =>
  ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'DEPARTMENT_HEAD', 'STORE_ATTENDANT', 'ACCOUNTANT'].includes(role);

const widest = (a: Scope, b: Scope): Scope => (SCOPES.indexOf(a) >= SCOPES.indexOf(b) ? a : b);

/** Every capability the person holds, with its scope. Base role plus head extras, minus time.own if they do not clock. */
export const grantsOf = (subject: AccessSubject): Grants => {
  const merged: Grants = { ...(ROLE_GRANTS[subject.role] ?? {}) };
  if (subject.isDepartmentHead === true || subject.role === 'DEPARTMENT_HEAD') {
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
}

const withinScope = (subject: AccessSubject, scope: Scope, target: AccessTarget): boolean => {
  switch (scope) {
    case 'all':
      return true;
    case 'unit':
      return subject.siteId !== null && target.siteId === subject.siteId;
    case 'dept':
      return (
        subject.siteId !== null &&
        target.siteId === subject.siteId &&
        !!subject.departmentTag &&
        !!target.departmentTag &&
        sameDepartmentGroup(subject.departmentTag, target.departmentTag)
      );
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
    const subject: AccessSubject = req.user;
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
