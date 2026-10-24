import type { UserRole } from '@prisma/client';
import { CAPABILITIES, type Capability, type Grants } from './workforce-capabilities';

/**
 * Who holds what: the role-by-capability half of the Workforce access table. `workforce-access.ts` reads it (and re-exports
 * `ROLE_GRANTS`); the front end reads the result through GET /workforce/permissions/me.
 */

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

export const HEAD_EXTRAS: Grants = {
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
    'payprofile.write_bank': 'all',
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
    'payprofile.write_bank': 'all',
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
