import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayrollModel } from '../../payroll/exports/export-model';
import type { SnapshotPayslip } from '../../payroll/approval/month-snapshot';
import type { PayslipData } from '../../payslips/reads/payslip-model';
import type { EmployeeFacts } from '../../payslips/reads/reads-repository';

/** The QR each payslip renderer prints is the same `?h=` the Signed documents index stores (6c X4): captured from the real renderers. */
const qrUrls: string[] = [];
vi.mock('../../timesheets/exports/pdf-draw', async (original) => ({
  ...(await original<typeof import('../../timesheets/exports/pdf-draw')>()),
  drawQr: (_doc: unknown, url: string) => void qrUrls.push(url),
}));

const NUMBER = 'PS-0987';
const MONTH = '2026-09';
const lines = [
  { code: 'BASIC', label: 'Basic pay', kind: 'EARNING' as const, amount: '30000.00', share: null, taxable: true, workingText: 'Monthly rate', baseAmount: null, bandsUsed: null },
  { code: 'PAYE', label: 'Income tax', kind: 'STATUTORY' as const, amount: '2500.00', share: 'EMPLOYEE', taxable: false, workingText: 'Bands', baseAmount: null, bandsUsed: null },
];
const stored: PayslipData = { id: 'p1', monthKey: MONTH, version: 1, number: NUMBER, gross: '30000.00', net: '27500.00', taxablePay: '30000.00', incomeTax: '2500.00', correctedAt: null, lines };
const employee: EmployeeFacts = {
  id: 'e1', companyId: 'c1', siteId: 's1', userId: null, name: 'Test Person', employeeNumber: 'E-1', startDate: new Date('2026-01-01'), exitedOn: null,
  kraPin: null, nssfNumber: null, shaNumber: null, position: 'Barista', siteName: 'Nyeri Town', payoutMethod: 'CASH', bankName: null, accountNumber: null,
} as EmployeeFacts;

beforeEach(() => {
  qrUrls.length = 0;
});

describe('the QR of both payslip renderers matches the hash the index stores', () => {
  it('the person\'s own file prints the first 10 characters of the one payslip hash', async () => {
    const { payslipContentHash, hashPrefixOf } = await import('./qr-hash');
    const { buildPayslipDoc } = await import('../../payslips/documents/document-model');
    const { renderPayslipPdf } = await import('../../payslips/documents/payslip-pdf');
    const indexHash = payslipContentHash({ number: NUMBER, version: 1, monthKey: MONTH, gross: stored.gross, net: stored.net, lines: stored.lines });
    const model = buildPayslipDoc({ variant: 'ORIGINAL', siteName: 'Nyeri Town', payDay: null, employee, department: null, data: stored, previous: null, earlierMonths: [], replacedBy: null, previousAt: null, signer: { name: 'Anne', role: 'ACCOUNTANT', at: new Date('2026-10-01T08:00:00Z') }, created: new Date('2026-10-01T08:00:00Z') });
    expect(model.hashPrefix).toBe(hashPrefixOf(indexHash));
    await renderPayslipPdf(model);
    expect(qrUrls).toHaveLength(1);
    expect(new URL(qrUrls[0]!).searchParams.get('h')).toBe(hashPrefixOf(indexHash));
    expect(qrUrls[0]).toContain(`/verify/ps/${NUMBER}?h=`);
  });

  it("the month's export prints the same prefix for the same payslip", async () => {
    const { payslipContentHash, hashPrefixOf } = await import('./qr-hash');
    const { renderPayslip } = await import('../../payroll/exports/render/payslip-pdf');
    const indexHash = payslipContentHash({ number: NUMBER, version: 1, monthKey: MONTH, gross: stored.gross, net: stored.net, lines: stored.lines });
    const snapshot = {
      employeeId: 'e1', employeeName: 'Test Person', employeeNumber: 'E-1', siteId: 's1', siteName: 'Nyeri Town', department: null, basic: '30000.00', gross: stored.gross,
      statutoryEmployee: '2500.00', incomeTax: '2500.00', otherDeductions: '0.00', net: stored.net, employerShare: '0.00', taxablePay: '30000.00', version: 1,
      lines: lines.map((l) => ({ code: l.code, label: l.label, kind: l.kind, amount: l.amount, workingText: l.workingText, tableCode: null, share: l.share })),
    } as SnapshotPayslip;
    // Only the fields this renderer reads; the rest of a payroll model is not part of one payslip.
    const model = {
      monthKey: MONTH, monthLabel: 'September 2026', exportedAt: new Date('2026-10-01T08:00:00Z'), numbers: new Map([['e1', NUMBER]]), correctedAt: new Map(),
      approved: { name: 'Anne', role: 'ACCOUNTANT', at: new Date('2026-10-01T08:00:00Z') }, documentNumber: 'PAY-2026-09', hashPrefix: 'abcdef0123',
    } as unknown as PayrollModel;
    await renderPayslip(model, snapshot);
    expect(qrUrls).toHaveLength(1);
    expect(new URL(qrUrls[0]!).searchParams.get('h')).toBe(hashPrefixOf(indexHash));
    expect(qrUrls[0]).toContain(`/verify/ps/${NUMBER}?h=`);
  });

  it('a corrected version has its own prefix, so a copy of version 1 reads "replaced"', async () => {
    const { payslipContentHash, hashPrefixOf } = await import('./qr-hash');
    const v1 = hashPrefixOf(payslipContentHash({ number: NUMBER, version: 1, monthKey: MONTH, gross: '30000.00', net: '27500.00', lines }));
    const v2 = hashPrefixOf(payslipContentHash({ number: NUMBER, version: 2, monthKey: MONTH, gross: '30000.00', net: '27500.00', lines }));
    expect(v1).not.toBe(v2);
  });
});
