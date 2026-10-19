import type { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { told } from '../../people/people-context';
import type { AccessSubject } from '../../_shared/workforce-access';
import { approveMonth as approveTimesheetMonth } from '../../timesheets/approval/approve-service';
import type { LateApproveBody } from '../approval/approval-validators';
import { REMINDER_COOLDOWN_HOURS } from '../engine/payroll-constants';
import { monthWindow } from '../months/month-calendar';
import { monthsRepository } from '../months/months-repository';
import { eventOf, payrollEntry } from '../payroll-audit';
import { assertState, payrollActor, requireMonth } from '../payroll-context';
import { loadSiteRows } from './site-rows';
import { sitesRepository } from './sites-repository';

export interface ReminderResult {
  monthKey: string;
  siteId: string;
  remindedAt: string;
  repeat: boolean;
}

async function waitingSite(companyId: string, monthKey: string, siteId: string, now: Date) {
  const rows = await loadSiteRows(companyId, monthWindow(monthKey), nairobiToday(now), now);
  const site = rows.find((row) => row.siteId === siteId);
  if (!site) throw new NotFoundError('That site is not in this company', 'NO_SITE');
  if (site.timesheetState === 'NOT_ON_NEW_SYSTEM') throw new ConflictError(`${site.name} is still paid by the old payslips.`, 'SITE_NOT_ON_NEW_PAYROLL');
  if (site.timesheetState === 'APPROVED') throw new ConflictError(`${site.name} has already approved this month.`, 'SITE_ALREADY_APPROVED');
  return site;
}

/** Reminds a site's manager that payroll waits for their timesheets (S1). At most one reminder per site in 24 hours (429 REMINDED_RECENTLY). */
export async function remindSite(subject: AccessSubject, monthKey: string, siteId: string, body: { idempotencyKey: string }, now: Date = new Date()): Promise<ReminderResult> {
  const ctx = await payrollActor(subject, 'payroll.remind');
  const prior = await monthsRepository.findKey(ctx.companyId, body.idempotencyKey);
  if (prior) {
    if (prior.action !== 'remind' || prior.monthKey !== monthKey) throw new ConflictError('That request key was already used for something else.', 'IDEMPOTENCY_KEY_REUSED');
    return { ...(prior.response as unknown as ReminderResult), repeat: true };
  }
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['WAITING'], 'MONTH_NOT_WAITING', 'Only a month that is waiting for a site can send a reminder');
  const site = await waitingSite(ctx.companyId, monthKey, siteId, now);
  const result = await runAudited<ReminderResult>(async (tx) => {
    // Lock the month so two clicks serialise: the second sees the first one's reminder and is refused.
    await monthsRepository.lock(tx, month.id);
    const last = await sitesRepository.lastReminder(tx, ctx.companyId, monthKey, siteId);
    if (last && now.getTime() - last.remindedAt.getTime() < REMINDER_COOLDOWN_HOURS * 3_600_000) throw new AppError(429, 'REMINDED_RECENTLY', 'That site was reminded in the last 24 hours.');
    await sitesRepository.addReminder(tx, { companyId: ctx.companyId, monthKey, siteId, remindedById: subject.id, remindedAt: now });
    const res: ReminderResult = { monthKey, siteId, remindedAt: now.toISOString(), repeat: false };
    await monthsRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'remind', monthKey, response: res as unknown as Prisma.InputJsonValue });
    return { result: res, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.reminder_sent', category: 'PAY_RUN_PREPARE', monthId: month.id, after: { month: monthKey, siteId, siteName: site.name } })], events: [eventOf('payroll.site_reminded', { monthKey, siteId, remindedById: subject.id }, now)] };
  });
  await told(await sitesRepository.siteManagers(siteId), 'payroll.timesheets_waiting', { month: monthKey, site: site.name });
  return result;
}

/**
 * The Director approves a site's timesheet month for it once more than 5 days have passed since the month ended (P4). It is the
 * 1A approval, with the Director's own PIN; HR can never do this. The site's manager is told.
 */
export async function approveSiteLate(subject: AccessSubject, monthKey: string, siteId: string, body: LateApproveBody, now: Date = new Date()): Promise<{ monthKey: string; siteId: string; timesheetNumber: string }> {
  const ctx = await payrollActor(subject, 'payroll.approve_site_late');
  const month = await requireMonth(ctx.companyId, monthKey);
  assertState(month, ['WAITING'], 'MONTH_NOT_WAITING', 'Only a month that is waiting for a site can be approved for it');
  const site = await waitingSite(ctx.companyId, monthKey, siteId, now);
  if (!site.canApproveLate) throw new ConflictError(`${site.name}'s manager still has time. The Director can approve for the site once more than 5 days have passed since the month ended.`, 'TOO_EARLY_TO_APPROVE_FOR_SITE', { waitingDays: site.waitingDays });
  const done = await approveTimesheetMonth(subject, monthKey, { pin: body.pin, idempotencyKey: body.idempotencyKey, expectedTotals: body.expectedTotals, site: siteId }, now, { lateForSiteId: siteId });
  await runAudited<void>(async () => ({ result: undefined, entries: [payrollEntry({ companyId: ctx.companyId, actor: ctx.auditActor, action: 'payroll.site_approved_late', category: 'PAY_RUN_DECIDE', monthId: month.id, after: { month: monthKey, siteId, siteName: site.name, document: done.documentNumber, waitingDays: site.waitingDays, method: 'PIN' } })] }));
  await told(await sitesRepository.siteManagers(siteId), 'payroll.timesheets_approved_for_you', { month: monthKey, site: site.name });
  return { monthKey, siteId, timesheetNumber: done.documentNumber };
}
