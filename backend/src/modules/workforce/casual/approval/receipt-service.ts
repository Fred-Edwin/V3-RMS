import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { casualActor, casualEntry, initialsOf, jsonOf, priorResult } from '../casual-context';
import type { SheetView } from '../casual.types';
import { isUniqueViolation, recordingRepository } from '../recording/recording-repository';
import { sheetRepository } from '../sheet/sheet-repository';
import { buildView } from '../sheet/sheet-service';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import { approvalRepository } from './approval-repository';
import type { ReceiveBody } from './approval-validators';

/**
 * PD25: after approval the head's phone lists each worker "Waiting for the cash". When the cash holder has paid, the worker types their
 * full name on the head's phone and taps "I received". One signature per line, once: a second try with another key is a 409; a retry
 * with the same key (a double tap, a lost reply) returns the same sheet.
 */
export async function receiveCash(subject: AccessSubject, sheetId: string, lineId: string, body: ReceiveBody, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'receive');
  const load = async (id: string) => {
    const fresh = await sheetRepository.byId(ctx.companyId, id);
    if (!fresh) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
    return fresh;
  };
  if (again) return buildView(await load(again.sheetId));
  const row = await load(sheetId);
  assertInScope(subject, 'casual.record', { userId: null, siteId: row.siteId, departmentId: row.departmentId }, 'not_found');
  if (row.status !== 'APPROVED') throw new ConflictError('The Branch Manager has not approved this sheet yet.', 'SHEET_NOT_APPROVED', { status: row.status });
  const line = row.lines.find((l) => l.id === lineId);
  if (!line) throw new NotFoundError('There is no such line on this sheet', 'NO_LINE');
  if (line.receivedAt) throw new ConflictError('This worker has already signed.', 'ALREADY_RECEIVED');
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.status !== 'APPROVED') throw new ConflictError('The Branch Manager has not approved this sheet yet.', 'SHEET_NOT_APPROVED');
      const signed = await approvalRepository.markReceived(tx, line.id, { receivedAt: now, receivedName: body.name.replace(/\s+/g, ' '), receivedById: subject.id });
      if (!signed) throw new ConflictError('This worker has already signed.', 'ALREADY_RECEIVED');
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'receive', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.received', category: 'PAY_RUN_PREPARE', subjectType: 'CasualSheet', subjectId: row.id, after: { number: row.number, date: fromDateColumn(row.workDate), initials: initialsOf(line.worker.fullName), at: now.toISOString() } })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return buildView(await load(row.id));
}
