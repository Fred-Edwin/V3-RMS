import { CONTENT, PALETTE, PORTRAIT, addPortraitPage, drawQr, footers, hline, letterhead, openPortrait, put, shillings, signature, stamp, type Doc } from '../../_shared/documents/portrait-doc';

export interface SheetDocLine {
  name: string;
  idMasked: string;
  worked: string; // '07:00 to 15:00' or '20:00 to 02:00 (+1)'
  hours: string; // '8' or '8 h 30'
  amount: string; // whole shillings, '900'
  received: { name: string; at: string } | null;
}

export interface SheetDoc {
  mode: 'DRAFT' | 'APPROVED' | 'VOID';
  number: string; // 'CPS-0318', or 'CPS-draft'
  dateLong: string;
  site: string;
  department: string;
  recordedBy: string; // 'Name, Role'
  sentAt: string | null; // '19 October 2026, 14:40'
  approvedBy: { name: string; roleLine: string; signedAt: string } | null;
  cashHolder: string | null;
  rate: string;
  lines: SheetDocLine[];
  corrections: { text: string; amount: string }[];
  total: string;
  created: Date;
  qrUrl: string | null;
}

const X = PORTRAIT.marginX;
const COLS = [
  { label: 'WORKER', x: X, w: 190, align: 'left' as const },
  { label: 'WORKED', x: X + 190, w: 120, align: 'left' as const },
  { label: 'HOURS', x: X + 310, w: 50, align: 'right' as const },
  { label: 'KES', x: X + 360, w: 55, align: 'right' as const },
  { label: 'RECEIVED', x: X + 430, w: CONTENT - 430, align: 'left' as const },
];
const ROW = 26;

function tableHead(doc: Doc, y: number): number {
  hline(doc, y, X, X + CONTENT, PALETTE.navy, 2);
  for (const c of COLS) put(doc, c.label, c.x, y + 5, { size: 7.5, font: 'Times-Bold', color: PALETTE.navy, width: c.w, align: c.align, spacing: 0.6 });
  hline(doc, y + 18, X, X + CONTENT, PALETTE.navy, 0.8);
  return y + 18;
}

/** The A4 casual pay sheet (S10): a draft (preview), the approved sheet with its receipts, or a voided one. The head's block is a printed line, never a script signature. */
export async function renderSheetPdf(model: SheetDoc): Promise<Buffer> {
  const { doc, script, done } = openPortrait({ title: `Casual pay sheet ${model.number} · ${model.dateLong}`, subject: model.number, created: model.created });
  const watermark = model.mode === 'VOID' ? 'VOID' : model.mode === 'DRAFT' ? 'DRAFT' : null;
  const page = () => addPortraitPage(doc, watermark);
  page();
  let y = letterhead(doc, { site: `${model.site} branch`, label: 'CASUAL PAY SHEET', number: model.number, line: model.dateLong });
  y += 6;
  put(doc, `Casual workers, ${model.department} department`, X, y, { font: 'Times-Bold', size: 14, width: CONTENT - 150 });
  const who = [`Recorded by ${model.recordedBy}`, model.approvedBy ? `approved by ${model.approvedBy.name}` : null, 'paid in cash from petty cash'].filter(Boolean).join(' · ');
  put(doc, who, X, y + 20, { size: 9.5, color: PALETTE.muted, width: CONTENT - 150 });
  const label = model.mode === 'APPROVED' ? 'APPROVED' : model.mode === 'VOID' ? 'VOID' : 'DRAFT · NOT APPROVED';
  stamp(doc, label, X + CONTENT - 130 - (label.length > 8 ? 40 : 0), y, model.mode === 'DRAFT' ? '#8A5A16' : PALETTE.navy);
  y = tableHead(doc, y + 44);
  const header = () => {
    page();
    return tableHead(doc, 36);
  };
  for (const line of model.lines) {
    if (y + ROW > PORTRAIT.bottom - 140) y = header();
    put(doc, line.name, X, y + 4, { size: 10.5, width: 188 });
    put(doc, `ID ${line.idMasked}`, X, y + 16, { size: 7.5, color: PALETTE.muted, width: 188 });
    put(doc, line.worked, COLS[1]!.x, y + 8, { size: 10, width: 120 });
    put(doc, line.hours, COLS[2]!.x, y + 8, { size: 10, width: 50, align: 'right' });
    put(doc, shillings(line.amount), COLS[3]!.x, y + 8, { size: 10, width: 55, align: 'right' });
    if (line.received) {
      put(doc, line.received.name, COLS[4]!.x, y + 2, { font: script === 'AlexBrush' ? 'AlexBrush' : 'Times-Italic', size: 15, color: PALETTE.navy, width: COLS[4]!.w });
      put(doc, line.received.at, COLS[4]!.x, y + 17, { size: 7.5, color: PALETTE.muted, width: COLS[4]!.w });
    } else if (model.mode !== 'DRAFT') {
      put(doc, '(to sign)', COLS[4]!.x, y + 8, { size: 9, color: PALETTE.muted, width: COLS[4]!.w });
    }
    y += ROW;
    hline(doc, y, X, X + CONTENT, PALETTE.row, 0.6);
  }
  for (const c of model.corrections) {
    if (y + ROW > PORTRAIT.bottom - 140) y = header();
    put(doc, c.text, X, y + 8, { font: 'Times-Italic', size: 9.5, color: '#8A5A16', width: 380 });
    put(doc, shillings(c.amount), COLS[3]!.x, y + 8, { size: 10, width: 55, align: 'right' });
    y += ROW - 6;
    hline(doc, y, X, X + CONTENT, PALETTE.row, 0.6);
  }
  hline(doc, y + 4, X, X + CONTENT, PALETTE.navy, 1.4);
  put(doc, 'Total paid in cash', X, y + 12, { font: 'Times-Bold', size: 11.5, width: 300 });
  put(doc, shillings(model.total), COLS[3]!.x, y + 12, { font: 'Times-Bold', size: 11.5, width: 55, align: 'right' });
  hline(doc, y + 30, X, X + CONTENT, PALETTE.navy, 1.4);
  y += 42;
  const signedAt = model.lines.filter((l) => l.received).map((l) => l.received!.at);
  const note = `Rate: KES ${shillings(model.rate)} for a day of 8 hours, set in Rules for casual work. No statutory deductions apply to this amount.${signedAt.length > 0 ? ` Each worker signed on the department head's phone when they were paid, at ${signedAt.join(' and ')}.` : ''}${model.cashHolder ? ` Cash held by ${model.cashHolder}.` : ''}`;
  doc.font('Times-Roman').fontSize(9).fillColor(PALETTE.muted).text(note, X, y, { width: CONTENT, lineGap: 2 });
  y = Math.max(y + 40, doc.y + 16);
  if (y > PORTRAIT.bottom - 90) {
    page();
    y = 40;
  }
  put(doc, `Recorded by ${model.recordedBy}`, X, y + 10, { size: 10, width: 230 });
  put(doc, model.sentAt ? `Sent for approval · ${model.sentAt}` : 'Not sent yet', X, y + 24, { size: 8, color: PALETTE.muted, width: 230 });
  if (model.approvedBy) {
    signature(doc, script, { x: X + 270, y, width: 170, name: model.approvedBy.name, roleLine: `Approved by ${model.approvedBy.name}, ${model.approvedBy.roleLine}`, signedLine: `Signed with PIN · ${model.approvedBy.signedAt}` });
  } else {
    put(doc, 'Approved by the Branch Manager (pending)', X + 270, y + 10, { size: 10, color: PALETTE.muted, width: 190 });
  }
  if (model.qrUrl) {
    drawQr(doc, model.qrUrl, X + CONTENT - 62, y - 6, 62);
    put(doc, `Scan to open ${model.number}`, X + CONTENT - 100, y + 60, { size: 7.5, color: PALETTE.muted, width: 100, align: 'right' });
  }
  footers(doc, `Generated by Wendo RMS · ${model.number}`, model.mode === 'DRAFT' ? 'Draft, not approved' : 'Kept with the petty cash book');
  doc.end();
  return done;
}
