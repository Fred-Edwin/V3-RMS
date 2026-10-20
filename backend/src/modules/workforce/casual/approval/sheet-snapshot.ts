import { createHash } from 'node:crypto';
import { fromDateColumn } from '../../_shared/time/nairobi-time';
import type { SheetSnapshot } from '../casual.types';
import type { SheetRow } from '../sheet/sheet-repository';
import { cpsNumber, maskId, sheetTotal } from '../sheet/sheet-view';

export interface SnapshotPeople {
  recordedBy: { id: string; name: string; role: string };
  approvedBy: { id: string; name: string; role: string };
  cashHolder: { id: string; name: string };
  siteName: string;
  departmentName: string;
}

/** The frozen sheet (PD16). Built in one place, from the stored rows, so the hash can be checked later. */
export function buildSnapshot(row: SheetRow, number: number, people: SnapshotPeople, signedAt: Date): SheetSnapshot {
  return {
    version: 1,
    number: cpsNumber(number),
    date: fromDateColumn(row.workDate),
    site: { id: row.siteId, name: people.siteName },
    department: { id: row.departmentId, name: people.departmentName },
    rate: row.rate.toFixed(2),
    rateVersion: row.rateVersion,
    recordedBy: people.recordedBy,
    approvedBy: { ...people.approvedBy, signedAt: signedAt.toISOString() },
    cashHolder: people.cashHolder,
    lines: row.lines.map((l) => ({ lineId: l.id, casualId: l.workerId, name: l.worker.fullName, idMasked: maskId(l.worker.nationalId), startMinute: l.startMinute, endMinute: l.endMinute, minutes: l.minutes, amount: l.amount.toFixed(2) })),
    corrections: row.corrections.map((c) => ({ id: c.id, casualId: c.workerId, name: c.worker.fullName, originalDate: fromDateColumn(c.originalDate), amount: c.amount.toFixed(2), reason: c.reason })),
    total: sheetTotal({ ...row, status: 'SENT', total: null }),
  };
}

export const hashSnapshot = (snapshot: SheetSnapshot): string => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

/** The QR carries the first 10 characters of the hash (PD17); the verify page shows number and status, never a name or a figure. */
export const verifyPath = (number: string, hash: string): string => `/verify/cps/${number}?h=${hash.slice(0, 10)}`;
