import { ConflictError, NotFoundError, UnprocessableEntityError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, nairobiToday, type NairobiDate } from '../../_shared/time/nairobi-time';
import { assertInScope, type AccessSubject } from '../../_shared/workforce-access';
import { told } from '../../people/people-context';
import { approverRecipients } from '../approval/approval-recipients';
import { casualActor, casualEntry, dateColumn, departmentOf, dayRateFor, initialsOf, jsonOf, priorResult } from '../casual-context';
import type { SheetView, WorkerView } from '../casual.types';
import { buildView } from '../sheet/sheet-service';
import { maskId } from '../sheet/sheet-view';
import { sheetRepository } from '../sheet/sheet-repository';
import { casualDayPay } from './casual-pay';
import { assertRecordable, clockOfMinute, firstUnfinished, neighbourDates, overlaps, shiftOf, type Shift } from './shift-rules';
import { isUniqueViolation, recordingRepository, type NewLine } from './recording-repository';
import type { NewCasualBody, PutLinesBody } from './recording-validators';

const CHANGED = (details?: unknown) => new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH', details);
const EDITABLE = ['DRAFT', 'SENT_BACK'] as const;
const today = (now: Date): NairobiDate => nairobiToday(now);

const workerView = (w: { id: string; fullName: string; nationalId: string; phone: string | null }, lastWorked: string | null = null): WorkerView => ({ id: w.id, fullName: w.fullName, idMasked: maskId(w.nationalId), phone: w.phone, lastWorked });

/** A head adds a casual worker (PD20). The ID number is unique across the company: a second try returns the existing record to pick (409 CASUAL_EXISTS). A retry with the same key returns the first result. */
export async function addCasual(subject: AccessSubject, body: NewCasualBody): Promise<WorkerView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const nationalId = body.nationalId.toUpperCase();
  const again = await priorResult<{ workerId: string }>(ctx.companyId, body.idempotencyKey, 'add-casual');
  if (again) return workerView((await recordingRepository.workersByIds(ctx.companyId, [again.workerId]))[0] ?? notFoundWorker());
  const existing = await recordingRepository.workerByNationalId(ctx.companyId, nationalId);
  if (existing) throw new ConflictError('This worker is already on file. Pick them from the list.', 'CASUAL_EXISTS', { worker: workerView(existing) });
  try {
    const created = await runAudited(async (tx) => {
      const worker = await recordingRepository.createWorker(tx, { companyId: ctx.companyId, nationalId, fullName: body.fullName.replace(/\s+/g, ' '), phone: body.phone ?? null, createdById: subject.id });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'add-casual', response: jsonOf({ workerId: worker.id }) });
      return { result: worker, entries: [casualEntry({ companyId: ctx.companyId, siteId: null, actor: ctx.auditActor, action: 'casual.person_added', category: 'PAY_RUN_PREPARE', subjectType: 'CasualWorker', subjectId: worker.id, after: { initials: initialsOf(worker.fullName) } })] };
    });
    return workerView(created);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await recordingRepository.workerByNationalId(ctx.companyId, nationalId);
    if (winner) throw new ConflictError('This worker is already on file. Pick them from the list.', 'CASUAL_EXISTS', { worker: workerView(winner) });
    const prior = await priorResult<{ workerId: string }>(ctx.companyId, body.idempotencyKey, 'add-casual');
    if (prior) return workerView((await recordingRepository.workersByIds(ctx.companyId, [prior.workerId]))[0] ?? notFoundWorker());
    throw error;
  }
}

function notFoundWorker(): never {
  throw new NotFoundError('There is no such casual worker', 'NO_CASUAL');
}

interface PreparedLine extends NewLine {
  name: string;
}

/** Everything about the lines that needs no database: times, the 16 hour limit, unique workers, pay. */
function prepareLines(body: PutLinesBody, rate: string, names: ReadonlyMap<string, string>): PreparedLine[] {
  const seen = new Set<string>();
  return body.lines.map((line) => {
    if (seen.has(line.casualId)) throw new UnprocessableEntityError('A worker can be on a sheet once. Edit their times instead.', 'DUPLICATE_WORKER', { casualId: line.casualId });
    seen.add(line.casualId);
    const shift: Shift = shiftOf(line);
    return { workerId: line.casualId, startMinute: shift.startMinute, endMinute: shift.endMinute, minutes: shift.minutes, amount: casualDayPay(rate, shift.minutes), name: names.get(line.casualId) ?? '' };
  });
}

/** A worker already on another sheet at overlapping times, on any site (PD23). The message names the site and times, never the other head. */
async function assertNoOverlap(companyId: string, date: NairobiDate, lines: readonly PreparedLine[], exceptSheetId: string | null): Promise<void> {
  if (lines.length === 0) return;
  const others = await recordingRepository.otherShifts(companyId, lines.map((l) => l.workerId), neighbourDates(date), exceptSheetId);
  for (const line of lines) {
    for (const other of others.filter((o) => o.workerId === line.workerId)) {
      if (overlaps({ workDate: date, startMinute: line.startMinute, endMinute: line.endMinute }, { workDate: fromDateColumn(other.sheet.workDate), startMinute: other.startMinute, endMinute: other.endMinute })) {
        const site = (await sheetRepository.siteName(other.sheet.siteId)) || 'another site';
        throw new ConflictError(`This worker is already recorded at ${site} from ${clockOfMinute(other.startMinute)} to ${clockOfMinute(other.endMinute)}.`, 'WORKER_OVERLAP', { casualId: line.workerId });
      }
    }
  }
}

/**
 * Create the day's sheet or replace its lines (S7). Idempotent three ways: the same `idempotencyKey` returns the first result (an
 * offline retry makes one record); the `version` the screen saw must still be the sheet's (a stale save is 409 CHANGED_UNDERNEATH, PD29);
 * and one writer per worker at a time, so the overlap check cannot be raced from two sites.
 */
export async function putLines(subject: AccessSubject, body: PutLinesBody, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'put-lines');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const dept = await departmentOf(ctx.companyId, body.siteId, body.departmentId);
  assertInScope(subject, 'casual.record', { userId: null, siteId: dept.siteId, departmentId: dept.id }, 'not_found');
  assertRecordable(body.date, today(now));
  const { rate, version: rateVersion } = await dayRateFor(dept.siteId, dept.id, body.date);
  if (rate === null) throw new ConflictError(`No daily rate for ${dept.name}. Ask the Director.`, 'NO_DAILY_RATE');
  const workers = await recordingRepository.workersByIds(ctx.companyId, body.lines.map((l) => l.casualId));
  if (workers.length !== new Set(body.lines.map((l) => l.casualId)).size) throw new NotFoundError('One of those workers is not on file', 'NO_CASUAL');
  const lines = prepareLines(body, rate, new Map(workers.map((w) => [w.id, w.fullName])));
  try {
    const sheetId = await runAudited(async (tx) => {
      await recordingRepository.lockWorkers(tx, lines.map((l) => l.workerId));
      const existingId = await recordingRepository.lockLive(tx, ctx.companyId, dept.siteId, dept.id, body.date);
      const locked = existingId ? await recordingRepository.lockById(tx, ctx.companyId, existingId) : null;
      if (locked && !(EDITABLE as readonly string[]).includes(locked.status)) throw new ConflictError('This sheet can no longer be edited.', 'SHEET_NOT_EDITABLE', { status: locked.status });
      if ((locked?.version ?? 0) !== body.version) throw CHANGED({ version: locked?.version ?? 0 });
      await assertNoOverlap(ctx.companyId, body.date, lines, locked?.id ?? null);
      let id: string;
      if (locked) {
        id = locked.id;
        await recordingRepository.updateSheet(tx, id, { rate, rateVersion });
      } else {
        id = (await recordingRepository.createSheet(tx, { companyId: ctx.companyId, siteId: dept.siteId, departmentId: dept.id, workDate: dateColumn(body.date), rate, rateVersion, recordedById: subject.id })).id;
      }
      await recordingRepository.replaceLines(tx, id, lines);
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'put-lines', response: jsonOf({ sheetId: id }) });
      return { result: id, entries: [] };
    });
    return await viewOf(ctx.companyId, sheetId);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const prior = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'put-lines');
    if (prior) return viewOf(ctx.companyId, prior.sheetId);
    throw CHANGED();
  }
}

async function viewOf(companyId: string, sheetId: string): Promise<SheetView> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  return buildView(row);
}

/** If the day rate in Rules changed since the lines were priced, price them again and say so (the amounts freeze at approval, PD16). */
export async function repriceIfRateChanged(companyId: string, sheetId: string): Promise<boolean> {
  const row = await sheetRepository.byId(companyId, sheetId);
  if (!row) return false;
  const { rate, version } = await dayRateFor(row.siteId, row.departmentId, fromDateColumn(row.workDate));
  if (rate === null || rate === row.rate.toFixed(2)) return false;
  await runAudited(async (tx) => {
    const locked = await recordingRepository.lockById(tx, companyId, sheetId);
    if (!locked || locked.version !== row.version) return { result: null, entries: [] };
    await recordingRepository.reprice(tx, sheetId, new Map(row.lines.map((l) => [l.id, casualDayPay(rate, l.minutes)])));
    await recordingRepository.updateSheet(tx, sheetId, { rate, rateVersion: version });
    return { result: null, entries: [] };
  });
  return true;
}

/** Send the sheet to the approver (S7). Every shift must have ended (PD23). No PIN: the head signs nothing, the name and time are recorded. */
export async function sendSheet(subject: AccessSubject, sheetId: string, body: { version: number; idempotencyKey: string }, now: Date = new Date()): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'send');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const row = await sheetRepository.byId(ctx.companyId, sheetId);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  assertInScope(subject, 'casual.record', { userId: null, siteId: row.siteId, departmentId: row.departmentId }, 'not_found');
  if (!(EDITABLE as readonly string[]).includes(row.status)) throw new ConflictError('This sheet was already sent.', 'SHEET_NOT_SENDABLE', { status: row.status });
  if (row.version !== body.version) throw CHANGED({ version: row.version });
  if (row.lines.length === 0) throw new UnprocessableEntityError('Add at least one casual.', 'NO_LINES');
  const workDate = fromDateColumn(row.workDate);
  const unfinished = firstUnfinished(workDate, row.lines, now);
  if (unfinished) throw new ConflictError(`${unfinished.worker.fullName}'s time ends at ${clockOfMinute(unfinished.endMinute)}. You can send after that.`, 'SHIFT_NOT_ENDED', { casualId: unfinished.workerId });
  const { rate } = await dayRateFor(row.siteId, row.departmentId, workDate);
  if (rate === null) throw new ConflictError('No daily rate for this department. Ask the Director.', 'NO_DAILY_RATE');
  if (await repriceIfRateChanged(ctx.companyId, row.id)) throw new ConflictError('The daily rate changed. Check the amounts.', 'RATE_CHANGED');
  const recorder = (await sheetRepository.names([row.recordedById])).get(row.recordedById);
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.version !== row.version || !(EDITABLE as readonly string[]).includes(locked.status)) throw CHANGED();
      await recordingRepository.updateSheet(tx, row.id, { status: 'SENT', sentAt: now, sentById: subject.id, sentBackAt: null, sentBackById: null, sentBackReason: null });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'send', response: jsonOf({ sheetId: row.id }) });
      return {
        result: null,
        entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.sheet_sent', category: 'PAY_RUN_PREPARE', subjectType: 'CasualSheet', subjectId: row.id, after: { date: workDate, workers: row.lines.length, departmentId: row.departmentId } })],
      };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return viewOf(ctx.companyId, row.id);
  }
  await told(await approverRecipients(ctx.companyId, row.siteId, recorder?.role ?? '', subject.id), 'casual.sent', { date: workDate, sheetId: row.id });
  return viewOf(ctx.companyId, row.id);
}

/** The head takes a waiting sheet back to edit it (S7 "Take it back"). Only while it is still waiting. */
export async function takeBack(subject: AccessSubject, sheetId: string, body: { version: number; idempotencyKey: string }): Promise<SheetView> {
  const ctx = await casualActor(subject, ['casual.record']);
  const again = await priorResult<{ sheetId: string }>(ctx.companyId, body.idempotencyKey, 'take-back');
  if (again) return viewOf(ctx.companyId, again.sheetId);
  const row = await sheetRepository.byId(ctx.companyId, sheetId);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  assertInScope(subject, 'casual.record', { userId: null, siteId: row.siteId, departmentId: row.departmentId }, 'not_found');
  if (row.status !== 'SENT') throw new ConflictError('The Branch Manager has already decided this sheet. Check it again.', 'SHEET_NOT_WAITING', { status: row.status });
  if (row.version !== body.version) throw CHANGED({ version: row.version });
  try {
    await runAudited(async (tx) => {
      const locked = await recordingRepository.lockById(tx, ctx.companyId, row.id);
      if (!locked || locked.status !== 'SENT' || locked.version !== row.version) throw new ConflictError('The Branch Manager has already decided this sheet. Check it again.', 'SHEET_NOT_WAITING');
      await recordingRepository.updateSheet(tx, row.id, { status: 'DRAFT', sentAt: null, sentById: null });
      await recordingRepository.saveKey(tx, { companyId: ctx.companyId, key: body.idempotencyKey, action: 'take-back', response: jsonOf({ sheetId: row.id }) });
      return { result: null, entries: [casualEntry({ companyId: ctx.companyId, siteId: row.siteId, actor: ctx.auditActor, action: 'casual.sheet_taken_back', category: 'PAY_RUN_PREPARE', subjectType: 'CasualSheet', subjectId: row.id, after: { date: fromDateColumn(row.workDate) } })] };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return viewOf(ctx.companyId, row.id);
}
