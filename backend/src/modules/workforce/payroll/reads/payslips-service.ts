import { z } from 'zod';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import type { AccessSubject } from '../../_shared/workforce-access';
import { payrollActor, requireMonth } from '../payroll-context';
import { readsRepository } from './reads-repository';

export const payslipsQuery = z
  .object({
    q: z.string().trim().max(80).optional(),
    siteId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    rows: z.coerce.number().int().refine((n) => [25, 50, 100].includes(n), 'Rows per page is 25, 50 or 100').default(50),
  })
  .strict();
export type PayslipsQuery = z.infer<typeof payslipsQuery>;

async function current(subject: AccessSubject, monthKey: string) {
  const ctx = await payrollActor(subject, 'payroll.read');
  const month = await requireMonth(ctx.companyId, monthKey);
  if (month.state === 'WAITING' || !month.currentRunId) throw new ConflictError('Available once the month is calculated.', 'TAB_NOT_AVAILABLE', { state: month.state });
  return { month, runId: month.currentRunId };
}

/** The Payslips tab: the month's current payslips, server paged, plus the people HR left out. A draft is visible to payroll readers only. */
export async function listPayslips(subject: AccessSubject, monthKey: string, query: PayslipsQuery) {
  const { month, runId } = await current(subject, monthKey);
  const { rows, total } = await readsRepository.payslips(runId, { q: query.q, siteId: query.siteId }, (query.page - 1) * query.rows, query.rows);
  const leftOut = query.page === 1 ? (await readsRepository.leftOutLines(runId)).filter((l) => (!query.siteId || l.siteId === query.siteId) && (!query.q || l.employeeName.toLowerCase().includes(query.q.toLowerCase()))) : [];
  return {
    monthKey,
    state: month.state,
    rows: rows.map((p) => ({ payslipId: p.id, employeeId: p.employeeId, name: p.employeeName, siteId: p.siteId, siteName: p.siteName, department: p.department, net: p.net.toFixed(2), version: p.version, status: p.status, documentNumber: p.documentNumber, corrected: p.version > 1, leftOut: false })),
    leftOut: leftOut.map((l) => ({ employeeId: l.employeeId, name: l.employeeName, siteId: l.siteId, siteName: l.siteName, leftOut: true, status: 'Left out of run', net: null })),
    page: query.page,
    pageSize: query.rows,
    total,
  };
}

/** One payslip with every line and its working (the "Check one person by hand" drawer and the payslip view). */
export async function payslipDetail(subject: AccessSubject, monthKey: string, payslipId: string) {
  const { month, runId } = await current(subject, monthKey);
  const p = await readsRepository.payslip(runId, payslipId);
  if (!p) throw new NotFoundError('That payslip is not in this month', 'NO_PAYSLIP');
  return {
    payslipId: p.id,
    monthKey,
    state: month.state,
    version: p.version,
    status: p.status,
    documentNumber: p.documentNumber,
    published: false,
    employee: { employeeId: p.employeeId, name: p.employeeName, employeeNumber: p.employeeNumber, department: p.department, siteName: p.siteName, payoutMethod: p.payoutMethod },
    totals: { basic: p.basic.toFixed(2), gross: p.gross.toFixed(2), statutory: p.statutoryEmployee.toFixed(2), incomeTax: p.incomeTax.toFixed(2), otherDeductions: p.otherDeductions.toFixed(2), net: p.net.toFixed(2), employerShare: p.employerShare.toFixed(2), taxablePay: p.taxablePay.toFixed(2) },
    lines: p.lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount.toFixed(2), taxable: l.taxable, base: l.base, baseAmount: l.baseAmount?.toFixed(2) ?? null, rate: l.rate, quantity: l.quantity, unit: l.unit, source: l.source, workingText: l.workingText, share: l.share })),
  };
}
