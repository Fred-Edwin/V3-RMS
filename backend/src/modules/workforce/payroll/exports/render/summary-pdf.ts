import { formatCents, formatWhole, parseCents, sumCents } from '../../engine/money';
import { longStamp, rangeWords } from '../../../timesheets/exports/export-format';
import { roleLabel } from '../../../timesheets/approval/decided-by';
import type { PayrollModel, WhoWhen } from '../export-model';
import { CONTENT_WIDTH, PALETTE, X, figuresBand, firstHeader, footers, hline, newDoc, pageFurniture, put, qrBlock, signature } from './pdf-parts';
import { figuresOf } from './register-layout';

type Doc = PDFKit.PDFDocument;
const whole = (value: string): string => formatWhole(parseCents(value));
const MAX_SITE_ROWS = 10;
const LEFT_W = 410;
const RIGHT_X = X + LEFT_W + 30;
const RIGHT_W = CONTENT_WIDTH - LEFT_W - 30;

const heading = (doc: Doc, text: string, x: number, y: number, width: number): void => {
  put(doc, text, x, y, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, spacing: 0.8, width });
  hline(doc, y + 11, x, x + width, PALETTE.navy, 0.75);
};

/** Employee and employer totals per statutory table, read from the frozen lines (so the list follows the tables, never a fixed four). */
export function tableTotals(model: PayrollModel): { name: string; employee: string; employer: string | null }[] {
  return model.tables.map((t) => {
    const lines = model.payslips.flatMap((p) => p.lines.filter((l) => l.tableCode === t.key));
    const part = (share: string): bigint => sumCents(lines.filter((l) => l.share === share).map((l) => parseCents(l.amount)));
    const employer = part('EMPLOYER');
    return { name: t.name, employee: formatCents(part('EMPLOYEE')), employer: employer > 0n ? formatCents(employer) : null };
  });
}

function bySite(doc: Doc, model: PayrollModel, y: number): number {
  heading(doc, 'FROM GROSS TO NET, BY SITE', X, y, LEFT_W);
  const cols = [0, 150, 205, 275, 335];
  const head = ['SITE', 'PEOPLE', 'GROSS', 'DEDUCTIONS', 'NET PAY'];
  head.forEach((h, i) => put(doc, h, X + cols[i]!, y + 16, { size: 6.75, color: PALETTE.muted, spacing: 0.6, width: 75, align: i === 0 ? 'left' : 'right' }));
  let row = y + 30;
  for (const s of model.bySite.slice(0, MAX_SITE_ROWS)) {
    const cells = [s.name, String(s.people), whole(s.gross), formatWhole(parseCents(s.taxStatutory) + parseCents(s.other)), whole(s.net)];
    cells.forEach((c, i) => put(doc, c, X + cols[i]!, row, { size: 8.25, width: i === 0 ? 145 : 70, align: i === 0 ? 'left' : 'right' }));
    row += 13;
  }
  if (model.bySite.length > MAX_SITE_ROWS) {
    put(doc, `and ${model.bySite.length - MAX_SITE_ROWS} more sites, in the Excel`, X, row, { font: 'Times-Italic', size: 8.25, color: PALETTE.muted, width: LEFT_W });
    row += 13;
  }
  hline(doc, row - 2, X, X + LEFT_W, PALETTE.navy, 0.75);
  const t = model.totals;
  [ 'Total', String(t.headcount), whole(t.gross), formatWhole(parseCents(t.taxStatutory) + parseCents(t.other)), whole(t.net)].forEach((c, i) => put(doc, c, X + cols[i]!, row + 2, { font: 'Times-Bold', size: 8.25, width: i === 0 ? 145 : 70, align: i === 0 ? 'left' : 'right' }));
  return row + 24;
}

function taxByType(doc: Doc, model: PayrollModel, y: number): number {
  heading(doc, `TAX AND STATUTORY, BY TYPE${model.tablesNote.version === null ? '' : ` (VERSION ${model.tablesNote.version} TABLES)`}`, X, y, LEFT_W);
  const rows = tableTotals(model);
  const two = rows.length > 8;
  const half = two ? Math.ceil(rows.length / 2) : rows.length;
  rows.forEach((r, i) => {
    const col = two && i >= half ? 1 : 0;
    const x = X + col * (LEFT_W / 2 + 6);
    const w = two ? LEFT_W / 2 - 6 : LEFT_W;
    const ry = y + 16 + (col === 1 ? i - half : i) * 13;
    put(doc, r.name, x, ry, { size: 8.25, width: w * 0.45 });
    put(doc, `employee ${whole(r.employee)}`, x + w * 0.4, ry, { size: 8.25, width: w * 0.3, align: 'right' });
    put(doc, r.employer ? `employer ${whole(r.employer)}` : '', x + w * 0.72, ry, { size: 8.25, color: PALETTE.muted, width: w * 0.28, align: 'right' });
  });
  return y + 22 + half * 13;
}

const stepLine = (label: string, who: WhoWhen | null, extra = ''): string => (who && who.at ? `${label}: ${who.name}${who.role ? `, ${roleLabel(who.role)}` : ''}, ${longStamp(who.at)}${extra}` : `${label}: not yet`);

function rulesUsed(doc: Doc, model: PayrollModel, y: number): number {
  heading(doc, 'RULES USED THIS MONTH', RIGHT_X, y, RIGHT_W);
  const lines = [
    `Overtime: ${model.rules.overtime.join('; ')}`,
    `Lateness: ${model.rules.lateness.join('; ')}`,
    `Absence: ${model.rules.absence.join('; ')}`,
    `Tax tables: ${model.tablesNote.version === null ? 'not set' : `version ${model.tablesNote.version}`}${model.tablesNote.by && model.tablesNote.at ? `, confirmed by ${model.tablesNote.by}, ${longStamp(model.tablesNote.at)}` : ''}`,
    'Casual pay: a memo, not in this run',
  ];
  let ry = y + 16;
  for (const line of lines) {
    doc.font('Times-Roman').fontSize(8.25);
    const h = doc.heightOfString(line, { width: RIGHT_W });
    doc.fillColor(PALETTE.ink).text(line, RIGHT_X, ry, { width: RIGHT_W, lineBreak: true, height: 26, ellipsis: true });
    ry += Math.min(h, 26) + 4;
  }
  return ry + 8;
}

function prepared(doc: Doc, model: PayrollModel, y: number): void {
  heading(doc, 'HOW THE MONTH WAS PREPARED', RIGHT_X, y, RIGHT_W);
  const steps = [
    `Timesheets approved: ${model.timesheets.map((t) => `${t.site} ${t.number}`).join(', ') || 'none'}`,
    model.calculated.at ? `Calculated: run ${model.calculated.run}, ${longStamp(model.calculated.at)}` : 'Calculated: not yet',
    stepLine('Reviewed', model.reviewed),
    stepLine('Approved', model.approved),
    stepLine('Published', model.published),
  ];
  let ry = y + 16;
  for (const step of steps) {
    const h = doc.font('Times-Roman').fontSize(8.25).heightOfString(step, { width: RIGHT_W });
    doc.fillColor(PALETTE.ink).text(step, RIGHT_X, ry, { width: RIGHT_W, lineBreak: true, height: 26, ellipsis: true });
    ry += Math.min(h, 26) + 4;
  }
}

/** One page, never two (E8): the figures, gross to net by site, tax by type, the rules used, how it was prepared and two signatures. */
export async function renderSummaryPdf(model: PayrollModel): Promise<Buffer> {
  const { doc, done } = newDoc('Payroll summary', model);
  doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
  pageFurniture(doc, model.draft);
  const y = figuresBand(doc, firstHeader(doc, model, 'Payroll summary · All sites', `${model.monthLabel} (${rangeWords(model.start, model.end).replace(/ \d{4}$/, '')}) · Wendo Coffee Bistro`), figuresOf(model));
  taxByType(doc, model, bySite(doc, model, y + 4));
  prepared(doc, model, rulesUsed(doc, model, y + 4));
  const sy = 478;
  signature(doc, X, sy, model.approved, 'Approved', 'Not signed · the Accountant signs by approving the month');
  signature(doc, X + 300, sy, model.published, 'Prepared and published', 'Not published yet');
  qrBlock(doc, model, sy);
  footers(doc, model);
  doc.end();
  return done;
}
