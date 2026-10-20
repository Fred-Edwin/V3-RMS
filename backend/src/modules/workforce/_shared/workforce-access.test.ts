import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { AUDIT_CATEGORIES } from './audit/audit.types';
import {
  AUDIT_CAPABILITIES_COMPLETE,
  CAPABILITIES,
  ROLE_GRANTS,
  assertInScope,
  assertNotSelf,
  auditReadCapability,
  defaultTracksTime,
  grantsOf,
  inScope,
  lockedGroupsFor,
  redactSensitive,
  requireCapability,
  scopeOf,
  type AccessSubject,
  type Capability,
  type Scope,
} from './workforce-access';
import { RULE_FIELD_POLICY } from '../rules/rules-field-policy';

/**
 * The matrix of contract section 3.3, written out by hand. Columns:
 * Staff/Store Att | Head extra | Accountant | Branch/Store Mgr | HR | Director | Sys Admin.  '-' = none.
 */
const MATRIX = `
me.file                      own  -    own  own  own  own  -
me.payslip                   own  -    own  own  own  own  -
me.payprofile                own  -    own  own  own  own  -
time.own                     own  -    own  -    -    -    -
rota.read                    own  dept own  unit all  all  all
rota.write                   -    dept -    unit all  -    all
rota.template_write          -    -    -    unit all  all  all
today.read                   -    dept -    unit all  all  all
today.act                    -    dept -    unit -    -    all
time.fix                     -    -    -    unit all  -    all
attendance.switch            -    -    -    -    -    -    all
timesheet.read               -    -    all  unit all  all  all
timesheet.approve            -    -    -    unit -    -    -
overtime.approve             -    -    -    unit -    -    -
timesheet.close              -    -    -    unit -    unit -
timesheet.export             -    -    all  unit all  -    -
overtime.note                -    dept -    -    -    -    -
time_request.answer          -    -    -    unit all  -    all
manager_time.decide          -    -    -    -    -    all  -
clock_mistake.resolve       -    -    -    unit -    -    all
casual.record                -    dept -    -    -    -    -
casual.approve               -    -    -    unit -    all  -
casual.read                  -    dept all  unit all  all  -
leave.request                own  -    own  own  own  own  -
leave.acknowledge            -    dept -    -    -    -    -
leave.read                   -    dept -    unit all  all  all
leave.approve                -    -    -    unit all  all  all
leave.balance_adjust         -    -    -    -    all  -    -
employee.read_basic          -    dept all  unit all  all  all
employee.read_sensitive      -    -    all  -    all  all  -
employee.write_basic         -    -    -    unit all  -    all
employee.write_sensitive     -    -    -    -    all  -    -
employee.lifecycle           -    -    -    -    all  -    all
probation.note               -    dept -    unit all  -    -
payprofile.read              -    -    all  -    all  all  -
payprofile.write             -    -    -    -    all  -    -
payprofile.approve           -    -    -    -    -    all  -
org.read                     -    dept -    unit all  all  all
org.write                    -    -    -    -    all  -    all
org.write_heads              -    -    -    unit all  -    all
rules.read                   -    -    all  unit all  all  all
rules.edit.lateness          -    -    -    unit -    all  -
rules.edit.overtime          -    -    -    unit -    all  -
rules.edit.attendance        -    -    -    -    -    all  -
rules.edit.leave_types       -    -    -    -    all  -    -
rules.edit.min_cover         -    -    -    unit -    all  all
rules.edit.holiday_pay       -    -    all  -    -    -    -
rules.edit.probation         -    -    -    -    -    all  -
rules.edit.casual_work       -    -    -    -    -    all  -
rules.edit.conduct           -    -    -    -    -    all  -
rules.edit.statutory         -    -    all  -    -    -    -
rules.edit.holidays          -    -    -    -    -    all  -
rules.edit.week_breaks       -    -    -    -    -    all  -
rules.confirm.pay_rates      -    -    all  -    -    -    -
rules.confirm.statutory      -    -    all  -    -    -    -
rules.confirm.holiday_list   -    -    -    -    -    all  -
payroll.read                 -    -    all  -    all  all  all
payroll.review               -    -    -    -    all  -    -
payroll.approve              -    -    all  -    -    -    -
payroll.publish              -    -    -    -    all  -    -
payroll.pay                  -    -    all  -    -    -    -
payroll.correct              -    -    all  -    all  -    -
payroll.export               -    -    all  -    all  all  -
payroll.remind               -    -    all  -    all  all  -
payroll.estimate.read        -    -    all  -    all  all  all
payroll.approve_site_late    -    -    -    -    -    all  -
payslip.read_any             -    -    all  -    all  -    -
p9.generate                  -    -    all  -    all  -    -
p9.confirm_format            -    -    all  -    -    -    -
discipline.read_own          own  -    own  own  own  own  -
discipline.read              -    -    -    unit all  all  -
discipline.issue             -    -    -    unit all  -    -
audit.read_own               own  -    own  own  own  own  -
audit.read.people            -    -    -    -    all  all  -
audit.read.time              -    -    -    unit all  all  -
audit.read.leave             -    -    -    unit all  all  -
audit.read.pay_setup         -    -    -    -    all  all  -
audit.read.pay_run_prepare   -    -    all  -    all  all  -
audit.read.pay_run_decide    -    -    all  -    -    all  -
audit.read.rules_operating   -    -    -    unit all  all  all
audit.read.rules_pay         -    -    all  -    all  all  all
audit.read.payslip_access    -    -    -    -    -    all  -
audit.read.sensitive_view    -    -    -    -    -    all  -
audit.read.discipline        -    -    -    -    all  all  -
audit.read.security          -    -    -    -    -    all  all
audit.read.documents         -    -    -    -    -    all  -
audit.read.log_access        -    -    -    -    -    all  -
needs_you.read               -    -    all  unit all  all  all
needs_you.remind             -    -    -    -    -    all  -
notifications.own            own  -    own  own  own  own  own
security.alerts.read         -    -    -    -    -    -    all
security.alerts.clear        -    -    -    -    -    -    all
security.phones.own          own  -    own  own  own  own  own
audit.verify_chain           -    -    -    -    -    all  all
`;

const COLUMNS = ['staff', 'head', 'accountant', 'manager', 'hr', 'director', 'admin'] as const;
type Column = (typeof COLUMNS)[number];
const matrix = new Map<Capability, Record<Column, Scope | null>>();
for (const line of MATRIX.trim().split('\n')) {
  const [capability, ...cells] = line.trim().split(/\s+/);
  const row = {} as Record<Column, Scope | null>;
  COLUMNS.forEach((column, index) => {
    const cell = cells[index];
    row[column] = cell === '-' || cell === undefined ? null : (cell as Scope);
  });
  matrix.set(capability as Capability, row);
}

const SCOPE_ORDER: Scope[] = ['own', 'dept', 'unit', 'all'];
const subject = (role: UserRole, extra: Partial<AccessSubject> = {}): AccessSubject => ({ id: 'u1', role, siteId: 's1', ...extra });

const ROLE_COLUMN: [UserRole, Column][] = [
  ['WAITER', 'staff'],
  ['CHEF', 'staff'],
  ['BARISTA', 'staff'],
  ['STEWARD', 'staff'],
  ['HOUSEKEEPING', 'staff'],
  ['STORE_ATTENDANT', 'staff'],
  ['ACCOUNTANT', 'accountant'],
  ['MANAGER', 'manager'],
  ['STORE_MANAGER', 'manager'],
  ['HR_MANAGER', 'hr'],
  ['DIRECTOR', 'director'],
  ['SYSTEM_ADMIN', 'admin'],
];

describe('the matrix covers exactly the capability list', () => {
  it('has a row for every capability and no extra', () => {
    expect([...matrix.keys()].sort()).toEqual([...CAPABILITIES].sort());
  });
  it('every capability is held by someone', () => {
    for (const capability of CAPABILITIES) {
      const row = matrix.get(capability)!;
      expect(Object.values(row).some((scope) => scope !== null), capability).toBe(true);
    }
  });
});

describe.each(ROLE_COLUMN)('%s', (role, column) => {
  it('holds exactly the capabilities and scopes of the matrix (the rest are refused)', () => {
    const base = subject(role);
    for (const capability of CAPABILITIES) {
      let expected = matrix.get(capability)![column];
      // time.own is dropped when the role does not clock in (decision D2); the matrix shows the clocking roles.
      if (capability === 'time.own' && !defaultTracksTime(role)) expected = null;
      expect(scopeOf(base, capability), `${role} ${capability}`).toBe(expected);
    }
  });
});

describe('device roles and unknown roles', () => {
  it.each(['KITCHEN_DISPLAY', 'BARISTA_DISPLAY'] as UserRole[])('%s holds nothing', (role) => {
    expect(grantsOf(subject(role))).toEqual({});
    expect(ROLE_GRANTS[role]).toBeUndefined();
  });
});

describe('department heads', () => {
  it.each(['WAITER', 'CHEF', 'BARISTA', 'STORE_ATTENDANT'] as UserRole[])('%s head gets base plus extras, the wider scope winning', (role) => {
    const grants = grantsOf(subject(role, { isDepartmentHead: true, departmentTag: 'KITCHEN' }));
    for (const capability of CAPABILITIES) {
      const staff = matrix.get(capability)!.staff;
      const extra = matrix.get(capability)!.head;
      let expected: Scope | null = staff;
      if (extra && (staff === null || SCOPE_ORDER.indexOf(extra) > SCOPE_ORDER.indexOf(staff))) expected = extra;
      if (capability === 'time.own' && !defaultTracksTime(role)) expected = null;
      expect(grants[capability] ?? null, `${role} head ${capability}`).toBe(expected);
    }
  });

  it('legacy DEPARTMENT_HEAD behaves as staff plus the head marker', () => {
    expect(scopeOf(subject('DEPARTMENT_HEAD'), 'rota.write')).toBe('dept');
    expect(scopeOf(subject('DEPARTMENT_HEAD'), 'me.payslip')).toBe('own');
    expect(scopeOf(subject('DEPARTMENT_HEAD'), 'time.own')).toBe('own');
  });

  it('a Kitchen head covers a Pastry target, but not Barista, and not another site', () => {
    const head = subject('CHEF', { isDepartmentHead: true, departmentTag: 'KITCHEN' });
    expect(inScope(head, 'rota.write', { userId: 'x', siteId: 's1', departmentTag: 'PASTRY' })).toBe(true);
    expect(inScope(head, 'rota.write', { userId: 'x', siteId: 's1', departmentTag: 'BARISTA' })).toBe(false);
    expect(inScope(head, 'rota.write', { userId: 'x', siteId: 's2', departmentTag: 'KITCHEN' })).toBe(false);
  });

  describe('head rows (slice 1): the department ids are the only source of scope', () => {
    const pastryHead = subject('CHEF', { headOfDepartmentIds: ['d-pastry'], departmentTag: 'PASTRY', isDepartmentHead: true });
    it('a Pastry head covers Pastry people and no longer Kitchen people', () => {
      expect(inScope(pastryHead, 'employee.read_basic', { userId: 'x', siteId: 's1', departmentId: 'd-pastry', departmentTag: 'PASTRY' })).toBe(true);
      expect(inScope(pastryHead, 'employee.read_basic', { userId: 'x', siteId: 's1', departmentId: 'd-kitchen', departmentTag: 'KITCHEN' })).toBe(false);
    });
    it('a head of a department with no inventory tag is covered by its id alone', () => {
      const bakery = subject('WAITER', { headOfDepartmentIds: ['d-bakery'] });
      expect(scopeOf(bakery, 'employee.read_basic')).toBe('dept');
      expect(inScope(bakery, 'employee.read_basic', { userId: 'x', siteId: 's1', departmentId: 'd-bakery' })).toBe(true);
      expect(inScope(bakery, 'employee.read_basic', { userId: 'x', siteId: 's1', departmentId: null })).toBe(false);
      expect(inScope(bakery, 'employee.read_basic', { userId: 'x', siteId: 's2', departmentId: 'd-bakery' })).toBe(false);
    });
    it('no head rows means no head extras', () => {
      expect(scopeOf(subject('WAITER', { headOfDepartmentIds: [] }), 'employee.read_basic')).toBeNull();
    });
    it('claim-only subjects (no head rows loaded) keep the tag-group rule', () => {
      const claimOnly = subject('CHEF', { isDepartmentHead: true, departmentTag: 'KITCHEN' });
      expect(inScope(claimOnly, 'employee.read_basic', { userId: 'x', siteId: 's1', departmentId: 'd-x', departmentTag: 'PASTRY' })).toBe(true);
    });
    it('the Branch Manager keeps unit scope and the head extra does not narrow it', () => {
      const manager = subject('MANAGER', { headOfDepartmentIds: ['d-pastry'] });
      expect(scopeOf(manager, 'employee.read_basic')).toBe('unit');
    });
  });
});

describe('the pay-change split', () => {
  it('only the Director approves and only HR requests, so nobody approves their own', () => {
    expect(scopeOf(subject('DIRECTOR'), 'payprofile.approve')).toBe('all');
    expect(scopeOf(subject('DIRECTOR'), 'payprofile.write')).toBeNull();
    expect(scopeOf(subject('HR_MANAGER'), 'payprofile.write')).toBe('all');
    expect(scopeOf(subject('HR_MANAGER'), 'payprofile.approve')).toBeNull();
  });
});

describe('tracks time', () => {
  it('time.own is dropped when the person does not track time, and never held by managers', () => {
    expect(scopeOf(subject('WAITER', { tracksTime: false }), 'time.own')).toBeNull();
    expect(scopeOf(subject('WAITER'), 'time.own')).toBe('own');
    expect(scopeOf(subject('MANAGER'), 'time.own')).toBeNull();
  });
  it('defaults follow decision D2', () => {
    expect(defaultTracksTime('ACCOUNTANT')).toBe(true);
    expect(defaultTracksTime('STORE_ATTENDANT')).toBe(true);
    for (const role of ['MANAGER', 'STORE_MANAGER', 'DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN'] as UserRole[]) expect(defaultTracksTime(role)).toBe(false);
  });
});

describe('scope checks', () => {
  const target = { userId: 'other', siteId: 's1', departmentTag: null };
  it('own, unit and all', () => {
    expect(inScope(subject('WAITER'), 'me.file', { userId: 'u1', siteId: 's1' })).toBe(true);
    expect(inScope(subject('WAITER'), 'me.file', { userId: 'other', siteId: 's1' })).toBe(false);
    expect(inScope(subject('MANAGER'), 'timesheet.read', target)).toBe(true);
    expect(inScope(subject('MANAGER'), 'timesheet.read', { ...target, siteId: 's2' })).toBe(false);
    expect(inScope(subject('HR_MANAGER'), 'timesheet.read', { ...target, siteId: 's2' })).toBe(true);
  });
  it('a unit holder with no site is refused', () => {
    expect(inScope(subject('MANAGER', { siteId: null }), 'timesheet.read', { userId: 'x', siteId: null })).toBe(false);
  });
  it('a capability that is not held is refused', () => {
    expect(inScope(subject('WAITER'), 'timesheet.approve', target)).toBe(false);
  });
});

describe('guards', () => {
  it('assertInScope gives 403 for writes and 404 for reads', () => {
    const other = { userId: 'x', siteId: 's2' };
    expect(() => assertInScope(subject('MANAGER'), 'timesheet.approve', other)).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(() => assertInScope(subject('MANAGER'), 'timesheet.read', other, 'not_found')).toThrow(expect.objectContaining({ statusCode: 404 }));
    expect(() => assertInScope(subject('MANAGER'), 'timesheet.read', { userId: 'x', siteId: 's1' })).not.toThrow();
  });

  it('assertNotSelf', () => {
    expect(() => assertNotSelf(subject('MANAGER'), { userId: 'u1', siteId: 's1' })).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(() => assertNotSelf(subject('MANAGER'), { userId: 'other', siteId: 's1' })).not.toThrow();
    expect(() => assertNotSelf(subject('MANAGER'), { userId: null, siteId: 's1' })).not.toThrow();
  });

  describe('requireCapability', () => {
    const run = (user: AccessSubject | undefined, ...caps: Capability[]): { error: unknown; called: boolean } => {
      let called = false;
      const next: NextFunction = () => {
        called = true;
      };
      try {
        requireCapability(...caps)({ user } as unknown as Request, {} as Response, next);
        return { error: null, called };
      } catch (error) {
        return { error, called };
      }
    };
    it('401 without a user', () => {
      expect(run(undefined, 'rules.read').error).toMatchObject({ statusCode: 401 });
    });
    it('403 without the capability', () => {
      expect(run(subject('WAITER'), 'rules.read').error).toMatchObject({ statusCode: 403 });
    });
    it('prefers req.workforceSubject over req.user when it is set', () => {
      let called = false;
      const next: NextFunction = () => {
        called = true;
      };
      const req = {
        user: subject('WAITER'),
        workforceSubject: subject('WAITER', { headOfDepartmentIds: ['d1'] }),
      } as unknown as Request;
      requireCapability('employee.read_basic')(req, {} as Response, next);
      expect(called).toBe(true);
    });
    it('passes with the capability, or with any one of several', () => {
      expect(run(subject('MANAGER'), 'rules.read').called).toBe(true);
      expect(run(subject('MANAGER'), 'payroll.approve', 'rules.read').called).toBe(true);
    });
  });
});

describe('sensitive fields', () => {
  const someoneElse = { userId: 'other', siteId: 's1' };
  it('Branch Manager sees hours, not pay, bank, ids, documents or payslip opens; discipline is open for the unit', () => {
    expect(lockedGroupsFor(subject('MANAGER'), someoneElse).sort()).toEqual(['bank', 'documents', 'ids', 'pay', 'payslip_opens']);
  });
  it('HR sees all but payslip opens', () => {
    expect(lockedGroupsFor(subject('HR_MANAGER'), someoneElse)).toEqual(['payslip_opens']);
  });
  it('Accountant sees pay, bank, ids and documents; discipline and payslip opens are locked', () => {
    expect(lockedGroupsFor(subject('ACCOUNTANT'), someoneElse).sort()).toEqual(['discipline', 'payslip_opens']);
  });
  it('the Director sees everything, payslip opens included; nobody else does', () => {
    expect(lockedGroupsFor(subject('DIRECTOR'), someoneElse)).toEqual([]);
    for (const role of ['HR_MANAGER', 'ACCOUNTANT', 'MANAGER', 'SYSTEM_ADMIN'] as UserRole[]) {
      expect(lockedGroupsFor(subject(role), someoneElse)).toContain('payslip_opens');
    }
  });
  it('a person on their own record sees their own pay, bank, ids, documents, discipline and payslip opens', () => {
    expect(lockedGroupsFor(subject('WAITER'), { userId: 'u1', siteId: 's1' })).toEqual([]);
  });
  it('a head looking at a team member sees no pay', () => {
    const head = subject('WAITER', { isDepartmentHead: true, departmentTag: 'SERVICE' as never });
    expect(lockedGroupsFor(head, { userId: 'x', siteId: 's1', departmentTag: 'SERVICE' as never })).toContain('pay');
  });
  it('the System Admin sees no pay, bank, ids or documents', () => {
    expect(lockedGroupsFor(subject('SYSTEM_ADMIN'), someoneElse)).toEqual(expect.arrayContaining(['pay', 'bank', 'ids', 'documents']));
  });

  it('redactSensitive removes locked keys and says which groups are locked', () => {
    const record = { name: 'A', salary: 100, bankAccount: '1', nationalId: '2' };
    const { data, locked } = redactSensitive(subject('MANAGER'), someoneElse, record, { pay: ['salary'], bank: ['bankAccount'], ids: ['nationalId'] });
    expect(data).toEqual({ name: 'A' });
    expect(locked).toEqual(expect.arrayContaining(['pay', 'bank', 'ids']));
    const hr = redactSensitive(subject('HR_MANAGER'), someoneElse, record, { pay: ['salary'], bank: ['bankAccount'] });
    expect(hr.data).toEqual(record);
  });
});

describe('audit capabilities', () => {
  it('every audit category has its read capability', () => {
    expect(AUDIT_CAPABILITIES_COMPLETE).toBe(true);
    for (const category of AUDIT_CATEGORIES) expect(CAPABILITIES).toContain(auditReadCapability(category));
  });
});

/**
 * Rules permissions, one test per row of the table in the 1B spec (section 14). C = may change a row for the company or the
 * site they stand at, P = reads but cannot change. The field policy says which capability each row needs.
 */
describe('Rules permissions table (1B, section 14)', () => {
  const policy = RULE_FIELD_POLICY as Record<string, Record<string, { edit: Capability | null; site: boolean }>>;
  const ROLES: [string, UserRole][] = [
    ['Director', 'DIRECTOR'],
    ['Branch Manager', 'MANAGER'],
    ['Store Manager', 'STORE_MANAGER'],
    ['HR', 'HR_MANAGER'],
    ['Accountant', 'ACCOUNTANT'],
    ['System Admin', 'SYSTEM_ADMIN'],
  ];
  // Can this role write this field for the company (siteId null) or, standing at its own site, for that site's own rule?
  const mayChange = (role: UserRole, group: string, field: string, at: 'company' | 'own-site'): boolean => {
    const capability = policy[group]?.[field]?.edit ?? null;
    if (!capability) return false;
    const scope = scopeOf(subject(role), capability);
    if (scope === 'all') return true;
    return scope === 'unit' && at === 'own-site' && policy[group]?.[field]?.site === true; // only a row a site may own
  };
  const row = (group: string, field: string, expected: Record<string, 'C' | 'P' | 'own'>): void => {
    for (const [label, role] of ROLES) {
      const want = expected[label];
      expect(want, `${label} is missing from the row`).toBeDefined();
      const actual = mayChange(role, group, field, 'company') ? 'C' : mayChange(role, group, field, 'own-site') ? 'own' : 'P';
      expect(actual, `${label} ${group}.${field}`).toBe(want);
    }
  };
  const readsEverything = ['DIRECTOR', 'MANAGER', 'STORE_MANAGER', 'HR_MANAGER', 'ACCOUNTANT', 'SYSTEM_ADMIN'] as UserRole[];

  it('open the page (rules.read): the six desk roles; never heads or floor staff', () => {
    for (const role of readsEverything) expect(scopeOf(subject(role), 'rules.read'), role).not.toBeNull();
    expect(scopeOf(subject('MANAGER'), 'rules.read')).toBe('unit');
    expect(scopeOf(subject('STORE_MANAGER'), 'rules.read')).toBe('unit');
    for (const role of ['WAITER', 'CHEF', 'BARISTA', 'STEWARD', 'HOUSEKEEPING', 'STORE_ATTENDANT'] as UserRole[]) expect(scopeOf(subject(role), 'rules.read'), role).toBeNull();
    expect(scopeOf(subject('WAITER', { isDepartmentHead: true }), 'rules.read')).toBeNull();
  });

  it('Lateness, all rows but the cap: the Director changes, Branch and Store Managers change their own site, the rest read', () => {
    for (const field of ['graceMinutes', 'policy', 'afterLatesPerMonth', 'makeUpSameDay', 'excuseWindowHours']) {
      row('LATENESS', field, { Director: 'C', 'Branch Manager': 'own', 'Store Manager': 'own', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
    }
  });

  it('Lateness, deduction cap: the Director only (a site cannot own it)', () => {
    expect(policy['LATENESS']?.['deductionCapPercentOfPay']).toMatchObject({ edit: 'rules.edit.lateness', site: false });
    expect(mayChange('MANAGER', 'LATENESS', 'deductionCapPercentOfPay', 'company')).toBe(false);
    expect(mayChange('DIRECTOR', 'LATENESS', 'deductionCapPercentOfPay', 'company')).toBe(true);
  });

  it('Overtime tail, caps, budget and window: the Director and a manager at their own site', () => {
    for (const field of ['serviceTailMinutes', 'weeklyCapMinutes', 'branchBudgetMinutesPerPeriod', 'approvalWindowHours']) {
      row('OVERTIME', field, { Director: 'C', 'Branch Manager': 'own', 'Store Manager': 'own', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
    }
  });

  it('Overtime multiplier: the Director changes it and the Accountant confirms it', () => {
    row('OVERTIME', 'multipliers', { Director: 'C', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
    expect(scopeOf(subject('ACCOUNTANT'), 'rules.confirm.pay_rates')).toBe('all');
    expect(scopeOf(subject('DIRECTOR'), 'rules.confirm.pay_rates')).toBeNull();
  });

  it('Attendance: the Director alone changes it', () => {
    row('ATTENDANCE', 'undoWindowSeconds', { Director: 'C', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
  });

  it('Leave types and the default policy: HR alone (the Director does not)', () => {
    for (const field of ['leaveTypes', 'defaultPolicy']) row('LEAVE', field, { Director: 'P', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'C', Accountant: 'P', 'System Admin': 'P' });
  });

  it('Leave minimum cover: the Director and System Admin anywhere, the manager at their own site; HR and the Accountant read', () => {
    row('LEAVE', 'minimumCover', { Director: 'C', 'Branch Manager': 'own', 'Store Manager': 'own', HR: 'P', Accountant: 'P', 'System Admin': 'C' });
  });

  it('Probation, casual rates and the cash holder, conduct months and limits: the Director alone', () => {
    for (const [group, field] of [['PROBATION', 'defaultMonths'], ['PROBATION', 'reportDays'], ['CASUAL_WORK', 'rates'], ['CASUAL_WORK', 'pettyCashHolder'], ['CONDUCT', 'levels'], ['CONDUCT', 'appealWithinDays']] as const) {
      row(group, field, { Director: 'C', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
    }
  });

  it('Casual who records and who approves, the unpaid break, rounding: Fixed for everyone (no editor at all)', () => {
    expect(policy['CASUAL_WORK']?.['latenessReducesPayout']?.edit).toBeNull();
    expect(policy['ATTENDANCE']?.['roundingMinutes']?.edit).toBeNull();
    expect(policy['WEEK_AND_BREAKS']?.['timesheetPeriod']?.edit).toBeNull();
  });

  it('Statutory: the Accountant changes and confirms; the Director, HR and System Admin read it; a manager has no payroll.read and gets the locked card', () => {
    row('STATUTORY', 'tables', { Director: 'P', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'C', 'System Admin': 'P' });
    expect(scopeOf(subject('ACCOUNTANT'), 'rules.confirm.statutory')).toBe('all');
    for (const role of ['DIRECTOR', 'HR_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT'] as UserRole[]) expect(scopeOf(subject(role), 'payroll.read'), role).toBe('all');
    for (const role of ['MANAGER', 'STORE_MANAGER'] as UserRole[]) expect(scopeOf(subject(role), 'payroll.read'), role).toBeNull();
  });

  it('Holidays list: the Director changes and confirms it', () => {
    row('HOLIDAYS', 'holidays', { Director: 'C', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
    expect(scopeOf(subject('DIRECTOR'), 'rules.confirm.holiday_list')).toBe('all');
  });

  it('Holiday pay rate: the Accountant changes and confirms it; the Director only reads', () => {
    row('HOLIDAYS', 'payMultiplier', { Director: 'P', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'C', 'System Admin': 'P' });
    expect(scopeOf(subject('ACCOUNTANT'), 'rules.confirm.pay_rates')).toBe('all');
  });

  it('Week starts on: the Director alone; the unpaid break is Fixed', () => {
    row('WEEK_AND_BREAKS', 'weekStartsOn', { Director: 'C', 'Branch Manager': 'P', 'Store Manager': 'P', HR: 'P', Accountant: 'P', 'System Admin': 'P' });
  });

  it('the System Admin and HR hold no capability that changes lateness, overtime or attendance (decision D6)', () => {
    for (const capability of ['rules.edit.lateness', 'rules.edit.overtime', 'rules.edit.attendance', 'rules.edit.holidays', 'rules.edit.statutory'] as Capability[]) {
      expect(scopeOf(subject('SYSTEM_ADMIN'), capability), capability).toBeNull();
      expect(scopeOf(subject('HR_MANAGER'), capability), capability).toBeNull();
    }
  });

  it('the old combined leave capability is gone', () => {
    expect(CAPABILITIES).not.toContain('rules.edit.leave');
  });
});
