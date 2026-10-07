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
today.read                   -    dept -    unit all  all  all
today.act                    -    dept -    unit -    -    all
timesheet.read               -    dept all  unit all  all  all
timesheet.approve            -    dept -    unit all  -    all
overtime.approve             -    dept -    unit all  -    all
clock_mistake.resolve        -    -    -    unit -    -    all
casual.record                -    dept -    -    -    -    -
casual.approve               -    -    -    unit -    -    -
casual.read                  -    dept -    unit all  all  -
leave.request                own  -    own  own  own  own  -
leave.acknowledge            -    dept -    -    -    -    -
leave.read                   -    dept -    unit all  all  all
leave.approve                -    -    -    unit all  all  all
employee.read_basic          -    dept all  unit all  all  all
employee.read_sensitive      -    -    all  -    all  all  -
employee.write_basic         -    -    -    unit all  -    all
employee.write_sensitive     -    -    -    -    all  -    -
employee.lifecycle           -    -    -    -    all  -    all
payprofile.read              -    -    all  -    all  all  -
payprofile.write             -    -    -    -    all  -    -
org.read                     -    dept -    unit all  all  all
org.write                    -    -    -    -    all  -    all
org.write_heads              -    -    -    unit all  -    all
rules.read                   -    -    all  unit all  all  all
rules.edit.lateness          -    -    -    unit -    all  all
rules.edit.overtime          -    -    -    unit -    all  all
rules.edit.attendance        -    -    -    -    -    all  all
rules.edit.leave             -    -    -    unit all  all  -
rules.edit.probation         -    -    -    -    -    all  -
rules.edit.casual_work       -    -    -    -    -    all  -
rules.edit.conduct           -    -    -    -    -    all  -
rules.edit.statutory         -    -    all  -    -    -    -
rules.edit.holidays          -    -    -    -    all  -    -
rules.edit.week_breaks       -    -    -    -    -    all  -
rules.confirm.pay_rates      -    -    all  -    -    -    -
rules.confirm.statutory      -    -    all  -    -    -    -
rules.confirm.holiday_list   -    -    -    -    -    all  -
payrun.read                  -    -    all  -    all  all  all
payrun.prepare               -    -    -    -    all  -    all
payrun.approve               -    -    all  -    -    -    all
payrun.publish               -    -    -    -    all  all  all
payrun.reopen                -    -    -    -    -    all  all
discipline.read_own          own  -    own  own  own  own  -
discipline.read              -    -    -    unit all  all  -
discipline.issue             -    -    -    unit all  -    -
audit.read_own               own  -    own  own  own  own  -
audit.read.people            -    -    -    -    all  all  -
audit.read.time              -    -    -    unit all  all  -
audit.read.leave             -    -    -    unit all  all  -
audit.read.pay_setup         -    -    -    -    all  all  -
audit.read.pay_run_prepare   -    -    -    -    all  all  -
audit.read.pay_run_decide    -    -    all  -    -    all  -
audit.read.rules_operating   -    -    -    unit -    all  all
audit.read.rules_pay         -    -    all  -    -    all  all
audit.read.payslip_access    -    -    -    -    -    all  -
audit.read.sensitive_view    -    -    -    -    -    all  -
audit.read.discipline        -    -    -    -    all  all  -
audit.read.security          -    -    -    -    -    all  all
audit.read.documents         -    -    -    -    -    all  -
audit.read.log_access        -    -    -    -    -    all  -
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
    it('passes with the capability, or with any one of several', () => {
      expect(run(subject('MANAGER'), 'rules.read').called).toBe(true);
      expect(run(subject('MANAGER'), 'payrun.approve', 'rules.read').called).toBe(true);
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
