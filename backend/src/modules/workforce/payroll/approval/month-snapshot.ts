import { hashInputs } from '../engine/month-totals';

/** The filing numbers of a person, frozen with the payslip so the statutory schedules never read the live record. */
export interface StatutoryIds {
  kraPin: string | null;
  nssfNumber: string | null;
  shaNumber: string | null;
}

export interface SnapshotPayslip {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  siteId: string;
  siteName: string;
  department: string | null;
  basic: string;
  gross: string;
  statutoryEmployee: string;
  incomeTax: string;
  otherDeductions: string;
  net: string;
  employerShare: string;
  taxablePay: string;
  /** Segment 2B additions. A revision 1 written by part 1 has none of these, so readers treat them as optional. */
  overtimePay?: string;
  payoutMethod?: string | null;
  version?: number;
  ids?: StatutoryIds | null;
  lines: { code: string; label: string; kind: string; amount: string; workingText: string; tableCode: string | null; share: string | null }[];
}

export interface MonthSnapshot {
  version: 1;
  monthKey: string;
  documentNumber: string;
  runNumber: number;
  approvedAt: string;
  approvedBy: { id: string; name: string } | null;
  preparedBy: { id: string; name: string }[];
  tablesVersion: number | null;
  sites: { siteId: string; name: string; timesheetNumber: string }[];
  rulesUsed: unknown;
  totals: { headcount: number; gross: string; taxStatutory: string; other: string; net: string };
  payslips: SnapshotPayslip[];
  /** Revision 2 and later: a correction after approval. Revision 1 is the approval itself and carries neither. */
  revision?: number;
  corrections?: { employeeId: string; version: number; reason: string; correctedById: string; at: string }[];
}

type Money = { toFixed(places: number): string };
export interface SlipRow {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  siteId: string;
  siteName: string;
  department: string | null;
  version: number;
  payoutMethod: string | null;
  basic: Money;
  gross: Money;
  statutoryEmployee: Money;
  incomeTax: Money;
  otherDeductions: Money;
  net: Money;
  employerShare: Money;
  taxablePay: Money;
  overtimePay: Money;
  lines: { code: string; label: string; kind: string; amount: Money; workingText: string; tableCode: string | null; share: string | null }[];
}

/** One stored payslip (any version) as the snapshot and the exports hold it: money as text with 2 decimals. */
export const toSnapshotPayslip = (p: SlipRow, ids: StatutoryIds | null): SnapshotPayslip => ({
  employeeId: p.employeeId, employeeName: p.employeeName, employeeNumber: p.employeeNumber, siteId: p.siteId, siteName: p.siteName, department: p.department,
  basic: p.basic.toFixed(2), gross: p.gross.toFixed(2), statutoryEmployee: p.statutoryEmployee.toFixed(2), incomeTax: p.incomeTax.toFixed(2), otherDeductions: p.otherDeductions.toFixed(2),
  net: p.net.toFixed(2), employerShare: p.employerShare.toFixed(2), taxablePay: p.taxablePay.toFixed(2), overtimePay: p.overtimePay.toFixed(2), payoutMethod: p.payoutMethod, version: p.version, ids,
  lines: p.lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount.toFixed(2), workingText: l.workingText, tableCode: l.tableCode, share: l.share })),
});

/** The hash is over the whole snapshot with sorted keys, so the same month always gives the same hash and any edit shows. */
export const hashSnapshot = (snapshot: MonthSnapshot): string => hashInputs(snapshot);
