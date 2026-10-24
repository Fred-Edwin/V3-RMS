import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { registerDocument } from '../../_shared/documents/register-document';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { clearCellsForLeave, noteLeaveCellsCleared } from '../../rota/leave/clear-cells-for-leave';
import { balancesOf } from '../balances/balance-service';
import { applicationsRepository, type ApplicationRow } from '../data/applications-repository';
import { eventsRepository } from '../data/events-repository';
import { dbOf, peopleRepository, type LeavePerson } from '../data/people-repository';
import { countDays, leaveYearOf } from '../engine/leave-days';
import { asJson, eventOf, leaveEntry } from '../leave-audit';
import { tell } from '../leave-notify';
import type { ApproveBody } from '../leave-validators';
import { nameAndRole, roleWord } from '../leave-words';
import { slipDocumentInput } from '../slip/slip-document';
import { buildSlipSnapshot, hashSlip, slipCode } from '../slip/slip-snapshot';
import { summaryOf, type ApplicationSummary } from './application-summary';
import { assertMayDecide, assertWaitingAndFresh, loadDecision, lockedApplication } from './decide-guard';

export interface ApproveResult {
  application: ApplicationSummary;
  slipNumber: number;
  slipCode: string;
  rotaCellsRemoved: number;
  repeat: boolean;
}

/** A carried waiting request from the old system is recounted in calendar days when it is decided here (L6); new ones are as asked. */
const countedNow = (app: ApplicationRow): { days: number; unpaidTailDays: number } => (app.origin === 'LEGACY' ? { days: countDays(app.start, app.end), unpaidTailDays: 0 } : { days: app.days, unpaidTailDays: app.unpaidTailDays });

/** Days left before and after, or a 409 when the days are not there any more (checked again at the moment of approval, L11). */
async function checkBalance(person: LeavePerson, app: ApplicationRow, now: Date, tx?: Prisma.TransactionClient): Promise<{ before: number | null; after: number | null }> {
  const { days, unpaidTailDays } = countedNow(app);
  const requestable = (await balancesOf(person, leaveYearOf(app.start), now, tx)).requestable.find((type) => type.code === app.typeCode);
  const left = requestable ? requestable.left : app.type.paid ? 0 : null;
  const taken = days - unpaidTailDays;
  if (left !== null && taken > left) throw new ConflictError(`${person.name} has ${left} days left and this is ${taken}.`, 'BALANCE_TOO_LOW', { left, days: taken });
  return { before: left, after: left === null ? null : left - taken };
}

/**
 * Approve (D3, spec section 4): application must be waiting, the version the screen saw, the caller the routed decider, then the days
 * must still be there, the start not passed, and the approver's PIN right. One transaction: row lock, version-checked update, the LVE
 * number, the frozen slip, the person's rota cells removed, the status event, the audit entries last. The same Idempotency-Key
 * returns the first result.
 */
export async function approveLeave(subject: AccessSubject, id: string, body: ApproveBody, key: string, now: Date = new Date()): Promise<ApproveResult> {
  const { app, person, ctx } = await loadDecision(subject, id);
  const earlier = await eventsRepository.byKey(dbOf(), app.id, key);
  if (earlier && app.status === 'APPROVED') return replay(app, now);

  await assertWaitingAndFresh(app, body.expectedVersion);
  await assertMayDecide(subject, app, person, now);
  const today = nairobiToday(now);
  if (app.start < today) throw new ConflictError('These days have already started. Decline it or ask the person to send new dates.', 'STARTED_WHILE_WAITING');
  await checkBalance(person, app, now);
  await verifySignerPin(subject.id, body.pin, now.getTime());

  const head = person.departmentId ? await peopleRepository.headOf(person.departmentId, today) : null;
  let cleared: NairobiDate[] = [];
  const done = await runAudited<ApproveResult>(async (tx) => {
    const locked = await lockedApplication(tx, ctx.companyId, app.id);
    await assertWaitingAndFresh(locked, body.expectedVersion);
    const balance = await checkBalance(person, locked, now, tx);
    const counted = countedNow(locked);
    const number = await applicationsRepository.nextSlipNumber(tx);
    const snapshot = buildSlipSnapshot({
      number,
      person: { name: person.name, roleLabel: person.positionName ?? roleWord(person.role), department: person.departmentName, site: person.siteName },
      type: { code: locked.typeCode, label: locked.type.label, paid: locked.type.paid },
      start: locked.start, end: locked.end, days: counted.days, unpaidTailDays: counted.unpaidTailDays,
      sickNoteNeeded: locked.type.sickNoteAfterDays !== null && counted.days > locked.type.sickNoteAfterDays,
      askedAt: locked.askedAt, approvedAt: now,
      approver: { name: ctx.name, roleLabel: roleWord(subject.role), role: subject.role },
      balanceBefore: balance.before, balanceAfter: balance.after,
      head: head && head.employeeId !== person.id ? { name: head.name, roleLabel: `Head of ${person.departmentName ?? 'the department'}` } : null,
    });
    const changed = await applicationsRepository.update(tx, locked.id, locked.version, {
      status: 'APPROVED', decidedAt: now, decidedBy: subject.id, deciderRole: subject.role,
      slipNumber: number, slipSnapshot: snapshot as unknown as Prisma.InputJsonValue, slipHash: hashSlip(snapshot),
      balanceBefore: balance.before, balanceAfter: balance.after,
      ...(locked.origin === 'LEGACY' ? { origin: 'NEW', countedIn: 'CALENDAR_DAYS', days: counted.days, unpaidTailDays: counted.unpaidTailDays } : {}),
    });
    if (!changed) throw new ConflictError('This request changed while you were looking. It has been reloaded.', 'STALE_REQUEST');
    // The Signed documents door, in this same transaction: a rollback leaves no LVE row in the index.
    await registerDocument(tx, slipDocumentInput({
      companyId: ctx.companyId, siteId: locked.siteId, applicationId: locked.id, slipNumber: number, slipHash: hashSlip(snapshot), start: locked.start, end: locked.end,
      employeeUserId: person.userId, signer: { id: subject.id, name: ctx.name, role: subject.role }, signedAt: now,
    }));
    await eventsRepository.add(tx, { applicationId: locked.id, kind: 'APPROVED', at: now, byUser: subject.id, role: subject.role, idempotencyKey: key });
    const rota = await clearCellsForLeave(tx, { companyId: ctx.companyId, siteId: locked.siteId, employeeId: person.id, userId: person.userId, personLabel: nameAndRole(person.name, person.positionName, person.role), from: locked.start, to: locked.end, applicationId: locked.id, actor: ctx.auditActor });
    cleared = rota.dates;
    const entry = leaveEntry({
      companyId: ctx.companyId, siteId: locked.siteId, actor: ctx.auditActor, action: 'leave.approved', subjectId: locked.id, userId: person.userId,
      before: asJson({ status: 'WAITING' }),
      after: asJson({ status: 'APPROVED', type: locked.typeCode, start: locked.start, end: locked.end, days: counted.days, unpaidTailDays: counted.unpaidTailDays, slip: slipCode(number), balanceBefore: balance.before, balanceAfter: balance.after, rotaCellsRemoved: rota.removed, deciderRole: subject.role, method: 'PIN' }),
    });
    const event = eventOf('leave.decided', { siteId: locked.siteId, requestId: locked.id, employeeId: person.id, outcome: 'APPROVED' }, now);
    const updated = (await applicationsRepository.byId(ctx.companyId, locked.id, tx)) as ApplicationRow;
    return { result: { application: summaryOf(updated, now), slipNumber: number, slipCode: slipCode(number), rotaCellsRemoved: rota.removed, repeat: false }, entries: rota.entry ? [entry, rota.entry] : [entry], events: [event] };
  });

  if (cleared.length > 0) noteLeaveCellsCleared({ siteId: app.siteId, employeeId: person.id, userId: person.userId, dates: cleared, changedById: subject.id });
  await tell([person.userId], 'leave.approved', { id: app.id });
  await tell([head && head.employeeId !== person.id ? head.userId : null], 'leave.head_told', { id: app.id, name: person.name });
  return done;
}

async function replay(app: ApplicationRow, now: Date): Promise<ApproveResult> {
  return { application: summaryOf(app, now), slipNumber: app.slipNumber ?? 0, slipCode: slipCode(app.slipNumber ?? 0), rotaCellsRemoved: 0, repeat: true };
}
