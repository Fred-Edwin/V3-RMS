import type { Prisma } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { daysRepository } from '../../attendance/days/days-repository';
import { resolveActor, told } from '../../people/people-context';
import { refreshPeriod, weekRulesFor } from '../assemble/assemble-service';
import { rebuildWeeks } from '../days/weeks';
import { timesheetDaysRepository } from '../days/timesheet-days-repository';
import { firstApprovalDay, isMonthKey, monthBounds, monthKeyOf } from '../months/rules/month-state';
import { loadMonthData, needsYouOf } from '../months/month-data';
import { documentCode } from '../months/months-service';
import { blockingTotal, settledWithMonth } from '../months/rules/needs-you';
import { monthTotals, personMonthRows, type MonthTotals } from '../months/people-rows';
import { rulesUsedFor } from '../months/rules-used';
import { periodsRepository } from '../periods/periods-repository';
import { requestsRepository } from '../requests/requests-repository';
import { eventOf, timesheetEntry } from '../timesheets-audit';
import { writerFor } from '../timesheets-scope';
import type { PeriodRow } from '../timesheets.types';
import type { ApproveBody } from './approval-validators';
import type { Decider } from './decided-by';
import { assertOwnPin } from './pin-check';
import { buildSnapshot, hashSnapshot } from './snapshot';

export interface ApprovalResult {
  monthKey: string;
  state: 'APPROVED';
  approvedAt: string;
  documentNumber: string;
  /** The first characters of the document hash, as the QR carries it. */
  documentHashPrefix: string;
  /** True when this answers a repeat of the same request (same idempotency key). */
  repeat: boolean;
}

const resultOf = (period: PeriodRow, repeat: boolean): ApprovalResult => ({
  monthKey: monthKeyOf(period),
  state: 'APPROVED',
  approvedAt: period.approvedAt!.toISOString(),
  documentNumber: documentCode(period.documentNumber)!,
  documentHashPrefix: (period.documentHash ?? '').slice(0, 10),
  repeat,
});

const totalsOfData = (data: Awaited<ReturnType<typeof loadMonthData>>): { totals: MonthTotals; rows: ReturnType<typeof personMonthRows> } => {
  const rows = personMonthRows(data.days, data.items, data.requests);
  return { totals: monthTotals(rows, data.items), rows };
};

const sameTotals = (totals: MonthTotals, expected: ApproveBody['expectedTotals']): boolean =>
  totals.workedMinutes === expected.workedMinutes && totals.overtimeApprovedMinutes === expected.overtimeAuthorisedMinutes && totals.people === expected.headcount;

/**
 * Approve the month (Segment 1A, S7). The site's own manager, once the month has ended, with their PIN, when nothing is left
 * to decide. One transaction locks the month, checks the figures the dialog showed against the fresh ones, settles the days
 * that only carry facts, freezes a snapshot (the PDF and the Excel are built from it), issues the TSH number and writes the
 * audit entry. Payroll (Segment 2) reads the `timesheets.month_approved` event and `getApprovedHours`.
 * Checks in order: capability and site (403 / 404), already approved (same key: success, other key: 409), month ended,
 * nothing left to decide, PIN, something to approve, figures unchanged.
 */
export async function approveMonth(subject: AccessSubject, monthKey: string, body: ApproveBody, now: Date = new Date()): Promise<ApprovalResult> {
  if (!isMonthKey(monthKey)) throw new NotFoundError('No timesheet for that month', 'NO_TIMESHEET');
  const siteId = body.site ?? subject.siteId ?? undefined;
  const viewer = writerFor(subject, 'timesheet.close', siteId ?? '');
  const bounds = monthBounds(monthKey);
  const found = await periodsRepository.byMonth(viewer.siteId, bounds.first, bounds.last);
  if (!found) throw new NotFoundError('No timesheet for that month', 'NO_TIMESHEET');

  if (found.state === 'APPROVED') {
    if (found.approveKey === body.idempotencyKey) return resultOf(found, true);
    throw new ConflictError('Someone approved this month a moment ago.', 'ALREADY_APPROVED');
  }
  if (nairobiToday(now) <= found.end) throw new ConflictError(`This month has not ended yet. You can approve it from ${firstApprovalDay(found)}.`, 'MONTH_NOT_ENDED', { lastDay: found.end, approvableFrom: firstApprovalDay(found) });

  await refreshPeriod(found, now, true);
  const period = (await periodsRepository.find(found.siteId, found.id)) ?? found;
  const before = await loadMonthData(period);
  const counts = needsYouOf(before);
  if (blockingTotal(counts) > 0) throw new ConflictError('Some things still need a decision.', 'NEEDS_YOU_REMAINS', counts);

  await assertOwnPin(subject.id, body.pin);
  if (totalsOfData(before).totals.people === 0) throw new ConflictError('Nobody worked this month, so there is nothing to approve.', 'NOTHING_TO_APPROVE');
  if (!sameTotals(totalsOfData(before).totals, body.expectedTotals)) throw new ConflictError('Something changed while you were looking. Check the numbers and try again.', 'CHANGED_UNDERNEATH', totalsOfData(before).totals);

  const [ctx, site, rules, week, self] = await Promise.all([
    resolveActor(subject),
    periodsRepository.siteName(period.siteId),
    rulesUsedFor(period.siteId, period.end),
    weekRulesFor(period.siteId, period.end),
    daysRepository.personByUserId(subject.id),
  ]);
  const key = monthKeyOf(period);
  const deciderIds = [...before.items.map((i) => i.decidedById), ...before.days.map(({ day }) => day.decidedById), subject.id].filter((id): id is string => id !== null);
  const names = await periodsRepository.people([...new Set(deciderIds)]);
  const nameOf = (userId: string | null): Decider | null => (userId ? (names.get(userId) ?? null) : null);

  const done = await runAudited<ApprovalResult>(async (tx) => {
    const state = await periodsRepository.lockState(tx, period.id);
    if (state !== 'OPEN') throw new ConflictError('Someone approved this month a moment ago.', 'ALREADY_APPROVED');
    const first = await loadMonthData(period, tx);
    const fresh = needsYouOf(first);
    if (blockingTotal(fresh) > 0) throw new ConflictError('Some things still need a decision.', 'NEEDS_YOU_REMAINS', fresh);
    if (!sameTotals(totalsOfData(first).totals, body.expectedTotals)) throw new ConflictError('Something changed while you were looking. Check the numbers and try again.', 'CHANGED_UNDERNEATH', totalsOfData(first).totals);

    const settle = first.days.filter(({ day }) => settledWithMonth(day));
    if (settle.length > 0) {
      await timesheetDaysRepository.approveWithMonth(tx, settle.map(({ day }) => day.id), subject.id, now);
      for (const employeeId of new Set(settle.map(({ day }) => day.employeeId))) await rebuildWeeks(tx, period.id, period.siteId, employeeId, week.weekStartsOn);
    }
    const data = settle.length > 0 ? await loadMonthData(period, tx) : first;
    const { totals, rows } = totalsOfData(data);
    const ownHours = self !== null && rows.some((row) => row.employeeId === self.id);
    const snapshot = buildSnapshot({
      monthKey: key,
      site: { id: period.siteId, name: site },
      start: period.start,
      end: period.end,
      approvedAt: now,
      approvedBy: nameOf(subject.id),
      ownHoursIncluded: ownHours,
      totals,
      rules,
      rows,
      days: data.days.map(({ day }) => day),
      items: data.items,
      nameOf,
    });
    const documentHash = hashSnapshot(snapshot);
    const documentNumber = await periodsRepository.nextDocumentNumber(tx);
    const claimed = await periodsRepository.approve(tx, period.id, { approvedAt: now, approvedById: subject.id, approverOwnHours: ownHours, approveKey: body.idempotencyKey, documentNumber, documentHash, snapshot: snapshot as unknown as Prisma.InputJsonValue });
    if (!claimed) throw new ConflictError('Someone approved this month a moment ago.', 'ALREADY_APPROVED');

    const entry = timesheetEntry({
      companyId: ctx.companyId,
      siteId: period.siteId,
      actor: ctx.auditActor,
      action: 'timesheet.month_approved',
      subjectId: period.id,
      subjectType: 'TimesheetPeriod',
      before: { state: 'OPEN', month: key },
      after: { state: 'APPROVED', month: key, headcount: totals.people, workedMinutes: totals.workedMinutes, overtimeAuthorisedMinutes: totals.overtimeApprovedMinutes, document: documentCode(documentNumber), method: 'PIN', ownHoursIncluded: ownHours, daysSettledWithMonth: settle.length },
    });
    const event = eventOf('timesheets.month_approved', { siteId: period.siteId, periodId: period.id, monthKey: key, approvedById: subject.id, documentNumber, headcount: totals.people, workedMinutes: totals.workedMinutes, overtimeAuthorisedMinutes: totals.overtimeApprovedMinutes }, now);
    return { result: { monthKey: key, state: 'APPROVED' as const, approvedAt: now.toISOString(), documentNumber: documentCode(documentNumber)!, documentHashPrefix: documentHash.slice(0, 10), repeat: false }, entries: [entry], events: [event] };
  });

  const audience = await requestsRepository.approverCandidates(null, ['HR_MANAGER', 'ACCOUNTANT']);
  await told(audience.map((u) => u.id), 'timesheet.month_approved', { site, month: key });
  return done;
}
