import { formatWhole, parseCents } from '../../engine/money';
import { LINE_PT, FIRST_TABLE_Y, LATER_TABLE_Y, USABLE_BOTTOM_PT, continuation, joinNames, planPages, type Band, type PlannedPage } from '../../../timesheets/exports/export-plan';
import { groupByDepartment, type PayrollModel, type RegisterPerson } from '../export-model';
import { rangeWords } from '../../../timesheets/exports/export-format';
import { CONTENT_WIDTH, PALETTE, X, figuresBand, firstHeader, footers, hline, laterHeader, newDoc, pageFurniture, put, qrBlock, signature } from './pdf-parts';
import { bandNet, figuresOf, registerCell, registerColumns, type PdfColumn } from './register-layout';

type Doc = PDFKit.PDFDocument;
const ROW = 15;
const BAND = 13.5;
const PAD = 4;
const TITLE = 'Payroll register · All sites';

/** The signature block's height: the totals by site, the signatures, and the people left out (one line each). */
const closingHeight = (model: PayrollModel): number => 40 + model.bySite.length * 13 + 96 + (model.leftOut.length > 0 ? 24 + model.leftOut.length * 11 : 0);

/**
 * E8 page plan: page 1 holds whole departments up to 20 people, later pages 26, a department is split only when it alone is over 26.
 * The closing block (totals by site, signatures, QR, left out) always sits on the last page; if it does not fit under the last rows it
 * takes a page of its own. Nothing is ever scaled to fit.
 */
export function planRegister(model: PayrollModel): PlannedPage<RegisterPerson>[] {
  const pages = planPages(groupByDepartment(model.people));
  const last = pages[pages.length - 1];
  if (!last) return pages;
  const lines = last.bands.reduce((n, b) => n + b.people.length + 1, 0);
  const startY = last.number === 1 ? FIRST_TABLE_Y : LATER_TABLE_Y;
  if (startY + lines * LINE_PT + closingHeight(model) > USABLE_BOTTOM_PT) {
    last.rulesAndSignature = false;
    pages.push({ number: pages.length + 1, bands: [], rulesAndSignature: true });
  } else last.rulesAndSignature = true;
  return pages;
}

export async function renderRegisterPdf(model: PayrollModel): Promise<Buffer> {
  const { doc, done } = newDoc('Payroll register', model);
  const columns = registerColumns(model.tables, CONTENT_WIDTH);
  const pages = planRegister(model);
  const next = continuation(pages);
  for (const page of pages) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
    pageFurniture(doc, model.draft);
    let y = page.number === 1 ? figuresBand(doc, firstHeader(doc, model, TITLE, `${model.monthLabel} (${rangeWords(model.start, model.end).replace(/ \d{4}$/, '')}) · Wendo Coffee Bistro`), figuresOf(model)) : laterHeader(doc, model, TITLE);
    if (page.bands.length > 0) y = table(doc, columns, page, y);
    if (page.number === 1 && next && pages.length > 1) put(doc, `Continued on page 2: ${next.people > 0 ? `${joinNames(next.departments)} (${next.people} people), the totals by site and the signatures` : 'the totals by site and the signatures'}.`, X, y + 6, { font: 'Times-Italic', size: 9, color: PALETTE.muted });
    if (page.rulesAndSignature) closing(doc, model, y + 10);
  }
  footers(doc, model);
  doc.end();
  return done;
}

function table(doc: Doc, columns: readonly PdfColumn[], page: PlannedPage<RegisterPerson>, start: number): number {
  hline(doc, start, X, X + CONTENT_WIDTH, PALETTE.navy, 1.5);
  let x = X;
  for (const col of columns) {
    put(doc, col.label, x + PAD, start + 5, { font: 'Times-Bold', size: 8.25, color: PALETTE.navy, width: col.w - 2 * PAD, align: col.align, spacing: 0.4 });
    x += col.w;
  }
  hline(doc, start + 17, X, X + CONTENT_WIDTH, PALETTE.navy, 0.75);
  let y = start + 17;
  for (const band of page.bands) {
    y = bandRow(doc, band, y);
    for (const person of band.people) y = personRow(doc, columns, person, y);
  }
  return y;
}

function bandRow(doc: Doc, band: Band<RegisterPerson>, y: number): number {
  doc.save().rect(X, y, CONTENT_WIDTH, BAND).fill(PALETTE.band).restore();
  put(doc, `${band.department.toUpperCase()}${band.continued ? ', CONTINUED' : ''}`, X + PAD, y + 3.5, { font: 'Times-Bold', size: 8.25, color: PALETTE.navy, width: 300, spacing: 0.6 });
  put(doc, `${band.departmentTotal} people · net ${bandNet(band.people)}`, X, y + 3.5, { size: 8.25, color: PALETTE.muted, width: CONTENT_WIDTH - PAD, align: 'right' });
  hline(doc, y + BAND, X, X + CONTENT_WIDTH, PALETTE.navy, 0.75);
  return y + BAND;
}

function personRow(doc: Doc, columns: readonly PdfColumn[], person: RegisterPerson, y: number): number {
  let x = X;
  for (const col of columns) {
    put(doc, registerCell(col, person), x + PAD, y + 3.5, { size: 8.25, width: col.w - 2 * PAD, align: col.align });
    x += col.w;
  }
  hline(doc, y + ROW, X, X + CONTENT_WIDTH, PALETTE.row, 0.5);
  return y + ROW;
}

/** Totals by site, then the signatures (HR prepared and published, the Accountant approved), the QR, and who was left out. */
function closing(doc: Doc, model: PayrollModel, top: number): void {
  put(doc, 'TOTALS BY SITE', X, top, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, spacing: 0.8 });
  let y = top + 13;
  for (const s of model.bySite) {
    put(doc, s.name, X + PAD, y, { size: 8.25, width: 200 });
    put(doc, `${s.people} people`, X + 210, y, { size: 8.25, color: PALETTE.muted, width: 80 });
    put(doc, `gross ${formatWhole(parseCents(s.gross))}`, X + 300, y, { size: 8.25, width: 140 });
    put(doc, `deductions ${formatWhole(parseCents(s.taxStatutory) + parseCents(s.other))}`, X + 450, y, { size: 8.25, width: 160 });
    put(doc, `net ${formatWhole(parseCents(s.net))}`, X + 620, y, { font: 'Times-Bold', size: 8.25, width: 140 });
    hline(doc, y + 11, X, X + CONTENT_WIDTH, PALETTE.row, 0.5);
    y += 13;
  }
  const sy = y + 22;
  signature(doc, X, sy, model.published, 'Prepared and published', model.draft ? 'Not signed · the Accountant signs by approving the month' : 'Not published yet');
  signature(doc, X + 300, sy, model.approved, 'Approved', 'Not approved yet');
  qrBlock(doc, model, sy);
  if (model.leftOut.length > 0) {
    const ly = sy + 66;
    put(doc, 'LEFT OUT OF THIS RUN', X, ly, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, spacing: 0.8 });
    model.leftOut.forEach((l, i) => put(doc, `${l.name} · ${l.siteName}`, X + PAD, ly + 13 + i * 11, { size: 8.25, width: 400 }));
  }
}
