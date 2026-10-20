import PDFDocument from 'pdfkit';
import { PALETTE, drawQr, hline, put } from '../../timesheets/exports/pdf-draw';
import { drawLogo } from '../../timesheets/exports/pdf-logo';
import { registerSignatureFont, signedName, type SignatureFont } from '../../timesheets/exports/signature-font';

export { PALETTE, drawQr, hline, put, signedName };

/** A4 portrait in points (794 × 1123 px at 96 dpi). The same palette, fonts and rendering rules as the timesheet (1A section 10). */
export const PORTRAIT = { width: 595.28, height: 841.89, marginX: 40, bottom: 790 } as const;
export const CONTENT = PORTRAIT.width - 2 * PORTRAIT.marginX;
export type Doc = InstanceType<typeof PDFDocument>;

export interface PortraitOpen {
  doc: Doc;
  script: SignatureFont;
  done: Promise<Buffer>;
}

/**
 * Opens a portrait document. The dates in the file are fixed by the caller (the approval or generation time), so the same data is the
 * same bytes: a re-render of an unchanged document matches the first (PD16).
 */
export function openPortrait(info: { title: string; subject: string; created: Date }): PortraitOpen {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: false,
    bufferPages: true,
    info: { Title: info.title, Author: 'Wendo RMS', Subject: info.subject, CreationDate: info.created, ModDate: info.created },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  return { doc, script: registerSignatureFont(doc), done };
}

/** A new page: the navy bar across the top and, if asked, a light diagonal word (DRAFT, REPLACED, VOID). */
export function addPortraitPage(doc: Doc, watermark: string | null): void {
  doc.addPage({ size: 'A4', margin: 0 });
  doc.save().rect(0, 0, PORTRAIT.width, 7.5).fill(PALETTE.navy).restore();
  if (watermark) {
    doc.save().fillColor(PALETTE.navy).fillOpacity(0.08).font('Times-Bold').fontSize(110);
    doc.rotate(-45, { origin: [PORTRAIT.width / 2, PORTRAIT.height / 2] });
    doc.text(watermark, PORTRAIT.width / 2 - 300, PORTRAIT.height / 2 - 60, { width: 600, align: 'center', lineBreak: false });
    doc.restore();
  }
}

export interface Letterhead {
  site: string;
  label: string; // 'PAYSLIP', 'CASUAL PAY SHEET', 'TAX DEDUCTION CARD · P9'
  number: string;
  line: string; // the line under the number: the date or the period
  extra?: string | null; // a second line under it
}

/** Logo, employer name and branch at the left; the document label, number and date at the right. Returns the y below the rule. */
export function letterhead(doc: Doc, head: Letterhead, y = 26): number {
  const x = PORTRAIT.marginX;
  if (!drawLogo(doc, x + 19, y + 19, 19)) doc.save().circle(x + 19, y + 19, 19).fill(PALETTE.navy).restore();
  put(doc, 'Wendo Coffee Bistro', x + 48, y + 2, { font: 'Times-Bold', size: 17, color: PALETTE.navy, width: 300 });
  put(doc, `${head.site} · Nyeri, Kenya`, x + 48, y + 24, { size: 9.5, color: PALETTE.muted, width: 300 });
  const rw = 200;
  const rx = PORTRAIT.width - x - rw;
  put(doc, head.label, rx, y, { size: 8, color: PALETTE.muted, width: rw, align: 'right', spacing: 1.1 });
  put(doc, head.number, rx, y + 10, { font: 'Times-Bold', size: 20, color: PALETTE.navy, width: rw, align: 'right' });
  put(doc, head.line, rx, y + 33, { size: 9.5, color: PALETTE.muted, width: rw, align: 'right' });
  if (head.extra) put(doc, head.extra, rx, y + 45, { size: 9, color: PALETTE.muted, width: rw, align: 'right' });
  const line = y + 62;
  hline(doc, line, x, x + CONTENT, PALETTE.rule, 1);
  return line + 10;
}

/** An outlined stamp (APPROVED, CORRECTED, DRAFT · NOT APPROVED). */
export function stamp(doc: Doc, text: string, x: number, y: number, color: string = PALETTE.navy): number {
  doc.font('Times-Bold').fontSize(10);
  const w = doc.widthOfString(text) + text.length * 1.4 + 16;
  doc.save().lineWidth(1).strokeColor(color).rect(x, y, w, 20).stroke().restore();
  put(doc, text, x + 8, y + 5.5, { font: 'Times-Bold', size: 10, color, width: w - 8, spacing: 1.4 });
  return w;
}

/** The signature block: a script name over a line, the role line and the signing line under it. */
export function signature(doc: Doc, script: SignatureFont, args: { x: number; y: number; width: number; name: string; roleLine: string; signedLine: string }): void {
  put(doc, signedName(args.name), args.x, args.y, { font: script === 'AlexBrush' ? 'AlexBrush' : 'Times-Italic', size: 26, color: PALETTE.navy, width: args.width });
  hline(doc, args.y + 34, args.x, args.x + args.width, PALETTE.navy, 0.8);
  put(doc, args.roleLine, args.x, args.y + 39, { size: 9, width: args.width });
  put(doc, args.signedLine, args.x, args.y + 52, { size: 8, color: PALETTE.muted, width: args.width });
}

/** The footer on every page, with a real "Page n of N". Call once, after the last page is drawn. */
export function footers(doc: Doc, left: string, right: string): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    hline(doc, PORTRAIT.bottom + 8, PORTRAIT.marginX, PORTRAIT.marginX + CONTENT, PALETTE.rule, 0.8);
    put(doc, `${left} · Page ${i + 1} of ${range.count} · Confidential: for the named people only`, PORTRAIT.marginX, PORTRAIT.bottom + 13, { size: 7.5, color: PALETTE.muted, width: CONTENT - 150 });
    put(doc, right, PORTRAIT.marginX + CONTENT - 150, PORTRAIT.bottom + 13, { size: 7.5, color: PALETTE.muted, width: 150, align: 'right' });
  }
}

export const shillings = (amount: string, decimals: 0 | 2 = 0): string => {
  const negative = amount.startsWith('-');
  const [whole = '0', cents = '00'] = amount.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // A plain hyphen-minus: the built-in PDF font cannot draw U+2212 and prints it as a quote mark.
  return `${negative ? '-' : ''}${grouped}${decimals === 2 ? `.${cents.padEnd(2, '0')}` : ''}`;
};
