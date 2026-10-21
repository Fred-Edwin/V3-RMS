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
  'rota.write', // edit the rota (every edit is live at once; there is no publish step)
  'rota.template_write', // add, change and retire shift templates (company-wide ones need scope all)
  'today.read',
  'today.act', // clock for someone, mark absent, extend a shift
  'time.fix', // correct a clock event or add a missing one, always with a reason (slice 3 amendment)
  'attendance.switch', // turn a site's new clock on or off (slice 3 amendment)
  // time
  'timesheet.read',
  'timesheet.approve',
  'overtime.approve',
  'timesheet.close', // approve the month, with a PIN: the site's own manager only (Segment 1A amendment)
  'timesheet.export', // export a month as PDF or Excel (Segment 1A amendment)
  'overtime.note', // a department head's one-line note on an overtime item: evidence, never a decision (Segment 1A)
  'time_request.answer', // answer a Report a problem / "clocked out by mistake" request (Segment 1A: split from timesheet.approve)
  'manager_time.decide', // decide a site manager's own days and overtime (the Director; Segment 1A)
  'clock_mistake.resolve',
  'casual.record',
  'casual.approve',
  'casual.read',
  // leave
  'leave.request',
  'leave.acknowledge',
  'leave.read',
  'leave.approve',
  'leave.balance_adjust', // Segment 4: HR adds or removes days on a balance (PIN, reason, audit)
  // people
  'employee.read_basic',
  'employee.read_sensitive', // IDs, bank, documents
  'employee.write_basic', // hire basics, job details
  'employee.write_sensitive',
  'employee.lifecycle', // exit, rehire, transfer
  'probation.note', // a note on someone's probation (slice 1 amendment)
  'payprofile.read', // other people's pay profiles
  'payprofile.write',
  'payprofile.approve', // approve or decline a pay change (slice 1 amendment)
  'org.read',
  'org.write', // departments and positions
  'org.write_heads', // assign and replace department heads
  // rules
  'rules.read',
  'rules.edit.lateness',
  'rules.edit.overtime',
  'rules.edit.attendance',
  'rules.edit.leave_types', // leave types and the default policy (HR)
  'rules.edit.min_cover', // minimum cover; unit scope writes the person's own site (1B, decision D5)
  'rules.edit.holiday_pay', // the pay rate for hours worked on a public holiday (Accountant, 1B decision D4)
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
  'payroll.read', // the Payroll page and the statutory tables card (replaces payrun.read)
  'payroll.review', // HR: tick lines, add adjustments, leave people out, recalculate, send to the Accountant
  'payroll.approve', // Accountant: approve with a PIN, send back
  'payroll.publish', // HR (part 2)
  'payroll.pay', // Accountant: bank file, mark paid (part 2)
  'payroll.correct', // HR and Accountant (part 2)
  'payroll.export', // Accountant, HR, Director (part 2)
  'payroll.remind', // HR, Accountant, Director: remind a site that has not approved
  'payroll.estimate.read', // the Director's estimate of the open month
  'payroll.approve_site_late', // Director: approve a site's timesheet month for it, 5 days after month end (P4)
  'payslip.read_any', // HR, Accountant: open anyone's payslip from Payroll, no staff code, audited, the Director told (Segment 3, PD5)
  'p9.generate', // HR, Accountant: build a P9 for a leaver (Segment 3, PD13)
  'p9.confirm_format', // Accountant: confirm the P9 layout once, with a PIN (Segment 3, PD14)
  // conduct
  'discipline.read_own',
  'discipline.read',
  'discipline.issue',
  'discipline.decide', // Segment 5: HR decides appeals and changes notices; the Director decides notices HR issued (the service narrows it)
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
  // Segment 6a (Shared parts): Needs you, notifications, security alerts and phones, chain check
  'needs_you.read', // the Needs you card, its counts (badges) and the Overdue list for the Director
  'needs_you.remind', // Director: send a reminder on an overdue item
  'notifications.own', // the Inbox Notifications tab: my own rows only
  'security.alerts.read', // System Admin: the security alert list and its counts
  'security.alerts.clear', // System Admin: clear an alert with a one-line note; start alerts
  'security.phones.own', // my own phones: confirm, remove, "This wasn't me"
  'audit.verify_chain', // Director, System Admin: check the audit chain
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type Grants = Partial<Record<Capability, Scope>>;

type AuditReadCapability = `audit.read.${Lowercase<AuditCategoryCode>}`;
/** Compile-time check: every audit category has its read capability (fails the build if one is missing). */
export const AUDIT_CAPABILITIES_COMPLETE: Exclude<AuditReadCapability, Capability> extends never ? true : never = true;

export const auditReadCapability = (category: AuditCategoryCode): Capability => `audit.read.${category.toLowerCase()}` as AuditReadCapability;

/**
 * What the Director and the System Admin do NOT get at scope all. Own-file capabilities (the Director has them at scope
 * own; the System Admin has no file); steps that belong to one role by design (the Accountant approves and pays, HR
 * prepares and publishes payroll, HR decides conduct notices it issues, the site's own manager closes the month);
 * opening anyone's payslip (HR, Accountant, audited, the Director told).
 */
const NOT_FULL: ReadonlySet<Capability> = new Set<Capability>([
  'me.file', 'me.payslip', 'me.payprofile', 'time.own', 'leave.request', 'discipline.read_own', 'audit.read_own',
  'notifications.own', 'security.phones.own',
  'timesheet.close', 'discipline.decide', 'payslip.read_any',
  'payroll.review', 'payroll.approve', 'payroll.publish', 'payroll.pay', 'payroll.correct',
  'p9.generate', 'p9.confirm_format', 'rules.confirm.pay_rates', 'rules.confirm.statutory',
]);
const FULL_ACCESS: Grants = Object.fromEntries(CAPABILITIES.filter((c) => !NOT_FULL.has(c)).map((c) => [c, 'all' as const]));

const OWN_FILE: Grants = {
  'me.file': 'own',
  'me.payslip': 'own',
  'me.payprofile': 'own',
  'leave.request': 'own',
  'discipline.read_own': 'own',
  'audit.read_own': 'own',
};

/** Segment 6a: every signed-in person (the System Admin included) reads their own notifications and manages their own phones. */
const OWN_SHARED_6A: Grants = { 'notifications.own': 'own', 'security.phones.own': 'own' };

const STAFF: Grants = { ...OWN_FILE, ...OWN_SHARED_6A, 'time.own': 'own', 'rota.read': 'own' };

const HEAD_EXTRAS: Grants = {
  'rota.read': 'dept',
  'rota.write': 'dept',
  'today.read': 'dept',
  'today.act': 'dept',
  'overtime.note': 'dept', // the head decides nothing; a one-line note is evidence (Segment 1A)
  'casual.record': 'dept',
  'casual.read': 'dept',
  'leave.acknowledge': 'dept',
  'leave.read': 'dept',
  'employee.read_basic': 'dept',
  'probation.note': 'dept',
  'org.read': 'dept',
};

const UNIT_MANAGER: Grants = {
  ...OWN_FILE,
  ...OWN_SHARED_6A,
  'needs_you.read': 'unit', // Segment 6a: their site's rows only
  'rota.read': 'unit',
  'rota.write': 'unit',
  'rota.template_write': 'unit',
  'today.read': 'unit',
  'today.act': 'unit',
  'time.fix': 'unit',
  'timesheet.read': 'unit',
  'timesheet.approve': 'unit',
  'overtime.approve': 'unit',
  'timesheet.close': 'unit',
  'timesheet.export': 'unit',
  'time_request.answer': 'unit',
  'clock_mistake.resolve': 'unit', // Store Manager resolves the Store Attendants' (decision D8)
  'casual.approve': 'unit',
  'casual.read': 'unit',
  'leave.read': 'unit',
  'leave.approve': 'unit', // never their own; a manager's own request goes to HR
  'employee.read_basic': 'unit',
  'employee.write_basic': 'unit',
  'probation.note': 'unit',
  'rules.read': 'unit',
  'rules.edit.lateness': 'unit', // own site only: writes a site override
  'rules.edit.overtime': 'unit',
  'rules.edit.min_cover': 'unit', // minimum cover only
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
    'timesheet.export': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'payprofile.read': 'all',
    'rules.read': 'all',
    'rules.edit.statutory': 'all',
    'rules.edit.holiday_pay': 'all',
    'rules.confirm.pay_rates': 'all',
    'rules.confirm.statutory': 'all',
    'payroll.read': 'all',
    'payroll.approve': 'all',
    'payroll.pay': 'all',
    'payroll.correct': 'all',
    'payroll.export': 'all',
    'payroll.remind': 'all',
    'payroll.estimate.read': 'all',
    'payslip.read_any': 'all',
    'p9.generate': 'all',
    'p9.confirm_format': 'all',
    'casual.read': 'all',
    'audit.read.pay_run_decide': 'all',
    'audit.read.rules_pay': 'all',
    'audit.read.pay_run_prepare': 'all', // Segment 6a, SD4: publishing, corrections and exports
    'needs_you.read': 'all', // Segment 6a
  },
  MANAGER: UNIT_MANAGER,
  STORE_MANAGER: UNIT_MANAGER,
  HR_MANAGER: {
    ...OWN_FILE,
    ...OWN_SHARED_6A,
    'rota.read': 'all',
    'rota.write': 'all', // also builds the Accountant's rota (decision D18)
    'rota.template_write': 'all',
    'today.read': 'all',
    'time.fix': 'all',
    'timesheet.read': 'all',
    'timesheet.export': 'all',
    'time_request.answer': 'all',
    'casual.read': 'all',
    'leave.read': 'all',
    'leave.approve': 'all',
    'employee.read_basic': 'all',
    'employee.read_sensitive': 'all',
    'employee.write_basic': 'all',
    'employee.write_sensitive': 'all',
    'employee.lifecycle': 'all',
    'probation.note': 'all',
    'payprofile.read': 'all',
    'payprofile.write': 'all',
    'org.read': 'all',
    'org.write': 'all',
    'org.write_heads': 'all',
    'rules.read': 'all',
    'leave.balance_adjust': 'all', // Segment 4: HR only (L26)
    'rules.edit.leave_types': 'all',
    'payroll.read': 'all',
    'payroll.review': 'all',
    'payroll.publish': 'all',
    'payroll.correct': 'all',
    'payroll.export': 'all',
    'payroll.remind': 'all',
    'payroll.estimate.read': 'all',
    'payslip.read_any': 'all',
    'p9.generate': 'all',
    'discipline.read': 'all',
    'discipline.issue': 'all',
    'discipline.decide': 'all',
    'audit.read.people': 'all',
    'audit.read.time': 'all',
    'audit.read.leave': 'all',
    'audit.read.pay_setup': 'all',
    'audit.read.pay_run_prepare': 'all',
    'audit.read.discipline': 'all',
    'audit.read.rules_operating': 'all', // Segment 6a, SD4: every rule change, read only
    'audit.read.rules_pay': 'all',
    'needs_you.read': 'all', // Segment 6a
  },
  // Owner decision, 21 Oct 2026 (replaces D2 and D15): the Director and the System Admin read and write everything
  // except the steps in NOT_FULL. The System Admin still has no file, payslip or clock of its own.
  DIRECTOR: { ...FULL_ACCESS, ...OWN_FILE, ...OWN_SHARED_6A, 'timesheet.close': 'unit', 'discipline.decide': 'all' /* the service narrows it to notices HR issued */ },
  SYSTEM_ADMIN: { ...FULL_ACCESS, ...OWN_SHARED_6A },
};

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
