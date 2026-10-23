import { createHash } from 'node:crypto';
import { ROLE_GRANTS, scopeOf, workforceCan, type AccessSubject, type Capability } from '../_shared/workforce-access';
import { homeAudienceOf } from './home-audience';

/**
 * "Not available for your role" (Paper 10.1, 10.2). The one refusal screen says who the page is for, and that line comes from the
 * access table: the roles whose row holds the capability that opens the page. The page-to-capability list below is the only thing
 * written here; the roles are never typed out. A page not listed gets the plain line without a "for".
 */

const PAGE_CAPABILITIES: ReadonlyArray<{ prefix: string; label: string; capabilities: readonly Capability[] }> = [
  { prefix: '/app/workforce/payroll', label: 'Payroll', capabilities: ['payroll.read'] },
  { prefix: '/app/workforce/rules', label: 'Rules', capabilities: ['rules.read'] },
  { prefix: '/app/workforce/security', label: 'Security alerts', capabilities: ['security.alerts.read'] },
  { prefix: '/app/workforce/audit-log', label: 'Audit log', capabilities: ['audit.read.people', 'audit.read.time', 'audit.read.leave', 'audit.read.security'] },
  { prefix: '/app/workforce/employees', label: 'Employees', capabilities: ['employee.read_basic'] },
  { prefix: '/app/workforce/organisation', label: 'Organisation', capabilities: ['org.read'] },
  { prefix: '/app/workforce/timesheets', label: 'Timesheets', capabilities: ['timesheet.read', 'timesheet.approve'] },
  { prefix: '/app/workforce/requests', label: 'Requests', capabilities: ['time_request.answer'] },
  { prefix: '/app/workforce/leave', label: 'Leave', capabilities: ['leave.read'] },
  { prefix: '/app/workforce/conduct', label: 'Conduct', capabilities: ['discipline.read'] },
  { prefix: '/app/workforce/today', label: 'Today board', capabilities: ['today.read'] },
  { prefix: '/app/workforce/schedule', label: 'Shifts', capabilities: ['rota.read'] },
  { prefix: '/app/workforce/casuals', label: 'Casual pay', capabilities: ['casual.read', 'casual.record'] },
  { prefix: '/app/workforce/attendance/switch', label: 'Attendance clock', capabilities: ['attendance.switch'] },
  { prefix: '/app/workforce/payslips', label: 'Payslips', capabilities: ['payslip.read_any'] },
  { prefix: '/app/workforce/my-', label: 'This page', capabilities: ['me.file'] },
];

const ROLE_WORDS: Record<string, string> = {
  MANAGER: 'Branch Managers',
  HR_MANAGER: 'HR',
  STORE_MANAGER: 'Store Managers',
  DIRECTOR: 'the Director',
  ACCOUNTANT: 'the Accountant',
  SYSTEM_ADMIN: 'the System Admin',
};
/** The only pages the System Admin really has a screen for: the table grants the admin more, but People and Pay are blocked for the role. */
const ADMIN_PAGES: readonly string[] = ['/app/workforce/rules', '/app/workforce/security', '/app/workforce/audit-log', '/app/workforce/attendance/switch'];
const ORDER = ['HR_MANAGER', 'DIRECTOR', 'ACCOUNTANT', 'MANAGER', 'STORE_MANAGER', 'SYSTEM_ADMIN'] as const;

export interface PageFor {
  page: string;
  /** The people who may open it, as words ("HR, the Director and the Accountant"); null when the page is not in the list. */
  forWords: string | null;
  roles: string[];
  reference: string;
  /** A page this person may use instead, with the sentence that says so (Paper 10.1: "Open My team"). null when there is none. */
  instead: { line: string; label: string; href: string } | null;
  /** What "Go to ..." says for this person's Home: "Overview" for the desktop roles and heads' department, "Home" for the rest. */
  homeLabel: 'Overview' | 'Home';
}

/** A short code the person can read out ("WF-R7K2"): nothing is stored under it; it only lets a support call find the same moment. */
export function referenceFor(path: string, userId: string, now: Date): string {
  const digest = createHash('sha256').update(`${path}|${userId}|${now.toISOString().slice(0, 16)}`).digest('hex').toUpperCase();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i += 1) code += alphabet[parseInt(digest.slice(i * 2, i * 2 + 2), 16) % alphabet.length];
  return `WF-${code}`;
}

const join = (words: string[]): string => (words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** The page a person may use instead of the one they were refused, from what the access table gives them. */
function insteadOf(path: string, subject: AccessSubject): PageFor['instead'] {
  if (path.startsWith('/app/workforce/payroll') && workforceCan(subject, 'me.payslip')) return { line: 'Your own pay is under My payslips.', label: 'My payslips', href: '/app/workforce/my-payslips' };
  if (path.startsWith('/app/workforce/employees') && scopeOf(subject, 'employee.read_basic') === 'dept') return { line: 'You can see your own department under My team.', label: 'My team', href: '/app/workforce/team' };
  return null;
}

export function pageFor(path: string, subject: AccessSubject, now: Date = new Date()): PageFor {
  const hit = PAGE_CAPABILITIES.find((p) => path === p.prefix || path.startsWith(`${p.prefix}/`) || (p.prefix.endsWith('-') && path.startsWith(p.prefix)));
  const reference = referenceFor(path, subject.id, now);
  const audience = homeAudienceOf(subject);
  const homeLabel = audience === 'STAFF' || audience === 'SYSTEM_ADMIN' ? 'Home' : 'Overview';
  const instead = insteadOf(path, subject);
  if (!hit) return { page: 'This page', forWords: null, roles: [], reference, instead, homeLabel };
  // `me.file` is every person's own page: say so instead of listing roles.
  if (hit.capabilities.includes('me.file')) return { page: hit.label, forWords: 'the person it belongs to', roles: [], reference, instead, homeLabel };
  const roles = ORDER.filter((role) => (role !== 'SYSTEM_ADMIN' || ADMIN_PAGES.includes(hit.prefix)) && hit.capabilities.some((c) => ROLE_GRANTS[role]?.[c] !== undefined));
  return { page: hit.label, forWords: roles.length ? join(roles.map((r) => ROLE_WORDS[r] ?? r)) : null, roles: [...roles], reference, instead, homeLabel };
}
