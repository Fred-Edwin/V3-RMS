import { fromDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { formatCents, parseCents } from '../../payroll/engine/money';
import type { CorrectionView, LineView, SheetView } from '../casual.types';
import { clockOfMinute } from '../recording/shift-rules';
import { payWorking, sumAmounts } from '../recording/casual-pay';
import type { SheetRow } from './sheet-repository';

/** "ID 3••••••21": the first digit and the last two (S10). */
export function maskId(nationalId: string): string {
  if (nationalId.length <= 3) return '•'.repeat(nationalId.length);
  return `${nationalId.slice(0, 1)}${'•'.repeat(nationalId.length - 3)}${nationalId.slice(-2)}`;
}

export const cpsNumber = (n: number): string => `CPS-${String(n).padStart(4, '0')}`;

export interface SheetNames {
  siteName: string;
  departmentName: string;
  users: Map<string, { name: string; role: string }>;
}

const lineView = (line: SheetRow['lines'][number], rate: string): LineView => ({
  id: line.id,
  casualId: line.workerId,
  name: line.worker.fullName,
  idMasked: maskId(line.worker.nationalId),
  start: clockOfMinute(line.startMinute),
  end: clockOfMinute(line.endMinute),
  endsNextDay: line.endMinute >= 1440,
  minutes: line.minutes,
  amount: line.amount.toFixed(2),
  working: payWorking(rate, line.minutes),
  receivedAt: line.receivedAt?.toISOString() ?? null,
  receivedName: line.receivedName,
});

const correctionView = (c: SheetRow['corrections'][number]): CorrectionView => ({
  id: c.id,
  casualId: c.workerId,
  name: c.worker.fullName,
  originalDate: fromDateColumn(c.originalDate),
  amount: c.amount.toFixed(2),
  reason: c.reason,
});

/** The total of a stored sheet: its lines plus its correction lines. Approved sheets use the figure frozen at approval. */
export const sheetTotal = (row: Pick<SheetRow, 'status' | 'total' | 'lines' | 'corrections'>): string =>
  row.status === 'APPROVED' && row.total ? row.total.toFixed(2) : sumAmounts([...row.lines.map((l) => l.amount.toFixed(2)), ...row.corrections.map((c) => c.amount.toFixed(2))]);

export function sheetView(row: SheetRow, names: SheetNames, holder: { id: string; name: string } | null): SheetView {
  const rate = row.rate.toFixed(2);
  const user = (id: string | null) => (id && names.users.get(id) ? { id, ...names.users.get(id)! } : null);
  return {
    id: row.id,
    number: row.number !== null ? cpsNumber(row.number) : null,
    date: fromDateColumn(row.workDate),
    siteId: row.siteId,
    siteName: names.siteName,
    departmentId: row.departmentId,
    departmentName: names.departmentName,
    status: row.status,
    version: row.version,
    rate,
    rateVersion: row.rateVersion,
    noRate: false,
    lines: row.lines.map((l) => lineView(l, rate)),
    corrections: row.corrections.map(correctionView),
    total: sheetTotal(row),
    sentBackReason: row.sentBackReason,
    recordedBy: user(row.recordedById),
    approvedBy: user(row.approvedById),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    cashHolder: holder,
    voidReason: row.voidReason,
    waitingForCash: row.status === 'APPROVED' ? row.lines.filter((l) => l.receivedAt === null).length : 0,
  };
}

/** A day with no sheet yet: the shape the head's screen starts from (or "No daily rate" when Rules have none). */
export function emptySheetView(args: { date: NairobiDate; siteId: string; siteName: string; departmentId: string; departmentName: string; rate: string | null; rateVersion: number | null }): SheetView {
  return {
    id: null, number: null, date: args.date, siteId: args.siteId, siteName: args.siteName, departmentId: args.departmentId, departmentName: args.departmentName,
    status: 'NONE', version: 0, rate: args.rate, rateVersion: args.rateVersion, noRate: args.rate === null, lines: [], corrections: [], total: formatCents(0n),
    sentBackReason: null, recordedBy: null, approvedBy: null, approvedAt: null, cashHolder: null, voidReason: null, waitingForCash: 0,
  };
}

/** The total a row of "Waiting for you" shows: lines plus corrections. */
export const listTotal = (row: { lines: { amount: { toFixed(n: number): string } }[]; corrections: { amount: { toFixed(n: number): string } }[] }): string =>
  formatCents([...row.lines, ...row.corrections].reduce((sum, l) => sum + parseCents(l.amount.toFixed(2)), 0n));
