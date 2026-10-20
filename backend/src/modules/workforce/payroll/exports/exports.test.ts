import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { SnapshotPayslip } from '../approval/month-snapshot';
import { exportBody } from './exports-validators';
import { fileNameOf, groupByDepartment, registerPerson, tableKeyOf, type PayrollModel, type TableColumn } from './export-model';
import { renderPayslip, maskId } from './render/payslip-pdf';
import { registerCell, registerColumns } from './render/register-layout';
import { planRegister, renderRegisterPdf } from './render/register-pdf';
import { renderStatutory } from './render/statutory-xlsx';
import { renderSummaryPdf } from './render/summary-pdf';
import { bannerOf, renderWorkbook } from './render/workbook-xlsx';
import { safeEntryName, zipStore } from './render/zip';

const TABLES: TableColumn[] = [
  { key: 'NSSF', name: 'Alpha', isIncomeTax: false },
  { key: 'SHA', name: 'Beta', isIncomeTax: false },
  { key: 'PAYE', name: 'Gamma', isIncomeTax: true },
];

const line = (code: string, amount: string, over: Partial<SnapshotPayslip['lines'][number]> = {}): SnapshotPayslip['lines'][number] => ({ code, label: code, kind: 'EARNING', amount, workingText: `${code} working`, tableCode: null, share: null, ...over });
const slip = (n: number, department: string, over: Partial<SnapshotPayslip> = {}): SnapshotPayslip => ({
  employeeId: `e${n}`, employeeName: `Person ${String(n).padStart(3, '0')}`, employeeNumber: `W-${n}`, siteId: 's1', siteName: n % 2 ? 'Nyeri Town' : 'Nyeri Highway', department,
  basic: '30000.00', gross: '31000.00', statutoryEmployee: '3100.50', incomeTax: '1000.25', otherDeductions: '200.00', net: '27699.50', employerShare: '1860.00', taxablePay: '28000.00', overtimePay: '1000.00', payoutMethod: 'BANK', version: 1,
  ids: { kraPin: 'A001234567Z', nssfNumber: '123456', shaNumber: '98765' },
  lines: [
    line('BASIC', '30000.00'), line('OVERTIME_ORDINARY', '1000.00'),
    line('NSSF', '1800.00', { kind: 'STATUTORY', tableCode: 'NSSF', share: 'EMPLOYEE', baseAmount: '30000.00', rate: '6%' }),
    line('NSSF', '1800.00', { kind: 'MEMO', tableCode: 'NSSF', share: 'EMPLOYER' }),
    line('SHA', '300.25', { kind: 'STATUTORY', tableCode: 'SHA', share: 'EMPLOYEE' }),
    line('PAYE', '1000.25', { kind: 'STATUTORY', tableCode: 'PAYE', share: 'EMPLOYEE' }),
  ],
  ...over,
});

const model = (over: Partial<PayrollModel> = {}, count = 5): PayrollModel => {
  const payslips = Array.from({ length: count }, (_, i) => slip(i + 1, i % 3 === 0 ? 'Barista' : i % 3 === 1 ? 'Kitchen' : 'Service'));
  return {
    monthKey: '2026-09', monthLabel: 'September 2026', start: '2026-09-01', end: '2026-09-30', draft: false, stamp: 'APPROVED · PUBLISHED', documentNumber: 'PAY-2026-09', revision: 1, corrections: 0, hashPrefix: 'abcdef0123',
    qrUrl: 'https://example.test/verify/pay/PAY-2026-09?h=abcdef0123', exportedAt: new Date('2026-10-21T09:00:00Z'), exportedBy: { name: 'Anne Muthoni', role: 'ACCOUNTANT' },
    approved: { name: 'Anne Muthoni', role: 'ACCOUNTANT', at: new Date('2026-10-19T11:10:00Z') }, prepared: ['Esther Mwende'], reviewed: { name: 'Esther Mwende', role: 'HR_MANAGER', at: new Date('2026-10-19T10:00:00Z') },
    calculated: { at: new Date('2026-10-18T10:00:00Z'), run: 1 }, published: { name: 'Esther Mwende', role: 'HR_MANAGER', at: new Date('2026-10-19T12:00:00Z') }, paid: null,
    timesheets: [{ site: 'Nyeri Town', number: 'TSH-0001' }], tables: TABLES, tablesNote: { version: 2, by: 'Anne Muthoni', at: new Date('2026-10-01T08:00:00Z') },
    rules: { overtime: ['Ordinary day 1.5 ×'], lateness: ['Recorded only'], absence: ['Unpaid day = basic ÷ 30'] },
    totals: { headcount: count, gross: '155000.00', taxStatutory: '15502.50', other: '1000.00', net: '138497.50', employerShare: '9300.00' },
    bySite: [{ name: 'Nyeri Highway', people: 2, gross: '62000.00', taxStatutory: '6201.00', other: '400.00', net: '55399.00' }, { name: 'Nyeri Town', people: 3, gross: '93000.00', taxStatutory: '9301.50', other: '600.00', net: '83098.50' }],
    people: payslips.map((p) => registerPerson(p, TABLES)), payslips, numbers: new Map(payslips.map((p, i) => [p.employeeId, `PS-${String(900 + i).padStart(4, '0')}`])), correctedAt: new Map(),
    leftOut: [{ name: 'Left Person', siteName: 'Nyeri Town' }], bank: null, ...over,
  };
};

describe('the register rows', () => {
  it('gets a column per statutory table from the frozen lines, summing the employee share only', () => {
    const p = registerPerson(slip(1, 'Barista'), TABLES);
    expect(p.tables).toEqual({ NSSF: '1800.00', SHA: '300.25', PAYE: '1000.25' });
    expect(p.overtime).toBe('1000.00');
  });

  it('keeps the OTHER table key the engine writes', () => {
    expect(tableKeyOf({ code: 'OTHER', name: 'Union Dues' })).toBe('OTHER:union dues');
    expect(tableKeyOf({ code: 'PAYE', name: 'Gamma' })).toBe('PAYE');
  });

  it('groups departments A to Z and people A to Z', () => {
    const groups = groupByDepartment(model({}, 7).people);
    expect(groups.map((g) => g.department)).toEqual(['Barista', 'Kitchen', 'Service']);
    const names = groups[0]!.people.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('the register columns', () => {
  const total = (cols: ReturnType<typeof registerColumns>): number => cols.reduce((n, c) => n + c.w, 0);

  it('generates one column per table in the Accountant order and always fills the page', () => {
    const cols = registerColumns(TABLES, 760.89);
    expect(cols.map((c) => c.label)).toEqual(['PERSON', 'SITE', 'BASIC', 'OVERTIME', 'GROSS', 'ALPHA', 'BETA', 'GAMMA', 'OTHER', 'NET PAY']);
    expect(total(cols)).toBeCloseTo(760.89, 5);
  });

  it('folds tables beyond seven into one column instead of shrinking the type', () => {
    const many = Array.from({ length: 10 }, (_, i): TableColumn => ({ key: `T${i}`, name: `Table ${i}`, isIncomeTax: false }));
    const cols = registerColumns(many, 760.89);
    const tableCols = cols.filter((c) => c.tableKeys);
    expect(tableCols).toHaveLength(7);
    expect(tableCols[6]).toMatchObject({ label: 'OTHER STATUTORY', tableKeys: ['T6', 'T7', 'T8', 'T9'] });
    expect(total(cols)).toBeCloseTo(760.89, 5);
    expect(Math.min(...tableCols.map((c) => c.w))).toBeGreaterThanOrEqual(39.99);
  });

  it('works with no tables at all', () => {
    expect(total(registerColumns([], 760.89))).toBeCloseTo(760.89, 5);
  });

  it('shows whole shillings, and a folded column adds its tables', () => {
    const many = Array.from({ length: 9 }, (_, i): TableColumn => ({ key: `T${i}`, name: `T${i}`, isIncomeTax: false }));
    const p = { ...registerPerson(slip(1, 'Barista'), many), tables: Object.fromEntries(many.map((t) => [t.key, '100.50'])) };
    const cols = registerColumns(many, 760.89);
    expect(registerCell(cols.find((c) => c.key === 'gross')!, p)).toBe('31,000');
    expect(registerCell(cols.find((c) => c.label === 'OTHER STATUTORY')!, p)).toBe('302');
  });
});

describe('the register page plan', () => {
  it('puts whole departments on page 1 up to 20 people and the closing block on the last page', () => {
    const pages = planRegister(model({}, 24));
    expect(pages[0]!.bands.reduce((n, b) => n + b.people.length, 0)).toBeLessThanOrEqual(20);
    expect(pages.filter((p) => p.rulesAndSignature)).toHaveLength(1);
    expect(pages[pages.length - 1]!.rulesAndSignature).toBe(true);
  });

  it('gives the closing block a page of its own when it does not fit under the last rows', () => {
    const crowded = model({ bySite: Array.from({ length: 30 }, (_, i) => ({ name: `Site ${i}`, people: 1, gross: '1.00', taxStatutory: '0.00', other: '0.00', net: '1.00' })) }, 26);
    const pages = planRegister(crowded);
    expect(pages[pages.length - 1]!.bands).toHaveLength(0);
    expect(pages[pages.length - 1]!.rulesAndSignature).toBe(true);
  });
});

describe('the PDFs', () => {
  it('make real PDFs, the same bytes every time for the same month', async () => {
    const a = await renderRegisterPdf(model());
    const b = await renderRegisterPdf(model());
    expect(a.subarray(0, 5).toString()).toBe('%PDF-');
    expect(a.equals(b)).toBe(true);
  });

  it('a draft differs from an approved month (stamp, watermark, no signature)', async () => {
    const draft = await renderRegisterPdf(model({ draft: true, stamp: 'DRAFT · NOT APPROVED', documentNumber: null, qrUrl: null, approved: null, published: null }));
    const final = await renderRegisterPdf(model());
    expect(draft.equals(final)).toBe(false);
  });

  it('the summary is one page however many sites and tables there are', async () => {
    const many = Array.from({ length: 12 }, (_, i): TableColumn => ({ key: `T${i}`, name: `Table ${i}`, isIncomeTax: false }));
    const big = model({ tables: many, bySite: Array.from({ length: 14 }, (_, i) => ({ name: `Site ${i}`, people: 1, gross: '1.00', taxStatutory: '0.00', other: '0.00', net: '1.00' })) });
    const pdf = (await renderSummaryPdf(big)).toString('latin1');
    expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('a payslip is one A4 page and a corrected one is a different file', async () => {
    const m = model();
    const p = m.payslips[0]!;
    const one = await renderPayslip(m, p);
    expect(one.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
    const two = await renderPayslip({ ...m, correctedAt: new Map([[p.employeeId, new Date('2026-10-22T08:00:00Z')]]) }, { ...p, version: 2 });
    expect(two.equals(one)).toBe(false);
  });

  it('masks filing numbers', () => {
    expect(maskId('A001234567Z')).toBe('••••••••567'.replace('567', '67Z'));
    expect(maskId(null)).toBe('—');
  });
});

describe('the workbooks', () => {
  const open = async (buffer: Buffer): Promise<ExcelJS.Workbook> => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb;
  };

  it('the register workbook has four sheets, and five with the bank sheet for the Accountant', async () => {
    const four = await open(await renderWorkbook(model()));
    expect(four.worksheets.map((w) => w.name)).toEqual(['Summary', 'Register', 'Statutory', 'Casual pay']);
    const bank = { header: ['Reference', 'Account name', 'Bank name', 'Branch', 'Account number', 'Amount', 'Currency', 'Narration', 'Employee number'], rows: [['PS-0900', 'A', 'B', 'C', '123', '27699.50', 'KES', 'n', 'W-1']] };
    const five = await open(await renderWorkbook(model({ bank })));
    expect(five.worksheets.map((w) => w.name)).toEqual(['Summary', 'Register', 'Statutory', 'Casual pay', 'Bank file']);
  });

  it('the register has a column per table, real numbers, a live SUM total, a frozen header and filters', async () => {
    const ws = (await open(await renderWorkbook(model()))).getWorksheet('Register')!;
    expect(ws.getRow(2).values).toEqual([undefined, 'Person', 'Department', 'Site', 'Basic', 'Overtime', 'Gross', 'Alpha', 'Beta', 'Gamma', 'Other deductions', 'Net pay']);
    expect(ws.getCell('D3').value).toBe(30000);
    const total = ws.getRow(8);
    expect((total.getCell(4).value as { formula: string }).formula).toBe('SUM(D3:D7)');
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 2 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it('the banner says draft or the approved document', async () => {
    expect(bannerOf(model({ draft: true, documentNumber: null, approved: null }))).toBe('Working copy, draft, not approved');
    expect(bannerOf(model())).toBe('Working copy of PAY-2026-09, approved 19 October 2026');
    expect(bannerOf(model({ revision: 2, corrections: 1 }))).toContain('Revision 2, includes 1 correction after approval');
  });

  it('the statutory schedules have an index and a sheet per table with the filing numbers', async () => {
    const wb = await open(await renderStatutory(model()));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Index', 'Alpha', 'Beta', 'Gamma']);
    expect(wb.getWorksheet('Alpha')!.getCell('C3').value).toBe('A001234567Z');
  });
});

describe('the zip', () => {
  it('is a readable archive of the files, with a correct size and CRC', () => {
    const zip = zipStore([{ name: 'a.pdf', data: Buffer.from('hello') }, { name: 'b.pdf', data: Buffer.from('world!') }]);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
    expect(zip.readUInt32LE(14)).toBe(0x3610a686); // CRC-32 of "hello"
    expect(zip.readUInt32LE(18)).toBe(5);
  });

  it('keeps names plain and unique', () => {
    expect(safeEntryName('../../etc/passwd')).toBe('..-..-etc-passwd'.replace(/^\.+/, ''));
    const zip = zipStore([{ name: 'x.pdf', data: Buffer.from('1') }, { name: 'x.pdf', data: Buffer.from('2') }]);
    const text = zip.toString('latin1');
    expect(text).toContain('x.pdf');
    expect(text).toContain('2-x.pdf');
  });
});

describe('export requests and file names', () => {
  it('a file kind only takes its own formats', () => {
    const base = { idempotencyKey: 'key-12345678' };
    expect(exportBody.safeParse({ ...base, kind: 'REGISTER', format: 'xlsx' }).success).toBe(true);
    expect(exportBody.safeParse({ ...base, kind: 'SUMMARY', format: 'xlsx' }).success).toBe(false);
    expect(exportBody.safeParse({ ...base, kind: 'PAYSLIPS', format: 'zip' }).success).toBe(true);
    expect(exportBody.safeParse({ ...base, kind: 'PAYSLIPS', format: 'pdf' }).success).toBe(false);
    expect(exportBody.safeParse({ ...base, kind: 'STATUTORY', format: 'xlsx', extra: 1 }).success).toBe(false);
    expect(exportBody.safeParse({ kind: 'STATUTORY', format: 'xlsx', idempotencyKey: 'short' }).success).toBe(false);
  });

  it('names the files as the spec says', () => {
    expect(fileNameOf('REGISTER', 'pdf', '2026-09')).toBe('Payroll-register-2026-09.pdf');
    expect(fileNameOf('REGISTER', 'xlsx', '2026-09')).toBe('Payroll-2026-09.xlsx');
    expect(fileNameOf('SUMMARY', 'pdf', '2026-09')).toBe('Payroll-summary-2026-09.pdf');
    expect(fileNameOf('STATUTORY', 'xlsx', '2026-09')).toBe('Statutory-2026-09.xlsx');
    expect(fileNameOf('PAYSLIPS', 'zip', '2026-09')).toBe('Payslips-2026-09.zip');
  });
});
