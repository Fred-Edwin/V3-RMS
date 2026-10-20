import { CONTENT, PALETTE, PORTRAIT, addPortraitPage, drawQr, footers, hline, letterhead, openPortrait, put, signature, stamp, type Doc } from '../../_shared/documents/portrait-doc';
import type { ConductDoc } from './document-model';

const X = PORTRAIT.marginX;
const LIMIT = PORTRAIT.bottom - 10;

/** A wrapped paragraph at `y`; answers the y below it. Real text (selectable), never an image. */
function paragraph(doc: Doc, text: string, y: number, options: { size?: number; font?: 'Times-Roman' | 'Times-Bold' | 'Times-Italic'; color?: string; width?: number } = {}): number {
  const width = options.width ?? CONTENT;
  doc.font(options.font ?? 'Times-Roman').fontSize(options.size ?? 11).fillColor(options.color ?? PALETTE.ink);
  doc.text(text, X, y, { width, lineGap: 3.5 });
  return y + doc.heightOfString(text, { width, lineGap: 3.5 }) + 8;
}

function signBlock(doc: Doc, script: Parameters<typeof signature>[1], y: number, x: number, name: string, roleLine: string, signedLine: string): void {
  signature(doc, script, { x, y, width: 230, name, roleLine, signedLine });
}

function factsPage(doc: Doc, model: ConductDoc, watermark: string | null): void {
  const facts = model.facts;
  if (!facts) return;
  addPortraitPage(doc, watermark);
  let y = 44;
  put(doc, 'Facts from the timesheets', X, y, { font: 'Times-Bold', size: 14, color: PALETTE.navy, width: CONTENT });
  y += 24;
  const cols = [
    { label: 'DAY', x: X, w: 150, align: 'left' as const },
    { label: 'PLANNED IN', x: X + 160, w: 100, align: 'right' as const },
    { label: 'CLOCK IN', x: X + 280, w: 100, align: 'right' as const },
    { label: facts.kind === 'LATENESS' ? 'MINUTES LATE' : 'ABSENT', x: X + 390, w: CONTENT - 390, align: 'right' as const },
  ];
  hline(doc, y, X, X + CONTENT, PALETTE.navy, 2);
  for (const c of cols) put(doc, c.label, c.x, y + 5, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, width: c.w, align: c.align, spacing: 0.5 });
  y += 18;
  hline(doc, y, X, X + CONTENT, PALETTE.navy, 0.8);
  for (const day of facts.days) {
    if (y > LIMIT - 40) break;
    put(doc, day.date, cols[0]!.x, y + 5, { size: 10, width: cols[0]!.w });
    put(doc, day.plannedIn ?? '', cols[1]!.x, y + 5, { size: 10, width: cols[1]!.w, align: 'right' });
    put(doc, day.clockIn ?? '', cols[2]!.x, y + 5, { size: 10, width: cols[2]!.w, align: 'right' });
    put(doc, facts.kind === 'LATENESS' ? String(day.minutesLate) : 'Yes', cols[3]!.x, y + 5, { size: 10, width: cols[3]!.w, align: 'right' });
    y += 18;
    hline(doc, y, X, X + CONTENT, PALETTE.row, 0.6);
  }
  hline(doc, y, X, X + CONTENT, PALETTE.navy, 2);
  put(doc, 'TOTAL', X, y + 5, { font: 'Times-Bold', size: 10, width: 150 });
  put(doc, facts.kind === 'LATENESS' ? `${facts.minutes} min` : `${facts.count} days`, cols[3]!.x, y + 5, { font: 'Times-Bold', size: 10, width: cols[3]!.w, align: 'right' });
}

function decisionPage(doc: Doc, model: ConductDoc, script: Parameters<typeof signature>[1], watermark: string | null): void {
  const decision = model.decision;
  if (!decision) return;
  addPortraitPage(doc, watermark);
  put(doc, 'Decision on appeal', X, 44, { font: 'Times-Bold', size: 14, color: PALETTE.navy, width: CONTENT });
  let y = paragraph(doc, decision.outcome, 76, { font: 'Times-Bold', size: 12 });
  y = paragraph(doc, `Reason: ${decision.reason}`, y + 4);
  signBlock(doc, script, y + 26, X, decision.byName, `${decision.byName} · ${decision.byRole}`, decision.signedLine);
}

/** The A4 warning notice: page 1 the letter, then the facts page, then the decision page when there is one (spec S10). */
export async function renderConductPdf(model: ConductDoc): Promise<Buffer> {
  const { doc, script, done } = openPortrait({ title: model.watermark === 'DRAFT' ? 'Warning notice (draft)' : `Warning notice ${model.number}`, subject: model.number, created: model.created });
  addPortraitPage(doc, model.watermark);
  let y = letterhead(doc, { site: `${model.siteName} branch`, label: 'WARNING NOTICE', number: model.number, line: model.dateLong });
  if (model.stamp) stamp(doc, model.stamp, X + CONTENT - 120, y - 4, model.watermark === 'DRAFT' ? PALETTE.muted : PALETTE.navy);
  y += 26;
  put(doc, model.letter.person.name, X, y, { size: 11.5, width: CONTENT });
  put(doc, `${model.letter.person.role} · ${model.letter.person.siteName}`, X, y + 15, { size: 11.5, color: PALETTE.muted, width: CONTENT });
  y += 44;
  put(doc, model.letter.subject, X, y, { font: 'Times-Bold', size: 13, color: PALETTE.navy, width: CONTENT });
  y += 28;
  y = paragraph(doc, model.letter.salutation, y);
  for (const text of model.letter.paragraphs) y = paragraph(doc, text, y);
  y = paragraph(doc, model.letter.closing, y);
  y += 10;
  if (y > LIMIT - 130) {
    addPortraitPage(doc, model.watermark);
    y = 50;
  }
  if (model.issuerSignature) signBlock(doc, script, y, X, model.issuerSignature.roleLine.split(' · ')[0] ?? '', model.issuerSignature.roleLine, model.issuerSignature.signedLine);
  if (model.qrUrl && model.watermark !== 'DRAFT') {
    drawQr(doc, model.qrUrl, X + CONTENT - 76, y, 76);
    put(doc, `Scan to open ${model.number}`, X + CONTENT - 110, y + 80, { size: 8, color: PALETTE.muted, width: 110, align: 'right' });
  }
  if (model.receipt) {
    const r = model.receipt;
    if (r.empty) {
      hline(doc, y + 100, X, X + 230, PALETTE.ink, 0.8);
      put(doc, r.roleLine, X, y + 105, { size: 9, width: 230 });
      put(doc, r.signedLine, X, y + 118, { size: 8, color: PALETTE.muted, width: CONTENT - 20 });
    } else {
      signBlock(doc, script, y + 90, X, r.name, r.roleLine, r.signedLine);
    }
  }
  factsPage(doc, model, model.watermark);
  decisionPage(doc, model, script, model.watermark);
  if (model.watermark === 'WITHDRAWN') {
    const range = doc.bufferedPageRange();
    doc.switchToPage(range.start + range.count - 1);
    stamp(doc, 'WITHDRAWN', X, LIMIT - 24, PALETTE.navy);
  }
  footers(doc, `Generated by Wendo RMS · ${model.number}`, 'Issued by the ' + (model.issuerSignature?.roleLine.split(' · ')[1] ?? 'manager'));
  doc.end();
  return done;
}
