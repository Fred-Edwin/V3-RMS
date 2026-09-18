/**
 * Weekly shift schedule — formatted Excel (.xlsx) builder.
 *
 * Mirrors the roster grid HR already sees on screen (manage/shifts page):
 * one row per staff member, one column per day of the week showing the
 * assigned shift name or "OFF", plus a weekly-hours total column. Producing
 * a real workbook (rather than CSV) keeps the same benefits as the payroll
 * register — no "possible data loss" banner, formatting survives on open.
 */

import ExcelJS from 'exceljs';

const BRAND_GREEN = 'FF1F6E43';
const HEADER_BG = 'FF1F6E43';
const HEADER_FG = 'FFFFFFFF';
const HOURS_BG = 'FFEAD9B0';

export interface ShiftScheduleCell {
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Sun 21 Sep"
  shiftLabel: string; // shift name, or "OFF"
}

export interface ShiftScheduleExportRow {
  name: string;
  role: string;
  cells: ShiftScheduleCell[];
  hours: string;
}

/**
 * Build the formatted weekly shift schedule workbook as a downloadable Blob.
 * Pure aside from instantiating the workbook; no DOM access.
 */
export const buildShiftScheduleWorkbook = async (
  rows: ShiftScheduleExportRow[],
  weekLabel: string,
  generatedLabel: string,
  scopeLabel: string,
): Promise<Blob> => {
  const dayLabels = rows[0]?.cells.map((cell) => cell.dayLabel) ?? [];
  const columns = [
    { header: 'Staff', width: 24 },
    { header: 'Role', width: 16 },
    ...dayLabels.map((label) => ({ header: label, width: 14 })),
    { header: 'Weekly Hours', width: 14 },
  ];
  const colCount = columns.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wendo RMS';
  wb.created = new Date();
  const ws = wb.addWorksheet('Shift Schedule', {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.columns = columns.map((c) => ({ width: c.width }));

  const lastColLetter = ws.getColumn(colCount).letter;
  const mergeAcross = (rowNum: number) => ws.mergeCells(`A${rowNum}:${lastColLetter}${rowNum}`);

  // ── Title block (rows 1–3) ───────────────────────────────────────
  const titleRow = ws.addRow(['Wendo Coffee Bistro — Shift Schedule']);
  mergeAcross(titleRow.number);
  titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: BRAND_GREEN } };
  titleRow.height = 22;

  const periodRow = ws.addRow([`Week: ${weekLabel}  ·  ${scopeLabel}`]);
  mergeAcross(periodRow.number);
  periodRow.getCell(1).font = { size: 11, color: { argb: 'FF57534E' } };

  const genRow = ws.addRow([`Generated: ${generatedLabel}`]);
  mergeAcross(genRow.number);
  genRow.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF8A8A8A' } };

  // ── Header row (row 4) ────────────────────────────────────────────
  const headerRow = ws.addRow(columns.map((c) => c.header));
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 10.5 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF14502F' } } };
  });

  // ── Body ──────────────────────────────────────────────────────────
  for (const row of rows) {
    const dataRow = ws.addRow([row.name, row.role, ...row.cells.map((cell) => cell.shiftLabel), row.hours]);
    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center' };
    });
    const hoursCell = dataRow.getCell(colCount);
    hoursCell.font = { bold: true };
    hoursCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HOURS_BG } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};
