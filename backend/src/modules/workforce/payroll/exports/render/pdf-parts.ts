import PDFDocument from 'pdfkit';
import { roleLabel } from '../../../timesheets/approval/decided-by';
import { longStamp } from '../../../timesheets/exports/export-format';
import { CONTENT_WIDTH, PAGE, PALETTE, drawQr, hline, pageFurniture, put } from '../../../timesheets/exports/pdf-draw';
import { drawLogo } from '../../../timesheets/exports/pdf-logo';
import { registerSignatureFont, signedName } from '../../../timesheets/exports/signature-font';
import type { PayrollModel, WhoWhen } from '../export-model';

export const X = PAGE.marginX;
type Doc = InstanceType<typeof PDFDocument>;

/** A landscape A4 document that collects its bytes. The dates inside are the export time, so the same export is the same bytes. */
export function newDoc(title: string, model: PayrollModel): { doc: Doc; done: Promise<Buffer> } {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false, bufferPages: true,
    info: { Title: `${title} ${model.monthLabel}`, Author: 'Wendo RMS', Subject: model.documentNumber ?? 'Draft, not approved', CreationDate: model.exportedAt, ModDate: model.exportedAt },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  return { doc, done: new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks)))) };
}

export const numberOf = (model: PayrollModel): string => model.documentNumber ?? 'PAY-draft';

/** Page 1: the logo, the title, the stamp, the number, the approval line, then the rule. Returns the next y. */
export function firstHeader(doc: Doc, model: PayrollModel, title: string, sub: string): number {
  const top = 30;
  if (!drawLogo(doc, X + 15, top + 15, 15)) {
    doc.save().circle(X + 15, top + 15, 15).fill(PALETTE.navy).restore();
    put(doc, 'W', X, top + 8, { font: 'Times-Bold', size: 15, color: '#FFFFFF', width: 30, align: 'center' });
  }
  put(doc, title, X + 40, top, { font: 'Times-Bold', size: 16.5, color: PALETTE.navy, width: 330 });
  put(doc, sub, X + 40, top + 21, { size: 9, color: PALETTE.muted, width: 400 });
  const stampX = (PAGE.width - 160) / 2 + 40;
  doc.save().lineWidth(1.5).strokeColor(PALETTE.navy).rect(stampX, top + 3, 160, 22).stroke().restore();
  put(doc, model.stamp, stampX, top + 9, { font: 'Times-Bold', size: 9, color: PALETTE.navy, width: 160, align: 'center', spacing: 1.2 });
  put(doc, numberOf(model), X, top, { font: 'Times-Bold', size: 16.5, color: PALETTE.navy, align: 'right' });
  put(doc, model.approved?.at ? `Approved ${longStamp(model.approved.at)}` : 'Not approved yet', X, top + 21, { size: 8.25, color: PALETTE.muted, align: 'right' });
  if (model.corrections > 0) put(doc, `Includes ${model.corrections} correction${model.corrections === 1 ? '' : 's'} made after approval. Revision ${model.revision}.`, X + 40, top + 33, { font: 'Times-Italic', size: 9, color: PALETTE.muted, width: 500 });
  hline(doc, top + 48, X, X + CONTENT_WIDTH, PALETTE.rule, 0.75);
  return top + 56;
}

export function laterHeader(doc: Doc, model: PayrollModel, title: string): number {
  put(doc, `${title} · ${model.monthLabel}`, X, 28, { font: 'Times-Bold', size: 12.75, color: PALETTE.navy, width: 520 });
  put(doc, numberOf(model), X, 28, { font: 'Times-Bold', size: 12.75, color: PALETTE.navy, align: 'right' });
  hline(doc, 48, X, X + CONTENT_WIDTH, PALETTE.rule, 0.75);
  return 58;
}

/** The band of figures under the header: a row of boxed cells. Returns the next y. */
export function figuresBand(doc: Doc, y: number, cells: readonly [string, string][]): number {
  const w = CONTENT_WIDTH / cells.length;
  doc.save().lineWidth(0.75).strokeColor(PALETTE.rule).rect(X, y, CONTENT_WIDTH, 36).stroke().restore();
  cells.forEach(([label, value], i) => {
    if (i > 0) doc.save().lineWidth(0.75).strokeColor(PALETTE.rule).moveTo(X + i * w, y).lineTo(X + i * w, y + 36).stroke().restore();
    put(doc, label, X + i * w + 8, y + 6, { size: 6.75, color: PALETTE.muted, width: w - 12, spacing: 0.9 });
    put(doc, value, X + i * w + 8, y + 16, { font: 'Times-Bold', size: 13.5, color: PALETTE.navy, width: w - 12 });
  });
  return y + 46;
}

/** One signature: the name in the signature hand, the rule, the name and role, and how it was signed. Unsigned shows a plain line. */
export function signature(doc: Doc, x: number, y: number, who: WhoWhen | null, verb: string, unsigned: string): void {
  if (!who || !who.at) {
    put(doc, unsigned, x, y + 20, { font: 'Times-Italic', size: 10.5, color: PALETTE.muted, width: 300 });
    return;
  }
  put(doc, signedName(who.name), x, y - 4, { font: registerSignatureFont(doc), size: 28, color: PALETTE.navy, width: 250 });
  hline(doc, y + 30, x, x + 220, PALETTE.navy, 0.75);
  put(doc, `${who.name} · ${roleLabel(who.role ?? '')}`, x, y + 34, { size: 9, width: 300 });
  put(doc, `${verb} · signed with PIN · ${longStamp(who.at)}`, x, y + 46, { size: 8.25, color: PALETTE.muted, width: 330 });
}

/** The QR of an approved document at the right edge, with its caption. */
export function qrBlock(doc: Doc, model: PayrollModel, y: number): void {
  if (!model.qrUrl) return;
  const q = 57;
  drawQr(doc, model.qrUrl, X + CONTENT_WIDTH - q, y - 6, q);
  put(doc, `Scan to open ${numberOf(model)}`, X + CONTENT_WIDTH - 200, y + q - 2, { size: 8.25, color: PALETTE.muted, width: 200, align: 'right' });
}

/** The footer of every page: who made it and when on the left, the month (or what a draft lacks) on the right. */
export function footers(doc: Doc, model: PayrollModel): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    hline(doc, PAGE.height - 24, X, X + CONTENT_WIDTH, PALETTE.rule, 0.5);
    put(doc, `Generated by Wendo RMS · ${numberOf(model)} · Page ${i + 1} of ${range.count} · Exported by ${model.exportedBy.name}, ${roleLabel(model.exportedBy.role)}, ${longStamp(model.exportedAt)}`, X, PAGE.height - 18, { size: 7.5, color: PALETTE.muted, width: 560 });
    const right = model.draft ? 'Not final until the Accountant approves' : model.corrections > 0 ? `Revision ${model.revision} reflects ${model.corrections} correction${model.corrections === 1 ? '' : 's'} after approval` : `Payroll: ${model.monthLabel}`;
    put(doc, right, X, PAGE.height - 18, { size: 7.5, color: PALETTE.muted, align: 'right' });
  }
}

export { pageFurniture, put, hline, PALETTE, CONTENT_WIDTH, PAGE };
