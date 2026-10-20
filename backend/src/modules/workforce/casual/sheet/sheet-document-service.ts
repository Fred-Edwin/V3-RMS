import { env } from '../../../../config/env';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { roleLabel } from '../../timesheets/approval/decided-by';
import { longDay, longStamp, clockOf } from '../../timesheets/exports/export-format';
import { verifyPath } from '../approval/sheet-snapshot';
import { assertCanSee, casualActor } from '../casual-context';
import type { SheetSnapshot } from '../casual.types';
import { clockOfMinute } from '../recording/shift-rules';
import { sheetRepository, type SheetRow } from './sheet-repository';
import { renderSheetPdf, type SheetDoc, type SheetDocLine } from './sheet-pdf';
import { cpsNumber, maskId, sheetTotal } from './sheet-view';

const READERS = ['casual.read', 'casual.record', 'casual.approve'] as const;
const who = (p: { name: string; role: string }): string => `${p.name}, ${roleLabel(p.role)}`;
const kes = (amount: string): string => amount.replace(/\.00$/, '');

function hoursOf(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const workedOf = (startMinute: number, endMinute: number): string => `${clockOfMinute(startMinute)} to ${clockOfMinute(endMinute)}${endMinute >= 1440 ? ' (+1)' : ''}`;

async function load(subject: AccessSubject, id: string): Promise<{ companyId: string; row: SheetRow }> {
  const ctx = await casualActor(subject, READERS);
  const row = await sheetRepository.byId(ctx.companyId, id);
  if (!row) throw new NotFoundError('There is no such pay sheet', 'NO_SHEET');
  assertCanSee(subject, row);
  return { companyId: ctx.companyId, row };
}

/** The draft the head checks before sending (S9): drawn from the live lines, never stored, "CPS-draft" and no signature or QR. */
export async function previewPdf(subject: AccessSubject, id: string, now: Date = new Date()): Promise<Buffer> {
  const { row } = await load(subject, id);
  if (row.status === 'APPROVED' || row.status === 'VOID') throw new ConflictError('This sheet is approved. Open the pay sheet instead.', 'SHEET_NOT_DRAFT', { status: row.status });
  const [users, sites, depts] = await Promise.all([sheetRepository.names([row.recordedById]), sheetRepository.siteNames([row.siteId]), sheetRepository.departmentNames([row.departmentId])]);
  const recorder = users.get(row.recordedById);
  const doc: SheetDoc = {
    mode: 'DRAFT',
    number: 'CPS-draft',
    dateLong: longDay(fromDateColumn(row.workDate)),
    site: sites.get(row.siteId) ?? '',
    department: depts.get(row.departmentId) ?? '',
    recordedBy: recorder ? who(recorder) : 'the department head',
    sentAt: row.sentAt ? longStamp(row.sentAt) : null,
    approvedBy: null,
    cashHolder: null,
    rate: row.rate.toFixed(2),
    lines: row.lines.map((l): SheetDocLine => ({ name: l.worker.fullName, idMasked: maskId(l.worker.nationalId), worked: workedOf(l.startMinute, l.endMinute), hours: hoursOf(l.minutes), amount: l.amount.toFixed(2), received: null })),
    corrections: row.corrections.map((c) => ({ text: `Correction for ${longDay(fromDateColumn(c.originalDate))}, KES ${kes(c.amount.toFixed(2)).replace('-', '−')}, ${c.reason}`, amount: c.amount.toFixed(2) })),
    total: sheetTotal(row),
    created: now,
    qrUrl: null,
  };
  return renderSheetPdf(doc);
}

/** The approved sheet (S10), drawn from the frozen snapshot plus the receipts so far. Unchanged data gives the same bytes. */
export async function documentPdf(subject: AccessSubject, id: string): Promise<{ bytes: Buffer; number: string }> {
  const { row } = await load(subject, id);
  const snapshot = row.snapshot as unknown as SheetSnapshot | null;
  if ((row.status !== 'APPROVED' && row.status !== 'VOID') || !snapshot || row.number === null || !row.documentHash || !row.approvedAt) {
    throw new ConflictError('This sheet has not been approved yet. Preview it instead.', 'SHEET_NOT_APPROVED', { status: row.status });
  }
  const received = new Map(row.lines.map((l) => [l.id, l]));
  const stamps = row.lines.flatMap((l) => (l.receivedAt ? [l.receivedAt.getTime()] : []));
  const doc: SheetDoc = {
    mode: row.status === 'VOID' ? 'VOID' : 'APPROVED',
    number: snapshot.number,
    dateLong: longDay(snapshot.date),
    site: snapshot.site.name,
    department: snapshot.department.name,
    recordedBy: who(snapshot.recordedBy),
    sentAt: row.sentAt ? longStamp(row.sentAt) : null,
    approvedBy: { name: snapshot.approvedBy.name, roleLine: roleLabel(snapshot.approvedBy.role), signedAt: longStamp(new Date(snapshot.approvedBy.signedAt)) },
    cashHolder: snapshot.cashHolder.name,
    rate: snapshot.rate,
    lines: snapshot.lines.map((l): SheetDocLine => {
      const r = received.get(l.lineId);
      return { name: l.name, idMasked: l.idMasked, worked: workedOf(l.startMinute, l.endMinute), hours: hoursOf(l.minutes), amount: l.amount, received: r?.receivedAt && r.receivedName ? { name: r.receivedName, at: clockOf(r.receivedAt.toISOString()) ?? '' } : null };
    }),
    corrections: snapshot.corrections.map((c) => ({ text: `Correction for ${longDay(c.originalDate)}, KES ${kes(c.amount).replace('-', '−')}, ${c.reason}`, amount: c.amount })),
    total: snapshot.total,
    created: new Date(Math.max(row.approvedAt.getTime(), ...stamps)),
    qrUrl: `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}${verifyPath(cpsNumber(row.number), row.documentHash)}`,
  };
  return { bytes: await renderSheetPdf(doc), number: snapshot.number };
}
