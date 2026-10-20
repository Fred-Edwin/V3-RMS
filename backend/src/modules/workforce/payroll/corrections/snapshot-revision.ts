import type { Payslip } from '../engine/engine.types';
import { formatCents, parseCents, sumCents } from '../engine/money';
import type { MonthSnapshot, SnapshotPayslip } from '../approval/month-snapshot';

export interface CorrectedPerson {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  siteId: string;
  siteName: string;
  department: string | null;
  payoutMethod: string | null;
  version: number;
}

/** The corrected payslip in the shape the snapshot holds. The filing numbers stay as they were frozen at approval. */
export function snapshotPayslipOf(person: CorrectedPerson, slip: Payslip, previous: SnapshotPayslip | undefined): SnapshotPayslip {
  return {
    employeeId: person.employeeId, employeeName: person.employeeName, employeeNumber: person.employeeNumber, siteId: person.siteId, siteName: person.siteName, department: person.department,
    basic: slip.basic, gross: slip.gross, statutoryEmployee: slip.statutoryEmployee, incomeTax: slip.incomeTax, otherDeductions: slip.otherDeductions, net: slip.net, employerShare: slip.employerShare, taxablePay: slip.taxablePay,
    overtimePay: slip.overtimePay, payoutMethod: person.payoutMethod, version: person.version, ids: previous?.ids ?? null,
    lines: slip.lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount, workingText: l.workingText, tableCode: l.tableCode, share: l.share })),
  };
}

const sum = (rows: readonly SnapshotPayslip[], pick: (p: SnapshotPayslip) => string): string => formatCents(sumCents(rows.map((p) => parseCents(pick(p)))));

/**
 * E8: a correction after approval adds revision r+1 of the snapshot and keeps r. Everything is copied from the earlier revision except
 * the one payslip, the totals (summed again from the current payslips) and the list of corrections. The approval signature stays on
 * revision 1: `approvedAt` and `approvedBy` are carried over untouched, and so is the document number.
 */
export function nextRevision(previous: MonthSnapshot, corrected: SnapshotPayslip, correction: { reason: string; correctedById: string; at: string }): MonthSnapshot {
  const payslips = previous.payslips.map((p) => (p.employeeId === corrected.employeeId ? corrected : p));
  return {
    ...previous,
    revision: (previous.revision ?? 1) + 1,
    corrections: [...(previous.corrections ?? []), { employeeId: corrected.employeeId, version: corrected.version ?? 2, ...correction }],
    totals: { headcount: payslips.length, gross: sum(payslips, (p) => p.gross), taxStatutory: sum(payslips, (p) => p.statutoryEmployee), other: sum(payslips, (p) => p.otherDeductions), net: sum(payslips, (p) => p.net) },
    payslips,
  };
}
