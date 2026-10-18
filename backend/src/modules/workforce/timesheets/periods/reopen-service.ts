import { AppError, ConflictError } from '../../../../utils/errors';
import { comparePin } from '../../../../utils/password';
import { runAudited } from '../../_shared/audit/audit-writer';
import { addDays, instantAt, nairobiToday, parseClockTime } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { refreshPeriod, weekRulesFor } from '../assemble/assemble-service';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import { viewerFor } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import { pinRepository } from './pin-repository';
import { periodsRepository } from './periods-repository';
import { periodForViewer } from './periods-service';
import type { ReopenBody, SignBody } from './periods-validators';

/**
 * HR reopens a closed period, with a reason (the only way a closed period changes). It gets a fresh cut-off the next day at
 * the rule's time, so it closes by itself again; the signature is cleared because the report is no longer what was signed.
 */
export async function reopenPeriod(subject: AccessSubject, id: string, body: ReopenBody, now: Date = new Date()): Promise<PeriodRow> {
  const { period } = await periodForViewer(subject, id);
  viewerFor(subject, 'timesheet.reopen', period.siteId);
  if (period.state !== 'CLOSED') throw new ConflictError('Only a closed period can be reopened.', 'NOT_CLOSED');
  const ctx = await resolveActor(subject);
  const week = await weekRulesFor(period.siteId, period.end);
  const cutoffAt = instantAt(addDays(nairobiToday(now), 1), parseClockTime(week.timesheetCutoff.time));

  await runAudited(async (tx) => {
    const changed = await periodsRepository.transition(
      period.id,
      'CLOSED',
      { state: 'OPEN', reopenedAt: now, reopenedById: subject.id, reopenReason: body.reason, cutoffAt, signedById: null, signedAt: null },
      tx,
    );
    if (!changed) throw new ConflictError('Only a closed period can be reopened.', 'NOT_CLOSED');
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: period.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.period_reopened',
      subjectId: period.id,
      subjectType: 'TimesheetPeriod',
      before: { state: 'CLOSED', closedAt: period.closedAt?.toISOString() ?? null, signed: period.signedById !== null },
      after: { state: 'OPEN', cutoffAt: cutoffAt.toISOString() },
      reason: body.reason,
    });
    return { result: undefined, entries: [entry], events: [eventOf('timesheet.period_reopened', { siteId: period.siteId, periodId: period.id, reopenedById: subject.id }, now)] };
  });
  const reopened = (await periodsRepository.find(period.siteId, period.id)) ?? period;
  await refreshPeriod(reopened, now, true);
  return reopened;
}

/**
 * The manager signs the closed report with their own PIN ("Signed with PIN", Chapter 8 step 5). The PIN is checked here
 * and never stored; the audit entry records the method and the time, as the Rules service expects of a signature.
 */
export async function signReport(subject: AccessSubject, id: string, body: SignBody, now: Date = new Date()): Promise<PeriodRow> {
  const { period } = await periodForViewer(subject, id);
  viewerFor(subject, 'timesheet.close', period.siteId);
  if (period.state !== 'CLOSED') throw new ConflictError('Only a closed period can be signed.', 'NOT_CLOSED');
  if (period.signedById) throw new ConflictError('This report is signed already.', 'ALREADY_SIGNED');
  const hash = await pinRepository.hashOf(subject.id);
  if (hash === null || !(await comparePin(body.pin, hash))) throw new AppError(401, 'INVALID_PIN', 'That code is not right.');
  const ctx = await resolveActor(subject);
  await runAudited(async (tx) => {
    await periodsRepository.setSigned(period.id, subject.id, now, tx);
    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: period.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.period_signed',
      subjectId: period.id,
      subjectType: 'TimesheetPeriod',
      after: { method: 'PIN', signedAt: now.toISOString(), report: period.reportNumber },
    });
    return { result: undefined, entries: [entry] };
  });
  return (await periodsRepository.find(period.siteId, period.id)) ?? period;
}
