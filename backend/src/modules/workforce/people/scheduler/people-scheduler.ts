import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { draftsRepository } from '../hire/drafts-repository';
import { lifecycleSweeps } from '../lifecycle/lifecycle-sweeps';
import { payRepository } from '../pay/pay-repository';
import { reconcileHeadClaims } from '../organisation/heads/reconcile-head-claims';
import { DRAFT_KEEP_DAYS } from '../people.constants';
import { schedulerRepository } from './scheduler-repository';

/**
 * The daily People tasks, run at 00:05 Nairobi. Each is idempotent: it claims its rows with a guarded update, so a second
 * run on the same day changes nothing. `reconcileHeadClaims` (slice 1b) repairs head claims that drifted or expired.
 */
export const PEOPLE_SCHEDULER_TASKS = ['activateStarted', 'finalizeExits', 'applyMoves', 'applyPayChanges', 'reconcileHeadClaims', 'expireDrafts'] as const;
export type PeopleTask = (typeof PEOPLE_SCHEDULER_TASKS)[number];

export interface TaskReport {
  task: PeopleTask;
  changed: number;
}

const SYSTEM = { id: null, role: 'SYSTEM', name: 'System' } as const;

/** ONBOARDING becomes ACTIVE on the start date. One entry per company per run, never one per person. */
export async function activateStarted(today: NairobiDate): Promise<number> {
  const due = await schedulerRepository.dueActivations(toDateColumn(today));
  const byCompany = new Map<string, { id: string; siteId: string }[]>();
  for (const row of due) byCompany.set(row.companyId, [...(byCompany.get(row.companyId) ?? []), { id: row.id, siteId: row.siteId }]);

  let changed = 0;
  for (const [companyId, rows] of byCompany) {
    changed += await runAudited(async (tx) => {
      const result = await schedulerRepository.activate(tx, companyId, rows.map((r) => r.id));
      return {
        result: result.count,
        entries:
          result.count === 0
            ? []
            : [
                {
                  companyId,
                  siteId: null,
                  actor: SYSTEM,
                  channel: 'SYSTEM' as const,
                  action: 'people.activated',
                  category: 'PEOPLE' as const,
                  subjectType: 'Company',
                  subjectId: companyId,
                  after: { count: result.count, startedOn: today },
                },
              ],
      };
    });
  }
  return changed;
}

/** Approved pay changes whose start day has come become the profile's amount (oldest first, so the latest wins). */
export async function applyPayChanges(today: NairobiDate, now: Date): Promise<number> {
  let changed = 0;
  for (const change of await payRepository.dueChanges(toDateColumn(today))) {
    const applied = await runAudited(async (tx) => {
      const claimed = await payRepository.markApplied(tx, change.id, now);
      if (claimed.count === 0) return { result: false, entries: [] };
      await payRepository.setAmount(tx, change.employeeId, change.amount.toFixed(2), null);
      return {
        result: true,
        entries: [
          {
            companyId: change.employee.companyId,
            siteId: change.employee.siteId,
            actor: SYSTEM,
            channel: 'SYSTEM' as const,
            action: 'people.pay_change_applied',
            category: 'PAY_SETUP' as const,
            subjectType: 'PayChange',
            subjectId: change.id,
            subjectUserId: change.employee.userId,
            after: { effectiveFrom: fromDateColumn(change.effectiveFrom) },
          },
        ],
      };
    });
    if (applied) changed += 1;
  }
  return changed;
}

export async function expireDrafts(now: Date): Promise<number> {
  return draftsRepository.removeOlderThan(new Date(now.getTime() - DRAFT_KEEP_DAYS * 24 * 60 * 60 * 1000));
}

/** Runs every task in order for the given Nairobi day; the report says how many rows each changed. */
export async function runPeopleScheduler(today: NairobiDate = nairobiToday(new Date()), now: Date = new Date()): Promise<TaskReport[]> {
  const steps: [PeopleTask, () => Promise<number>][] = [
    ['activateStarted', () => activateStarted(today)],
    ['finalizeExits', () => lifecycleSweeps.finalizeDueExits(today, now)],
    ['applyMoves', async () => (await lifecycleSweeps.startDueMoves(today, now)) + (await lifecycleSweeps.endDueLoans(today, now))],
    ['applyPayChanges', () => applyPayChanges(today, now)],
    ['reconcileHeadClaims', () => reconcileHeadClaims(today)],
    ['expireDrafts', () => expireDrafts(now)],
  ];
  const reports: TaskReport[] = [];
  for (const [task, run] of steps) {
    try {
      reports.push({ task, changed: await run() });
    } catch (error) {
      // One failing task must not stop the others; the next night retries it.
      logger.error({ err: error, task }, 'people scheduler task failed');
      reports.push({ task, changed: 0 });
    }
  }
  return reports;
}
