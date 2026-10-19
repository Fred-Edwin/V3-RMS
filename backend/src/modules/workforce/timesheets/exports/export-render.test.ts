import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { SnapshotPerson } from '../approval/snapshot';
import { bandOvertime, cellHours, clockOf, dayCell, headingHours, lateCell, longStamp, rangeWords } from './export-format';
import { fileNameOf, groupByDepartment, type ExportModel } from './export-model';
import { planPages } from './export-plan';
import { renderPdf } from './pdf-render';
import { signedName } from './signature-font';
import { renderXlsx } from './xlsx-render';

const faith = { name: 'Faith Njeri', role: 'MANAGER' };
const person = (i: number, department: string): SnapshotPerson => ({
  employeeId: `e${i}`,
  name: `Person ${String(i).padStart(3, '0')}`,
  department,
  plannedMinutes: 176 * 60,
  workedMinutes: 177 * 60 + 5,
  overtimeMinutes: 35,
  overtimeAuthorisedMinutes: i % 2 === 0 ? 35 : 0,
  lateMinutes: i % 3 === 0 ? 5 : 0,
  lateDays: i % 3 === 0 ? 1 : 0,
  absentDays: 0,
  leaveDays: 0,
  decided: [{ code: 'MATCHES_ROTA' }],
});
const model = (n: number, extra: Partial<ExportModel> = {}): ExportModel => {
  const departments = ['Barista', 'Kitchen', 'Pastry', 'Service'];
  const people = Array.from({ length: n }, (_, i) => person(i, departments[i % 4]!));
  return {
    siteName: 'Nyeri Town',
    monthKey: '2026-09',
    monthLabel: 'September 2026',
    start: '2026-09-01' as never,
    end: '2026-09-30' as never,
    draft: false,
    documentNumber: 'TSH-0009',
    hashPrefix: 'abcdef0123',
    approvedAt: new Date('2026-10-01T08:42:00Z'),
    approvedBy: faith,
    scopeNote: null,
    fileSuffix: '',
    totals: { people: n, plannedMinutes: n * 176 * 60, workedMinutes: n * (177 * 60 + 5), overtimeRecordedMinutes: n * 35, overtimeApprovedMinutes: Math.ceil(n / 2) * 35, overtimePartNotApprovedMinutes: 0, overtimeToDecideMinutes: 0, lateCount: Math.ceil(n / 3), lateMinutes: Math.ceil(n / 3) * 5, absentDays: 0 },
    people,
    rules: [
      { key: 'OVERTIME', version: 2, siteVersion: null, effectiveFrom: '2026-01-01' as never, facts: { serviceTailMinutes: 20, weeklyCapMinutes: 2880 } },
      { key: 'LATENESS', version: 1, siteVersion: null, effectiveFrom: null, facts: { graceMinutes: 5, policy: 'RECORD_ONLY', afterLatesPerMonth: null } },
    ],
    exportedBy: faith,
    exportedAt: new Date('2026-10-01T08:45:00Z'),
    qrUrl: 'https://app.example/verify/tsh/TSH-0009?h=abcdef0123',
    daily: [],
    ...extra,
  };
};
const pageCount = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('the PDF', () => {
  it('is a PDF with one page for each page in the plan', async () => {
    for (const n of [3, 31, 100]) {
      const m = model(n);
      const pdf = await renderPdf(m);
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pageCount(pdf)).toBe(planPages(groupByDepartment(m.people)).length);
    }
  });
  it('a month of 31 people takes two pages, like Paper', async () => {
    expect(pageCount(await renderPdf(model(31)))).toBe(2);
  });
  it('is A4 landscape (841.89 x 595.28 pt)', async () => {
    expect((await renderPdf(model(3))).toString('latin1')).toContain('/MediaBox [0 0 841.89 595.28]');
  });
  it('the same approved month exported twice is the same bytes', async () => {
    const a = await renderPdf(model(31));
    const b = await renderPdf(model(31));
    expect(Buffer.compare(a, b)).toBe(0);
  });
  it('a draft is not the signed file: different bytes, no QR to draw', async () => {
    const signed = await renderPdf(model(31));
    const draft = await renderPdf(model(31, { draft: true, documentNumber: null, hashPrefix: null, approvedAt: null, approvedBy: null, qrUrl: null }));
    expect(Buffer.compare(signed, draft)).not.toBe(0);
    expect(pageCount(draft)).toBe(pageCount(signed));
  });
  it('draws the signature in Alex Brush on a signed file, and a draft has no signature font', async () => {
    const signed = (await renderPdf(model(3))).toString('latin1');
    expect(signed).toContain('AlexBrush');
    const draft = (await renderPdf(model(3, { draft: true, documentNumber: null, hashPrefix: null, approvedAt: null, approvedBy: null, qrUrl: null }))).toString('latin1');
    expect(draft).not.toContain('AlexBrush');
  });
  it('carries the Wendo logo as a picture in the header of a signed file and of a draft', async () => {
    expect((await renderPdf(model(3))).toString('latin1')).toContain('/Subtype /Image');
    const draft = await renderPdf(model(3, { draft: true, documentNumber: null, hashPrefix: null, approvedAt: null, approvedBy: null, qrUrl: null }));
    expect(draft.toString('latin1')).toContain('/Subtype /Image');
  });
  it('signs with the first and second name only', () => {
    expect(signedName('Faith Njeri (BM Nyeri Town)')).toBe('Faith Njeri');
    expect(signedName('Mary Wanjiku Kamau')).toBe('Mary Wanjiku');
  });
  it('carries the document number in its metadata, or says it is a draft', async () => {
    expect((await renderPdf(model(3))).toString('latin1')).toContain('TSH-0009');
    expect((await renderPdf(model(3, { draft: true, documentNumber: null, qrUrl: null }))).toString('latin1')).toContain('Draft, not approved');
  });
  it('handles 200 people and a very long name', async () => {
    const m = model(200);
    m.people[0] = { ...m.people[0]!, name: 'A very long name '.repeat(8) };
    const pdf = await renderPdf(m);
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(8);
  });
});

describe('the Excel', () => {
  const read = async (m: ExportModel) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await renderXlsx(m)) as never);
    return wb;
  };
  it('has the three sheets and a banner that names the signed document', async () => {
    const wb = await read(model(5));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Timesheet', 'Daily hours', 'Summary']);
    expect(String(wb.getWorksheet('Timesheet')!.getCell('A1').value)).toContain('Working copy of TSH-0009, approved');
    const draft = await read(model(5, { draft: true, documentNumber: null, approvedAt: null }));
    expect(String(draft.getWorksheet('Timesheet')!.getCell('A1').value)).toBe('Working copy, draft, not approved');
  });
  it('one row per person in the PDF\'s order, real numbers, unrounded hours', async () => {
    const m = model(8);
    const ws = (await read(m)).getWorksheet('Timesheet')!;
    expect(ws.getRow(2).values).toEqual([undefined, 'Person', 'Department', 'Planned (h)', 'Worked (h)', 'Overtime (h)', 'Late (min)', 'Absent (d)', 'Leave (d)', 'Decided by']);
    const names = [3, 4, 5, 6, 7, 8, 9, 10].map((r) => ws.getRow(r).getCell(1).value);
    expect(names).toEqual(groupByDepartment(m.people).flatMap((g) => g.people.map((p) => p.name)));
    const first = ws.getRow(3);
    expect(typeof first.getCell(4).value).toBe('number');
    expect(first.getCell(4).value).toBeCloseTo(177 + 5 / 60, 10); // 177.0833, never rounded in the cell
    expect(first.getCell(4).numFmt).toBe('0.00');
  });
  it('the total row sums with live formulas and the cached values agree', async () => {
    const m = model(8);
    const total = (await read(m)).getWorksheet('Timesheet')!.getRow(11);
    expect(total.getCell(1).value).toBe('Total');
    const worked = total.getCell(4).value as { formula: string; result: number };
    expect(worked.formula).toBe('SUM(D3:D10)');
    expect(worked.result).toBeCloseTo(m.totals.workedMinutes / 60, 8);
  });
  it('freezes the header and the first column and turns the filters on', async () => {
    const ws = (await read(model(4))).getWorksheet('Timesheet')!;
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 2 });
    expect(ws.autoFilter).toBeTruthy();
  });
  it('daily hours are real dates and times', async () => {
    const m = model(1, { daily: [{ person: 'Person 000', department: 'Barista', date: '2026-09-12' as never, plannedIn: '14:00', plannedOut: '22:00', clockIn: '13:58', clockOut: '22:35', workedMinutes: 515, overtimeMinutes: 35, lateMinutes: 0, result: 'Overtime 35 min, to decide', decision: '' }] });
    const row = (await read(m)).getWorksheet('Daily hours')!.getRow(2);
    expect(row.getCell(3).value).toBeInstanceOf(Date);
    expect(row.getCell(3).numFmt).toBe('yyyy-mm-dd');
    const out = row.getCell(7).value as Date; // a real time of day: the reader shows it as a time on Excel's day zero
    expect(out).toBeInstanceOf(Date);
    expect(out.getUTCHours() * 60 + out.getUTCMinutes()).toBe(22 * 60 + 35);
    expect(row.getCell(7).numFmt).toBe('hh:mm');
    expect(row.getCell(8).value).toBeCloseTo(515 / 60, 8);
  });
  it('the summary groups by department and lists the rules used', async () => {
    const ws = (await read(model(8))).getWorksheet('Summary')!;
    expect([2, 3, 4, 5].map((r) => ws.getRow(r).getCell(1).value)).toEqual(['Barista', 'Kitchen', 'Pastry', 'Service']);
    expect(ws.getRow(2).getCell(2).value).toBe(2);
    const text = JSON.stringify(ws.getSheetValues());
    expect(text).toContain('Overtime');
    expect(text).toContain('Lateness');
  });
  it('never carries a pay figure', async () => {
    const text = JSON.stringify((await read(model(8))).worksheets.map((w) => w.getSheetValues()));
    expect(text).not.toMatch(/KES|salary|wage|rate|payslip/i);
  });
});

describe('document formats', () => {
  it('hours in cells, headings and the figures band', () => {
    expect([cellHours(176 * 60), cellHours(35), cellHours(0)]).toEqual(['176:00', '0:35', '0:00']);
    expect([headingHours(5360 * 60), headingHours(5356 * 60 + 29), headingHours(5356 * 60 + 30)]).toEqual(['5,360 h', '5,356 h', '5,357 h']);
    expect([bandOvertime(225), bandOvertime(0), bandOvertime(40)]).toEqual(['3 h 45', '0', '40 min']);
    expect([lateCell(5), lateCell(0), dayCell(1), dayCell(0), dayCell(3)]).toEqual(['5 min', '0', '1 d', '0', '3 d']);
  });
  it('dates are 24 hour Nairobi time even though the server is not', () => {
    expect(longStamp(new Date('2026-10-19T08:42:00Z'))).toBe('19 October 2026, 11:42');
    expect(longStamp(new Date('2026-10-31T21:05:00Z'))).toBe('1 November 2026, 00:05');
    expect(clockOf('2026-09-12T19:35:00.000Z')).toBe('22:35');
    expect(clockOf(null)).toBeNull();
    expect([rangeWords('2026-09-14', '2026-09-20'), rangeWords('2026-09-01', '2026-09-30'), rangeWords('2026-09-28', '2026-10-04')]).toEqual(['14 to 20 September 2026', '1 to 30 September 2026', '28 September 2026 to 4 October 2026']);
  });
  it('file names follow the month, the site and a range', () => {
    expect(fileNameOf({ siteName: 'Nyeri Town', monthKey: '2026-09', fileSuffix: '' }, 'xlsx')).toBe('Timesheet-Nyeri-Town-2026-09.xlsx');
    expect(fileNameOf({ siteName: 'Nyeri Town', monthKey: '2026-09', fileSuffix: '14-20' }, 'pdf')).toBe('Timesheet-Nyeri-Town-2026-09-14-20.pdf');
    expect(fileNameOf({ siteName: 'Wendo "Central" / Kitchen', monthKey: '2026-09', fileSuffix: '' }, 'pdf')).toBe('Timesheet-Wendo-Central-Kitchen-2026-09.pdf');
  });
});
