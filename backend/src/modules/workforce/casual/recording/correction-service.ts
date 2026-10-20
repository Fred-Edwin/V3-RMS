import { ConflictError, NotFoundError, UnprocessableEntityError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { parseCents } from '../../payroll/engine/money';
import { casualActor, casualEntry, dateColumn, initialsOf, jsonOf, priorResult } from '../casual-context';
import type { SheetView } from '../casual.types';
import { sheetRepository, type SheetRow } from '../sheet/sheet-repository';
import { buildView } from '../sheet/sheet-service';
import { sheetTotal } from '../sheet/sheet-view';
import { isUniqueViolation, recordingRepository } from './recording-repository';
import type { CorrectionBody } from './recording-validators';

const EDITABLE = ['DRAFT', 'SENT_BACK'];

async function editableSheet(subject: AccessSubject, companyId: string, sheetId: string, version: number): Promise<SheetRow> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  assertInScope(subject, 'casual.record', { userId: null, siteId: row.siteId, departmentId: row.departmentId }, 'not_found');
  if (!EDITABLE.includes(row.status)) throw new ConflictError('This sheet can no longer be edited.', 'SHEET_NOT_EDITABLE', { status: row.status });
  if (row.version !== version) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH', { version: row.version });
  return row;
}

async function viewOf(companyId: string, sheetId: string): Promise<SheetView> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  return buildView(row);
}

/**
 * PD26: a day a worker has signed for is never edited. A head adds a plus or minus line to a LATER sheet of the same department and
 * site, with the reason; the line counts in that sheet's total and prints on it, and is approved the usual way.
 */
export async function addCorrection(subject: AccessSubject, sheetId: string, body: CorrectionBody): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'add-correction');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const row = await editableSheet(subject, ctx.companyId, sheetId, body.version);
  const sheetDate = fromDateColumn(row.workDate);
  if (body.originalDate >= sheetDate) throw new UnprocessableEntityError('A correction goes on a later sheet than the day it corrects.', 'CORRECTION_NOT_LATER');
  const worker = (await recordingRepository.workersByIds(ctx.companyId, [body.casualId]))[0];
  if (!worker) throw new NotFoundError('There is no such casual worker', 'NO_CASUAL');
  if (!(await recordingRepository.signedLine(ctx.companyId, row.siteId, row.departmentId, worker.id, body.originalDate))) {
    throw new UnprocessableEntityError('There is no signed day for that worker on that date. Edit an unsigned day instead.', 'NO_SIGNED_DAY');
  }
  const amount = `${body.amount}.00`;
  const after = parseCents(sheetTotal(row)) + parseCents(amount);
  if (after < 0n) throw new UnprocessableEntityError('The sheet total cannot be below zero.', 'TOTAL_NEGATIVE');
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.version !== row.version || !EDITABLE.includes(locked.status)) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
      await recordingRepository.addCorrection(tx, { sheetId: row.id, workerId: worker.id, originalDate: dateColumn(body.originalDate), amount, reason: body.reason, idempotencyKey: body.idempotencyKey, createdById: subject.id });
      await recordingRepository.updateSheet(tx, row.id, {});
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'add-correction', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.correction_added', category: 'PAY_RUN_PREPARE', subjectType: 'CasualSheet', subjectId: row.id, after: { for: body.originalDate, initials: initialsOf(worker.fullName), direction: body.amount.startsWith('-') ? 'minus' : 'plus' }, reason: body.reason })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return viewOf(ctx.companyId, row.id);
}

export async function removeCorrection(subject: AccessSubject, sheetId: string, correctionId: string, body: { version: number; idempotencyKey: string }): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'remove-correction');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const row = await editableSheet(subject, ctx.companyId, sheetId, body.version);
  const found = await recordingRepository.findCorrection(row.id, correctionId);
  if (!found) throw new NotFoundError('There is no such correction', 'NO_CORRECTION');
  await runAudited(async (tx) => {
    const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
    if (!locked || locked.version !== row.version || !EDITABLE.includes(locked.status)) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    await recordingRepository.deleteCorrection(tx, found.id);
    await recordingRepository.updateSheet(tx, row.id, {});
    await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'remove-correction', response: jsonOf({ sheetId: row.id }) });
    return { result: null, entries: [] };
  });
  return viewOf(ctx.companyId, row.id);
}
