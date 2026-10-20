import { ForbiddenError, NotFoundError } from '../../../utils/errors';
import { logger } from '../../../utils/logger';
import { runAudited } from '../_shared/audit/audit-writer';
import { nairobiToday } from '../_shared/time/nairobi-time';
import { workforceCan, type AccessSubject } from '../_shared/workforce-access';
import { notify, nudgeUsers, roleLabel } from '../notifications';
import { employeesRepository } from '../people/employees/employees-repository';
import { resolveActor } from '../people/people-context';
import { contextFor, orderRows } from './needs-you-service';
import { needsYouQueries } from './needs-you-queries';
import { DAY_MS } from './needs-you-scope';
import type { NeedsYouContext, NeedsYouRow } from './needs-you-types';
import { registeredSources, sourceForRow } from './sources/registry';

export interface OverdueRow {
  id: string;
  kind: string;
  text: string;
  waitingOn: { role: string; siteName: string | null };
  since: string;
  waitingDays: number;
  canRemind: boolean;
  remindedToday: boolean;
}

const assertDirector = (subject: AccessSubject): void => {
  if (!workforceCan(subject, 'needs_you.remind')) throw new NotFoundError('Not found');
};

async function overdueRows(ctx: NeedsYouContext): Promise<NeedsYouRow[]> {
  const parts = await Promise.all(
    registeredSources().map(async (s) => {
      try {
        return (await s.overdue?.(ctx)) ?? [];
      } catch (error) {
        logger.error({ err: error, source: s.id }, 'needs-you overdue failed');
        return [];
      }
    }),
  );
  return orderRows(parts.flat());
}

/** Everything that has waited more than 3 days, anywhere. The Director reminds; they decide nothing here. */
export async function listOverdue(subject: AccessSubject, now: Date = new Date()): Promise<{ rows: OverdueRow[]; total: number }> {
  assertDirector(subject);
  const ctx = await contextFor(subject, now);
  const rows = await overdueRows(ctx);
  const done = await needsYouQueries.reminderOn(rows.map((r) => r.id), nairobiToday(now));
  return {
    total: rows.length,
    rows: rows.map((r) => ({ id: r.id, kind: r.kind, text: r.text, waitingOn: { role: roleLabel(r.waitingOnRole), siteName: r.siteName }, since: r.since, waitingDays: Math.floor((now.getTime() - new Date(r.since).getTime()) / DAY_MS), canRemind: r.canRemind, remindedToday: done.has(r.id) })),
  };
}

async function recipientsOf(row: NeedsYouRow, ctx: NeedsYouContext): Promise<string[]> {
  const custom = await sourceForRow(row.id)?.remindees?.(row, ctx);
  if (custom && custom.length > 0) return custom;
  if (row.waitingOnRole === 'HR_MANAGER') return employeesRepository.userIdsByRole(ctx.companyId, 'HR_MANAGER');
  if (row.waitingOnRole === 'STORE_MANAGER' && row.siteId) return needsYouQueries.usersAt(row.siteId, ['STORE_MANAGER']);
  return row.siteId ? needsYouQueries.usersAt(row.siteId, ['MANAGER', 'STORE_MANAGER']) : [];
}

/**
 * "Send a reminder": once per item per Nairobi day (403 REMINDER_ALREADY_SENT). It tells the person the item waits on and writes
 * `needs_you.reminder_sent`. Only an item that is really overdue can be reminded (404 otherwise).
 */
export async function remind(subject: AccessSubject, itemId: string, idempotencyKey: string, now: Date = new Date()): Promise<{ reminded: true }> {
  assertDirector(subject);
  const ctx = await contextFor(subject, now);
  const row = (await overdueRows(ctx)).find((r) => r.id === itemId);
  if (!row || !row.canRemind) throw new NotFoundError('That item is not overdue.', 'ITEM_NOT_OVERDUE');
  const actor = await resolveActor(subject);
  const day = nairobiToday(now);
  const recipients = await recipientsOf(row, ctx);
  await runAudited<void>(async (tx) => {
    const first = await needsYouQueries.insertReminder(tx, { itemId, day, sentById: subject.id, sentToUserId: recipients[0] ?? null });
    if (!first) throw new ForbiddenError('A reminder was already sent today.', 'REMINDER_ALREADY_SENT');
    return {
      result: undefined,
      entries: [{ companyId: ctx.companyId, siteId: row.siteId, actor: actor.auditActor, action: 'needs_you.reminder_sent', category: 'LOG_ACCESS', subjectType: 'NeedsYouItem', subjectId: itemId, after: { kind: row.kind, day, key: idempotencyKey } }],
    };
  });
  const days = Math.floor((now.getTime() - new Date(row.since).getTime()) / DAY_MS);
  await Promise.all(recipients.map((id) => notify(id, 'needs_you.overdue_reminder', { text: row.text, days, href: row.opens }, { dedupeKey: `remind:${itemId}:${day}` })));
  nudgeUsers(recipients, 'workforce:needs-you');
  return { reminded: true };
}
