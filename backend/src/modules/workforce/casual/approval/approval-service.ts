import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { verifySignerPin } from '../../_shared/pin/signer-pin';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { employeesRepository } from '../../people/employees/employees-repository';
import { told } from '../../people/people-context';
import { parseCents } from '../../payroll/engine/money';
import { getEffectiveRuleGroup } from '../../rules';
import { casualActor, casualEntry, jsonOf, priorResult } from '../casual-context';
import type { SheetView } from '../casual.types';
import { isUniqueViolation, recordingRepository } from '../recording/recording-repository';
import { repriceIfRateChanged } from '../recording/recording-service';
import { sheetRepository, type SheetRow } from '../sheet/sheet-repository';
import { buildView } from '../sheet/sheet-service';
import { sheetTotal } from '../sheet/sheet-view';
import { approvalRepository } from './approval-repository';
import { assertMayDecide, assertSent, isUnitManager, mayDecide } from './approval-rules';
import { buildSnapshot, hashSnapshot } from './sheet-snapshot';
import type { ApproveBody } from './approval-validators';

const GONE = () => new NotFoundError('There is no such pay sheet', 'NO_SHEET');
const CHANGED = (details?: unknown) => new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH', details);

async function viewOf(companyId: string, sheetId: string): Promise<SheetView> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) throw GONE();
  return buildView(row);
}

/** The sheet if the caller may decide it. A sheet outside their reach is the same 404 as a missing one. */
async function decidable(subject: AccessSubject, companyId: string, sheetId: string): Promise<{ row: SheetRow; recorderRole: string }> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) throw GONE();
  const recorder = (await sheetRepository.names([row.recordedById])).get(row.recordedById);
  const recorderRole = recorder?.role ?? '';
  if (!mayDecide({ id: subject.id, role: subject.role, siteId: subject.siteId, scope: scopeOf(subject, 'casual.approve') }, { siteId: row.siteId, recordedById: row.recordedById, sentById: row.sentById, recordedByRole: recorderRole })) throw GONE();
  return { row, recorderRole };
}

/** The cash holder the Rules name (PD24): a named person, or the Branch Manager (the approver when they are one, else the site's manager). */
async function cashHolderOf(row: SheetRow, approver: { id: string; role: string }): Promise<string> {
  const { pettyCashHolder } = (await getEffectiveRuleGroup(row.siteId, fromDateColumn(row.workDate), 'CASUAL_WORK')).values;
  if (pettyCashHolder.mode === 'NAMED' && (await approvalRepository.activeUser(pettyCashHolder.userId))) return pettyCashHolder.userId;
  if (isUnitManager(approver.role)) return approver.id;
  return (await employeesRepository.siteManagerUserIds(row.siteId))[0] ?? approver.id;
}

/**
 * The Branch Manager (or the Director) approves with a PIN (S8). Order: capability 403, the same key (the first result), the sheet and
 * the caller's reach (404), waiting (409), not the recorder (403), the version and total the dialog showed (409), a changed rate
 * (re-priced, 409), the PIN. One transaction numbers the sheet CPS-n, freezes the snapshot and hash, and audits.
 */
export async function approveSheet(subject: AccessSubject, sheetId: string, body: ApproveBody, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.approve']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'approve');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const { row, recorderRole } = await decidable(subject, ctx.companyId, sheetId);
  assertSent(row.status);
  assertMayDecide({ id: subject.id, scope: scopeOf(subject, 'casual.approve') }, { ...row, recordedByRole: recorderRole });
  if (row.version !== body.version) throw CHANGED({ version: row.version });
  if (parseCents(sheetTotal(row)) !== parseCents(body.expectedTotal)) throw CHANGED({ total: sheetTotal(row) });
  if (await repriceIfRateChanged(ctx.companyId, row.id)) throw new ConflictError('The daily rate changed. Check the amounts.', 'RATE_CHANGED');
  await verifySignerPin(subject.id, body.pin);
  const holderId = await cashHolderOf(row, subject);
  const names = await sheetRepository.names([row.recordedById, subject.id, holderId]);
  const person = (id: string) => ({ id, name: names.get(id)?.name ?? '', role: names.get(id)?.role ?? '' });
  const [siteNames, deptNames] = await Promise.all([sheetRepository.siteNames([row.siteId]), sheetRepository.departmentNames([row.departmentId])]);
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.status !== 'SENT' || locked.version !== row.version) throw new ConflictError('Someone decided this sheet a moment ago. Check it again.', 'ALREADY_DECIDED');
      const number = await approvalRepository.nextNumber(tx, ctx.companyId);
      const snapshot = buildSnapshot(row, number, { recordedBy: person(row.recordedById), approvedBy: person(subject.id), cashHolder: { id: holderId, name: names.get(holderId)?.name ?? '' }, siteName: siteNames.get(row.siteId) ?? '', departmentName: deptNames.get(row.departmentId) ?? '' }, now);
      await recordingRepository.updateSheet(tx, row.id, { status: 'APPROVED', approvedAt: now, approvedById: subject.id, number, total: snapshot.total, snapshot: jsonOf(snapshot), documentHash: hashSnapshot(snapshot), cashHolderId: holderId });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'approve', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.sheet_approved', category: 'PAY_RUN_DECIDE', subjectType: 'CasualSheet', subjectId: row.id, after: { number: snapshot.number, date: snapshot.date, departmentId: row.departmentId, workers: row.lines.length, method: 'PIN' } })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const prior = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'approve');
    if (!prior) throw error;
  }
  const date = fromDateColumn(row.workDate);
  await told([row.recordedById, row.sentById], 'casual.approved', { date, sheetId: row.id });
  if (holderId !== subject.id) await told([holderId], 'casual.to_pay', { date, sheetId: row.id });
  return viewOf(ctx.companyId, row.id);
}

/** The approver sends the sheet back to the head with a reason (S8). The head is told; the reason is read on the sheet, not in the notice. */
export async function sendBack(subject: AccessSubject, sheetId: string, body: { reason: string; version: number; idempotencyKey: string }, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.approve']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'send-back');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const { row, recorderRole } = await decidable(subject, ctx.companyId, sheetId);
  assertSent(row.status);
  assertMayDecide({ id: subject.id, scope: scopeOf(subject, 'casual.approve') }, { ...row, recordedByRole: recorderRole });
  if (row.version !== body.version) throw CHANGED({ version: row.version });
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.status !== 'SENT' || locked.version !== row.version) throw new ConflictError('Someone decided this sheet a moment ago. Check it again.', 'ALREADY_DECIDED');
      await recordingRepository.updateSheet(tx, row.id, { status: 'SENT_BACK', sentBackAt: now, sentBackById: subject.id, sentBackReason: body.reason });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'send-back', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.sheet_sent_back', category: 'PAY_RUN_DECIDE', subjectType: 'CasualSheet', subjectId: row.id, after: { date: fromDateColumn(row.workDate) }, reason: body.reason })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await told([row.recordedById, row.sentById], 'casual.sent_back', { date: fromDateColumn(row.workDate), sheetId: row.id });
  return viewOf(ctx.companyId, row.id);
}

/** PD26: an approved sheet with no worker signature yet can be voided (reason and PIN). The number stays on record and the head records the day again. */
export async function voidSheet(subject: AccessSubject, sheetId: string, body: { reason: string; pin: string; version: number; idempotencyKey: string }, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.approve']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'void');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const { row } = await decidable(subject, ctx.companyId, sheetId);
  if (row.status !== 'APPROVED') throw new ConflictError('Only an approved sheet can be voided.', 'SHEET_NOT_APPROVED', { status: row.status });
  if (row.version !== body.version) throw CHANGED({ version: row.version });
  if (row.lines.some((l) => l.receivedAt !== null)) throw new ConflictError('A worker has signed for this sheet. Add a correction line on a later sheet instead.', 'ALREADY_SIGNED');
  await verifySignerPin(subject.id, body.pin);
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.status !== 'APPROVED' || locked.version !== row.version) throw CHANGED();
      if ((await approvalRepository.receivedCount(tx, row.id)) > 0) throw new ConflictError('A worker has signed for this sheet. Add a correction line on a later sheet instead.', 'ALREADY_SIGNED');
      await recordingRepository.updateSheet(tx, row.id, { status: 'VOID', voidedAt: now, voidedById: subject.id, voidReason: body.reason });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'void', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.sheet_voided', category: 'PAY_RUN_DECIDE', subjectType: 'CasualSheet', subjectId: row.id, after: { number: row.number, date: fromDateColumn(row.workDate), method: 'PIN' }, reason: body.reason })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await told([row.recordedById, row.sentById, row.cashHolderId], 'casual.voided', { date: fromDateColumn(row.workDate), sheetId: row.id });
  return viewOf(ctx.companyId, row.id);
}
