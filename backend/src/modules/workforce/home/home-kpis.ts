import type { HomeAudience, HomeFacts, HomeKpi } from './home-types';

/**
 * The five numbers of each Home (Paper frames 1.1 to 1.11; the suggested sets are in finding 30 of the final-pass findings).
 * Pure: facts in, cards out. Red-brown (`problem`) only for a real problem: overdue, late, security, blocks payroll.
 */

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const card = (key: string, label: string, value: string | number, detail: string, extra: Partial<Pick<HomeKpi, 'tone' | 'href'>> = {}): HomeKpi => ({
  key,
  label,
  value: String(value),
  detail,
  tone: extra.tone ?? 'normal',
  href: extra.href ?? null,
});

/** The head's own team page; the old `/my-team` address never existed. */
export const TEAM_HREF = '/app/workforce/team';

const attention = (n: number): 'attention' | 'normal' => (n > 0 ? 'attention' : 'normal');

const people = (f: HomeFacts, where: string): HomeKpi =>
  card('active', 'Active staff', f.active, f.joinedThisMonth > 0 ? `${f.joinedThisMonth} joined this month` : where, { href: '/app/workforce/employees' });

const probation = (f: HomeFacts): HomeKpi =>
  card('probation', 'Probation due', f.probationDueSoon + f.probationOverdue, probationLine(f), {
    tone: f.probationOverdue > 0 ? 'problem' : 'normal',
    href: '/app/workforce/employees?filter=on_probation',
  });

/** "1 overdue, 2 in 30 days" / "3 in 30 days" / "nothing due". */
function probationLine(f: HomeFacts): string {
  const parts = [f.probationOverdue > 0 ? `${f.probationOverdue} overdue` : '', f.probationDueSoon > 0 ? `${f.probationDueSoon} in 30 days` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing due';
}

const blocks = (f: HomeFacts): HomeKpi =>
  card('blocks-payroll', 'Blocks payroll', f.blocksPayroll, f.blocksPayroll === 0 ? 'every file is ready' : 'files missing bank or IDs', {
    tone: attention(f.blocksPayroll),
    href: '/app/workforce/employees?filter=blocks_payroll',
  });

const noHead = (f: HomeFacts): HomeKpi =>
  card('no-head', 'No head', f.departmentsWithoutHead, f.departmentsWithoutHead === 0 ? 'every department has one' : f.departmentsWithoutHead === 1 ? 'department without a head' : 'departments without a head', {
    tone: attention(f.departmentsWithoutHead),
    href: '/app/workforce/organisation',
  });

const payChanges = (f: HomeFacts, detail: string): HomeKpi =>
  card('pay-changes', 'Pay changes', f.payChangesWaiting, detail, { tone: attention(f.payChangesWaiting), href: '/app/workforce/employees?filter=pay_change' });

const onLeave = (f: HomeFacts, where: string): HomeKpi => card('on-leave', 'On leave today', f.onLeaveToday, where, { href: '/app/workforce/leave' });

const BUILDERS: Record<HomeAudience, (f: HomeFacts) => HomeKpi[]> = {
  HR: (f) => [people(f, 'on file today'), probation(f), blocks(f), noHead(f), payChanges(f, 'waiting for the Director')],
  DIRECTOR: (f) => [people(f, 'across the company'), probation(f), noHead(f), payChanges(f, f.payChangesWaiting === 0 ? 'nothing to decide' : 'for you to decide'), onLeave(f, 'across the company')],
  ACCOUNTANT: (f) => [
    blocks(f),
    card('pay-month', 'Payroll month', f.payrollState ?? 'Not started', 'where this month stands', { href: '/app/workforce/payroll' }),
    card('pay-changes-month', 'Pay changes this month', f.payChangesThisMonth, 'starting on or after the 1st', { href: '/app/workforce/employees?filter=pay_change_month' }),
    card('active', 'Active people', f.active, 'on the payroll', { href: '/app/workforce/employees' }),
    card('leave-today', 'On leave today', f.onLeaveToday, 'across the company', { href: '/app/workforce/leave' }),
  ],
  BRANCH_MANAGER: (f) => [
    people(f, 'at this branch'),
    onLeave(f, 'at this branch'),
    card('leave-waiting', 'Leave waiting', f.leaveWaiting, 'for you to decide', { tone: attention(f.leaveWaiting), href: '/app/workforce/leave' }),
    card('timesheets', 'Timesheets waiting', f.timesheetsWaiting, 'for you to approve', { tone: attention(f.timesheetsWaiting), href: '/app/workforce/timesheets' }),
    noHead(f),
  ],
  STORE_MANAGER: (f) => [
    people(f, 'at the Central Store'),
    onLeave(f, 'at the Central Store'),
    card('leave-waiting', 'Leave waiting', f.leaveWaiting, 'for you to decide', { tone: attention(f.leaveWaiting), href: '/app/workforce/leave' }),
    card('timesheets', 'Timesheets waiting', f.timesheetsWaiting, 'for you to approve', { tone: attention(f.timesheetsWaiting), href: '/app/workforce/timesheets' }),
    noHead(f),
  ],
  HEAD: (f) => [
    card('team', 'My team', f.active, 'people in my department', { href: TEAM_HREF }),
    card('on-leave', 'On leave today', f.onLeaveToday, 'in my department'),
    card('probation', 'In probation', f.inProbation, plural(f.probationReportsDue, 'report due', 'reports due'), { tone: f.probationOverdue > 0 ? 'problem' : 'normal', href: TEAM_HREF }),
    card('joined', 'Joined this month', f.joinedThisMonth, 'new on the team'),
    card('unread', 'New notices', f.unreadNotifications, 'waiting for you'),
  ],
  STAFF: (f) => [
    card('leave-left', 'Leave days left', f.ownLeaveDaysLeft ?? '–', 'this year', { href: '/app/workforce/my-leave' }),
    card('leave-asked', 'Leave asked', f.ownLeaveWaiting, 'waiting for an answer', { href: '/app/workforce/my-leave' }),
    card('unread', 'New notices', f.unreadNotifications, 'waiting for you'),
  ],
  SYSTEM_ADMIN: (f) => [
    card('alerts', 'Security alerts', f.openSecurityAlerts, f.openSecurityAlerts === 0 ? 'nothing open' : 'open, need a look', { tone: f.openSecurityAlerts > 0 ? 'problem' : 'normal', href: '/app/workforce/security' }),
    card('resets', 'Password resets', f.passwordResetsThisWeek, 'in the last 7 days'),
    card('phones', 'Phones to confirm', f.unconfirmedPhones, 'signed in, not yet confirmed'),
    card('users', 'Active users', f.activeUsers, 'can sign in'),
    card('sites', 'Branches', f.activeSites, 'in the company'),
  ],
};

export const kpisFor = (audience: HomeAudience, facts: HomeFacts): HomeKpi[] => BUILDERS[audience](facts);
