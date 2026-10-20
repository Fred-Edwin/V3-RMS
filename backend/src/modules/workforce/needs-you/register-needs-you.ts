import { UserRole } from '@prisma/client';
import { logger } from '../../../utils/logger';
import { workforceEvents, type WorkforceEventName } from '../_shared/events';
import { scopeOf } from '../_shared/workforce-access';
import { nudgeUsers } from '../notifications';
import { needsYouQueries } from './needs-you-queries';
import { monthSource } from './sources/month-source';
import { paySource } from './sources/pay-source';
import { registerNeedsYouSource } from './sources/registry';
import { securitySource } from './sources/security-source';
import { timeSource } from './sources/time-source';

/**
 * Events after which someone's card may have changed. Leave must emit `leave.requested|decided|moved_up` and Conduct
 * `conduct.appeal_sent|decided` (declared in events.ts when their segments land); add the names here then.
 */
const NUDGING_EVENTS: WorkforceEventName[] = [
  'time_request.created',
  'time_request.decided',
  'time_request.escalated',
  'time_request.withdrawn',
  'overtime.requested',
  'overtime.decided',
  'attendance.auto_closed',
  'timesheets.month_approved',
  'timesheet.day_decided',
  'payroll.month_calculated',
  'payroll.month_sent',
  'payroll.month_sent_back',
  'payroll.month_approved',
  'payroll.month_published',
  'payroll.month_paid',
  'rules.version_created',
  'rules.version_confirmed',
  'employee.hired',
  'department.head_changed',
  'leave.requested',
  'leave.decided',
  'leave.moved_up',
  'conduct.appeal_sent',
  'conduct.appeal_decided',
];

/** Start-up: the built sources join the registry and every listed event nudges the people who hold `needs_you.read` at that site. */
export function registerNeedsYou(): void {
  for (const source of [timeSource, monthSource, paySource, securitySource]) registerNeedsYouSource(source);
  for (const name of NUDGING_EVENTS) {
    workforceEvents.on(name, (event) => {
      const siteId = 'siteId' in event.payload && typeof event.payload.siteId === 'string' ? event.payload.siteId : null;
      void readersNear(siteId)
        .then((ids) => nudgeUsers(ids, 'workforce:needs-you'))
        .catch((error: unknown) => logger.error({ err: error, event: name }, 'needs-you nudge failed'));
    });
  }
}

/** Everyone who holds `needs_you.read` and could see a row at this site: company-wide holders, and `unit` holders of that site. */
async function readersNear(siteId: string | null): Promise<string[]> {
  const holders = (Object.values(UserRole) as UserRole[]).flatMap((role) => {
    const scope = scopeOf({ id: 'role-probe', role, siteId: null }, 'needs_you.read');
    return scope === null ? [] : [{ role, wide: scope === 'all' }];
  });
  const [wide, near] = await Promise.all([needsYouQueries.usersByRoles(holders.filter((h) => h.wide).map((h) => h.role), null), siteId ? needsYouQueries.usersByRoles(holders.filter((h) => !h.wide).map((h) => h.role), siteId) : []]);
  return [...new Set([...wide, ...near])];
}
