import { addDays, monthKey, nairobiToday, toDateColumn } from '../_shared/time/nairobi-time';
import { scopeOf, workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { summariseForHome } from '../needs-you/needs-you-groups';
import { allRowsFor } from '../needs-you/needs-you-page';
import { countNeedsYou } from '../needs-you/needs-you-service';
import { notificationRepository } from '../notifications/notification-repository';
import { employeesService } from '../people/employees/employees-service';
import { readScopeOf } from '../people/people-access';
import { resolveActor } from '../people/people-context';
import { PAY_CHANGE_MONTH_DAYS } from '../people/people.constants';
import { homeAudienceOf } from './home-audience';
import { kpisFor } from './home-kpis';
import { homeRepository } from './home-repository';
import { emptyFacts, type HomeAudience, type HomeFacts, type HomeNeedsYou, type HomeView } from './home-types';

/** How many Needs you rows the Home table shows before "See all". */
export const HOME_ROWS = 5;
const SOON_DAYS = 30;

/** The words for the payroll month's state, as the Payroll page says them. */
const PAYROLL_WORDS: Record<string, string> = {
  WAITING: 'Waiting',
  IN_REVIEW: 'In review',
  TO_APPROVE: 'To approve',
  TO_PUBLISH: 'To publish',
  PUBLISHED: 'To pay',
  PAID: 'Paid',
};

const SEES_PEOPLE: readonly HomeAudience[] = ['HR', 'DIRECTOR', 'ACCOUNTANT', 'BRANCH_MANAGER', 'STORE_MANAGER', 'HEAD'];

/** Every number the audience's cards use, counted for the viewer's reach. Numbers the audience does not show are not fetched. */
export async function collectFacts(subject: AccessSubject, audience: HomeAudience, now: Date): Promise<HomeFacts> {
  const facts = emptyFacts();
  const today = nairobiToday(now);
  const todayCol = toDateColumn(today);
  const monthStart = toDateColumn(`${today.slice(0, 7)}-01` as typeof today);
  const ctx = await resolveActor(subject);
  const unitSite = scopeOf(subject, 'employee.read_basic') === 'unit' ? subject.siteId : null;

  const jobs: Array<Promise<void>> = [];
  const run = (job: Promise<void>): void => {
    jobs.push(job);
  };

  if (SEES_PEOPLE.includes(audience) && workforceCan(subject, 'employee.read_basic')) {
    run(
      homeRepository.peopleCounts(ctx.companyId, readScopeOf(subject), todayCol, monthStart, toDateColumn(addDays(today, SOON_DAYS))).then((c) => {
        Object.assign(facts, c);
      }),
    );
  }
  if (audience === 'HR' || audience === 'DIRECTOR' || audience === 'ACCOUNTANT') {
    run(employeesService.summary(subject, undefined).then((s) => void (facts.blocksPayroll = s.blocksPayroll)));
  }
  if (['HR', 'DIRECTOR', 'BRANCH_MANAGER', 'STORE_MANAGER'].includes(audience)) {
    run(homeRepository.departmentsWithoutHead(ctx.companyId, unitSite).then((n) => void (facts.departmentsWithoutHead = n)));
  }
  if (audience === 'HR' || audience === 'DIRECTOR') run(homeRepository.payChangesWaiting(ctx.companyId).then((n) => void (facts.payChangesWaiting = n)));
  if (audience === 'ACCOUNTANT') {
    const next = toDateColumn(addDays(monthStart.toISOString().slice(0, 10) as typeof today, PAY_CHANGE_MONTH_DAYS));
    run(homeRepository.payChangesStartingBetween(ctx.companyId, monthStart, next).then((n) => void (facts.payChangesThisMonth = n)));
    run(homeRepository.payrollState(ctx.companyId, monthKey(today)).then((s) => void (facts.payrollState = s ? (PAYROLL_WORDS[s] ?? s) : null)));
    run(homeRepository.peopleCounts(ctx.companyId, { kind: 'all' }, todayCol, monthStart, todayCol).then((c) => void (facts.onLeaveToday = c.onLeaveToday)));
  }
  if (workforceCan(subject, 'needs_you.read')) {
    run(
      countNeedsYou(subject, now).then(({ badges }) => {
        facts.leaveWaiting = badges['workforce-leave'];
        facts.timesheetsWaiting = badges['workforce-timesheets'];
        facts.conductWaiting = badges['workforce-conduct'];
      }),
    );
  }
  if (audience === 'SYSTEM_ADMIN') {
    run(homeRepository.openSecurityAlerts(ctx.companyId).then((n) => void (facts.openSecurityAlerts = n)));
    run(homeRepository.passwordResetsSince(ctx.companyId, new Date(now.getTime() - 7 * 86_400_000)).then((n) => void (facts.passwordResetsThisWeek = n)));
    run(homeRepository.unconfirmedPhones(ctx.companyId).then((n) => void (facts.unconfirmedPhones = n)));
    run(homeRepository.activeUsers(ctx.companyId).then((n) => void (facts.activeUsers = n)));
    run(homeRepository.activeSites(ctx.companyId).then((n) => void (facts.activeSites = n)));
  }
  if (workforceCan(subject, 'me.file')) {
    run(
      homeRepository.employeeIdOfUser(subject.id).then(async (employeeId) => {
        if (!employeeId) return;
        facts.ownLeaveDaysLeft = await homeRepository.ownLeaveDaysLeft(employeeId, Number(today.slice(0, 4)));
        facts.ownLeaveWaiting = await homeRepository.ownLeaveWaiting(employeeId);
      }),
    );
  }
  run(notificationRepository.unreadCount(subject.id).then((n) => void (facts.unreadNotifications = n)));
  await Promise.all(jobs);
  return facts;
}

async function needsYouOf(subject: AccessSubject, now: Date): Promise<HomeNeedsYou | null> {
  if (!workforceCan(subject, 'needs_you.read')) return null;
  const { rows } = await allRowsFor(subject, now);
  const { summary, kinds } = summariseForHome(rows, now, HOME_ROWS);
  return { total: rows.length, overdue: rows.filter((r) => r.overdue).length, kinds, rows: summary };
}

export async function homeView(subject: AccessSubject, now: Date = new Date()): Promise<HomeView> {
  const audience = homeAudienceOf(subject);
  const [facts, needsYou, latest] = await Promise.all([
    collectFacts(subject, audience, now),
    needsYouOf(subject, now),
    notificationRepository.list(subject.id, { unreadOnly: false }, 1, 5),
  ]);
  return {
    audience,
    kpis: kpisFor(audience, facts),
    needsYou,
    latest: latest.items.map((n) => ({ id: n.id, title: n.title, body: n.body, tone: n.tone, href: n.href, createdAt: n.createdAt, read: n.read })),
    unread: facts.unreadNotifications,
  };
}
