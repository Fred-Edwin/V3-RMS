import PDFDocument from 'pdfkit';
import type { SnapshotPerson } from '../approval/snapshot';
import { decidedText, roleLabel } from '../approval/decided-by';
import type { RuleUsed } from '../months/rules-used';
import { bandOvertime, cellHours, dayCell, headingHours, lateCell, longStamp, rangeWords } from './export-format';
import { groupByDepartment, type ExportModel } from './export-model';
import { continuation, joinNames, planPages, type Band, type PlannedPage } from './export-plan';
import { CONTENT_WIDTH, PAGE, PALETTE, drawQr, hline, pageFurniture, put } from './pdf-draw';
import { drawLogo } from './pdf-logo';
import { registerSignatureFont, signedName } from './signature-font';

const X = PAGE.marginX;
const ROW = 15;
const BAND = 13.5;
const COLUMNS = [
  { key: 'person', label: 'PERSON', w: 127.5, align: 'left' },
  { key: 'department', label: 'DEPARTMENT', w: 75, align: 'left' },
  { key: 'planned', label: 'PLANNED', w: 60, align: 'right' },
  { key: 'worked', label: 'WORKED', w: 60, align: 'right' },
  { key: 'overtime', label: 'OVERTIME', w: 60, align: 'right' },
  { key: 'late', label: 'LATE', w: 52.5, align: 'right' },
  { key: 'absent', label: 'ABSENT', w: 52.5, align: 'right' },
  { key: 'leave', label: 'LEAVE', w: 45, align: 'right' },
  { key: 'decided', label: 'DECIDED BY', w: CONTENT_WIDTH - 532.5, align: 'left' },
] as const;
const PAD = 4;

/** The landscape A4 timesheet, drawn server side (D14). Draft until the month is approved: stamped, watermarked, unsigned, no number, no QR. */
export async function renderPdf(model: ExportModel): Promise<Buffer> {
  // The dates in the file are the export time, so the same export is the same bytes (a re-export of an approved month matches).
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    info: { Title: `Timesheet ${model.siteName} ${model.monthLabel}`, Author: 'Wendo RMS', Subject: model.documentNumber ?? 'Draft, not approved', CreationDate: model.exportedAt, ModDate: model.exportedAt },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const pages = planPages(groupByDepartment(model.people));
  const next = continuation(pages);
  for (const page of pages) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    pageFurniture(doc, model.draft);
    let y = page.number === 1 ? firstHeader(doc, model) : laterHeader(doc, model);
    if (page.bands.length > 0) y = table(doc, page, y);
    if (page.number === 1 && next && pages.length > 1) {
      const what = next.people > 0 ? `${joinNames(next.departments)} (${next.people} people), the rules used this month and the signature` : 'the rules used this month and the signature';
      put(doc, `Continued on page 2: ${what}.`, X, y + 6, { font: 'Times-Italic', size: 9, color: PALETTE.muted });
    }
    if (page.rulesAndSignature) rulesAndSignature(doc, model, y + 10);
  }
  footers(doc, model, pages.length);
  doc.end();
  return finished;
}

function firstHeader(doc: PDFKit.PDFDocument, model: ExportModel): number {
  const top = 30;
  if (!drawLogo(doc, X + 15, top + 15, 15)) {
    doc.save().circle(X + 15, top + 15, 15).fill(PALETTE.navy).restore();
    put(doc, 'W', X, top + 8, { font: 'Times-Bold', size: 15, color: '#FFFFFF', width: 30, align: 'center' });
  }
  put(doc, `Timesheet · ${model.siteName}`, X + 40, top, { font: 'Times-Bold', size: 16.5, color: PALETTE.navy, width: 330 });
  put(doc, `${model.monthLabel} (${rangeWords(model.start, model.end).replace(/ \d{4}$/, '')}) · Wendo Coffee Bistro`, X + 40, top + 21, { size: 9, color: PALETTE.muted, width: 330 });
  const stamp = model.draft ? 'DRAFT · NOT APPROVED' : 'APPROVED';
  const stampX = (PAGE.width - 150) / 2 + 20;
  doc.save().lineWidth(1.5).strokeColor(PALETTE.navy).rect(stampX, top + 3, 150, 22).stroke().restore();
  put(doc, stamp, stampX, top + 9, { font: 'Times-Bold', size: 9, color: PALETTE.navy, width: 150, align: 'center', spacing: 1.2 });
  put(doc, model.documentNumber ?? 'TSH-draft', X, top, { font: 'Times-Bold', size: 16.5, color: PALETTE.navy, align: 'right' });
  put(doc, model.approvedAt ? `Approved ${longStamp(model.approvedAt)}` : 'Not approved yet', X, top + 21, { size: 8.25, color: PALETTE.muted, align: 'right' });
  if (model.scopeNote) put(doc, model.scopeNote, X + 40, top + 33, { font: 'Times-Italic', size: 9, color: PALETTE.muted, width: 500 });
  hline(doc, top + 48, X, X + CONTENT_WIDTH, PALETTE.rule, 0.75);
  return figures(doc, model, top + 56) + 10;
}

function figures(doc: PDFKit.PDFDocument, model: ExportModel, y: number): number {
  const t = model.totals;
  const cells: [string, string][] = [
    ['PEOPLE', String(t.people)],
    ['PLANNED', headingHours(t.plannedMinutes)],
    ['WORKED', headingHours(t.workedMinutes)],
    ['OVERTIME AUTHORISED', bandOvertime(t.overtimeApprovedMinutes)],
    ['LATE MARKS', String(t.lateCount)],
    ['ABSENT DAYS', String(t.absentDays)],
  ];
  const w = CONTENT_WIDTH / cells.length;
  doc.save().lineWidth(0.75).strokeColor(PALETTE.rule).rect(X, y, CONTENT_WIDTH, 36).stroke().restore();
  cells.forEach(([label, value], i) => {
    if (i > 0) doc.save().lineWidth(0.75).strokeColor(PALETTE.rule).moveTo(X + i * w, y).lineTo(X + i * w, y + 36).stroke().restore();
    put(doc, label, X + i * w + 8, y + 6, { size: 6.75, color: PALETTE.muted, width: w - 12, spacing: 0.9 });
    put(doc, value, X + i * w + 8, y + 16, { font: 'Times-Bold', size: 13.5, color: PALETTE.navy, width: w - 12 });
  });
  return y + 36;
}

function laterHeader(doc: PDFKit.PDFDocument, model: ExportModel): number {
  put(doc, `Timesheet · ${model.siteName} · ${model.monthLabel}`, X, 28, { font: 'Times-Bold', size: 12.75, color: PALETTE.navy, width: 520 });
  put(doc, model.documentNumber ?? 'TSH-draft', X, 28, { font: 'Times-Bold', size: 12.75, color: PALETTE.navy, align: 'right' });
  hline(doc, 48, X, X + CONTENT_WIDTH, PALETTE.rule, 0.75);
  return 58;
}

function columnHeader(doc: PDFKit.PDFDocument, y: number): number {
  hline(doc, y, X, X + CONTENT_WIDTH, PALETTE.navy, 1.5);
  let x = X;
  for (const col of COLUMNS) {
    put(doc, col.label, x + PAD, y + 5, { font: 'Times-Bold', size: 8.25, color: PALETTE.navy, width: col.w - 2 * PAD, align: col.align, spacing: 0.4 });
    x += col.w;
  }
  hline(doc, y + 17, X, X + CONTENT_WIDTH, PALETTE.navy, 0.75);
  return y + 17;
}

function table(doc: PDFKit.PDFDocument, page: PlannedPage<SnapshotPerson & { id: string }>, start: number): number {
  let y = columnHeader(doc, start);
  for (const band of page.bands) {
    y = bandRow(doc, band, y);
    for (const person of band.people) y = personRow(doc, person, y);
  }
  return y;
}

function bandRow(doc: PDFKit.PDFDocument, band: Band<SnapshotPerson & { id: string }>, y: number): number {
  doc.save().rect(X, y, CONTENT_WIDTH, BAND).fill(PALETTE.band).restore();
  put(doc, `${band.department.toUpperCase()}${band.continued ? ', CONTINUED' : ''}`, X + PAD, y + 3.5, { font: 'Times-Bold', size: 8.25, color: PALETTE.navy, width: 300, spacing: 0.6 });
  put(doc, `${band.departmentTotal} people`, X, y + 3.5, { size: 8.25, color: PALETTE.muted, width: CONTENT_WIDTH - PAD, align: 'right' });
  hline(doc, y + BAND, X, X + CONTENT_WIDTH, PALETTE.navy, 0.75);
  return y + BAND;
}

function personRow(doc: PDFKit.PDFDocument, p: SnapshotPerson, y: number): number {
  const cells: Record<(typeof COLUMNS)[number]['key'], string> = {
    person: p.name,
    department: p.department ?? '',
    planned: cellHours(p.plannedMinutes),
    worked: cellHours(p.workedMinutes),
    overtime: cellHours(p.overtimeAuthorisedMinutes),
    late: lateCell(p.lateMinutes),
    absent: dayCell(p.absentDays),
    leave: dayCell(p.leaveDays),
    decided: decidedText(p.decided),
  };
  let x = X;
  for (const col of COLUMNS) {
    put(doc, cells[col.key], x + PAD, y + 3.5, { size: 8.25, width: col.w - 2 * PAD, align: col.align, ...(col.key === 'decided' ? { size: 7.5, color: PALETTE.muted } : {}) });
    x += col.w;
  }
  hline(doc, y + ROW, X, X + CONTENT_WIDTH, PALETTE.row, 0.5);
  return y + ROW;
}

const POLICY_WORDS: Record<string, string> = { RECORD_ONLY: 'recorded only; payroll applies no deduction', AFTER_N_LATES: 'deducted after repeated lates', FROM_FIRST_MINUTE: 'deducted from the first late minute' };

const ruleLines = (rules: readonly RuleUsed[], key: RuleUsed['key']): string[] => {
  const rule = rules.find((r) => r.key === key);
  if (!rule) return [];
  const version = rule.version === 0 && !rule.siteVersion ? 'Standard values (no version set)' : `Version ${rule.version}${rule.siteVersion ? `, site override ${rule.siteVersion}` : ''}${rule.effectiveFrom ? `, from ${rule.effectiveFrom}` : ''}`;
  if (key === 'OVERTIME') {
    const cap = rule.facts.weeklyCapMinutes;
    return [`Service tail ${rule.facts.serviceTailMinutes} min`, cap === null || cap === undefined ? 'No weekly cap' : `Weekly cap ${Number(cap) / 60} h`, version];
  }
  return [`Grace ${rule.facts.graceMinutes} min`, `Late time is ${POLICY_WORDS[String(rule.facts.policy)] ?? 'handled by the Rules'}`, version];
};

function rulesAndSignature(doc: PDFKit.PDFDocument, model: ExportModel, top: number): void {
  const h = 62;
  doc.save().lineWidth(0.75).strokeColor(PALETTE.rule).rect(X, top, CONTENT_WIDTH, h).stroke().restore();
  const colW = CONTENT_WIDTH / 3;
  const columns: [string, string[]][] = [
    ['RULES USED FOR THIS MONTH · OVERTIME', ruleLines(model.rules, 'OVERTIME')],
    ['LATENESS', ruleLines(model.rules, 'LATENESS')],
    ['ABSENCE', ['A day on the rota with no clock and no approved leave', 'is recorded as absent and unpaid by the Rules.']],
  ];
  columns.forEach(([title, lines], i) => {
    put(doc, title, X + i * colW + 12, top + 9, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, width: colW - 20, spacing: 0.8 });
    lines.forEach((line, n) => put(doc, line, X + i * colW + 12, top + 22 + n * 11, { size: 9, width: colW - 20 }));
  });
  const sy = top + h + 14;
  if (model.draft || !model.approvedBy) {
    put(doc, "Not signed · the site's manager signs by approving the month", X, sy + 20, { font: 'Times-Italic', size: 10.5, color: PALETTE.muted });
    return;
  }
  put(doc, signedName(model.approvedBy.name), X, sy - 4, { font: registerSignatureFont(doc), size: 32, color: PALETTE.navy, width: 330 });
  hline(doc, sy + 32, X, X + 230, PALETTE.navy, 0.75);
  put(doc, `${model.approvedBy.name} · ${roleLabel(model.approvedBy.role)}`, X, sy + 36, { size: 9, width: 330 });
  put(doc, `Signed with PIN · ${model.approvedAt ? longStamp(model.approvedAt) : ''}`, X, sy + 48, { size: 8.25, color: PALETTE.muted, width: 330 });
  if (model.qrUrl && model.documentNumber) {
    const q = 57;
    drawQr(doc, model.qrUrl, X + CONTENT_WIDTH - q, sy - 6, q);
    put(doc, `Scan to open ${model.documentNumber}`, X + CONTENT_WIDTH - 200, sy + q - 2, { size: 8.25, color: PALETTE.muted, width: 200, align: 'right' });
  }
}

function footers(doc: PDFKit.PDFDocument, model: ExportModel, total: number): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    hline(doc, PAGE.height - 24, X, X + CONTENT_WIDTH, PALETTE.rule, 0.5);
    const left = `Generated by Wendo RMS · ${model.documentNumber ?? 'TSH-draft'} · Page ${i + 1} of ${total} · Exported by ${model.exportedBy.name}, ${roleLabel(model.exportedBy.role)}, ${longStamp(model.exportedAt)}`;
    put(doc, left, X, PAGE.height - 18, { size: 7.5, color: PALETTE.muted, width: 560 });
    put(doc, model.draft ? 'Not counted in payroll until approved' : `Counted in payroll: ${model.monthLabel}`, X, PAGE.height - 18, { size: 7.5, color: PALETTE.muted, align: 'right' });
  }
}
