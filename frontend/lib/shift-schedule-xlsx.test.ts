import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildShiftScheduleWorkbook, type ShiftScheduleExportRow } from './shift-schedule-xlsx';

const makeCells = (labels: string[]): ShiftScheduleExportRow['cells'] =>
  labels.map((shiftLabel, index) => ({
    date: `2026-09-2${index}`,
    dayLabel: `Day ${index}`,
    shiftLabel,
  }));

const makeRow = (overrides: Partial<ShiftScheduleExportRow>): ShiftScheduleExportRow => ({
  name: 'Jane Doe',
  role: 'Waiter',
  cells: makeCells(['Morning', 'Morning', 'OFF', 'Morning', 'Evening', 'OFF', 'OFF']),
  hours: '32',
  ...overrides,
});

/** Re-open the generated workbook so we can assert on real cell values. */
const readBack = async (blob: Blob): Promise<ExcelJS.Worksheet> => {
  const buffer = await blob.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.worksheets[0];
};

const colA = (ws: ExcelJS.Worksheet): string[] => {
  const out: string[] = [];
  ws.eachRow((row) => out.push(String(row.getCell(1).value ?? '')));
  return out;
};

describe('buildShiftScheduleWorkbook', () => {
  it('produces a single sheet with the title block', async () => {
    const blob = await buildShiftScheduleWorkbook(
      [makeRow({})],
      '21 Sep - 27 Sep 2026',
      '18 September 2026 at 09:00',
      'Nyeri Town',
    );
    const ws = await readBack(blob);
    expect(ws.name).toBe('Shift Schedule');
    const a = colA(ws);
    expect(a[0]).toContain('Wendo Coffee Bistro');
    expect(a[1]).toContain('21 Sep - 27 Sep 2026');
    expect(a[1]).toContain('Nyeri Town');
    expect(a[2]).toContain('Generated:');
  });

  it('writes one column per day plus a weekly hours column, in header order', async () => {
    const row = makeRow({});
    const blob = await buildShiftScheduleWorkbook([row], 'Week', 'x', 'Nyeri Town');
    const ws = await readBack(blob);
    const headerRow = ws.getRow(4); // title, period, generated, header
    expect(headerRow.getCell(1).value).toBe('Staff');
    expect(headerRow.getCell(2).value).toBe('Role');
    row.cells.forEach((cell, index) => {
      expect(headerRow.getCell(3 + index).value).toBe(cell.dayLabel);
    });
    expect(headerRow.getCell(3 + row.cells.length).value).toBe('Weekly Hours');
  });

  it('writes each staff member’s shift labels and hours in their own row', async () => {
    const rows = [
      makeRow({ name: 'Amos', cells: makeCells(['Morning', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF', 'OFF']), hours: '8' }),
      makeRow({ name: 'Beth', cells: makeCells(['OFF', 'Evening', 'Evening', 'OFF', 'OFF', 'OFF', 'OFF']), hours: '16' }),
    ];
    const ws = await readBack(await buildShiftScheduleWorkbook(rows, 'Week', 'x', 'Nyeri Town'));

    let amosRow: ExcelJS.Row | undefined;
    let bethRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Amos') amosRow = row;
      if (row.getCell(1).value === 'Beth') bethRow = row;
    });

    expect(amosRow?.getCell(3).value).toBe('Morning');
    expect(amosRow?.getCell(10).value).toBe('8');
    expect(bethRow?.getCell(4).value).toBe('Evening');
    expect(bethRow?.getCell(10).value).toBe('16');
  });
});
