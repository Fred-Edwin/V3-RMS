import { hashInputs } from '../engine/month-totals';

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
}

/** The hash is over the whole snapshot with sorted keys, so the same month always gives the same hash and any edit shows. */
export const hashSnapshot = (snapshot: MonthSnapshot): string => hashInputs(snapshot);
