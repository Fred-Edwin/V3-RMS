import { env } from '../../../../config/env';
import { CONTENT, PALETTE, PORTRAIT, addPortraitPage, drawQr, footers, hline, letterhead, openPortrait, put, shillings, signature, stamp, type Doc } from '../../_shared/documents/portrait-doc';
import type { DocRow, PayslipDoc } from './document-model';

const X = PORTRAIT.marginX;
const COLS = [
  { label: '', x: X, w: 150 },
  { label: 'BASIS', x: X + 150, w: 195 },
  { label: 'THIS MONTH', x: X + 345, w: 80 },
  { label: 'YEAR TO DATE', x: X + 425, w: CONTENT - 425 },
];
const ROW = 17;

const pair = (doc: Doc, y: number, left: [string, string], right: [string, string]): void => {
  put(doc, left[0], X, y, { size: 7, color: PALETTE.muted, width: 250, spacing: 0.5 });
  put(doc, left[1], X, y + 9, { size: 10.5, width: 250 });
  put(doc, right[0], X + 270, y, { size: 7, color: PALETTE.muted, width: 245, spacing: 0.5 });
  put(doc, right[1], X + 270, y + 9, { size: 10.5, width: 245 });
};

function tableHead(doc: Doc, y: number, title: string): number {
  hline(doc, y, X, X + CONTENT, PALETTE.navy, 2);
  put(doc, title, COLS[0]!.x, y + 5, { font: 'Times-Bold', size: 8, color: PALETTE.navy, width: 150, spacing: 0.6 });
  for (const c of COLS.slice(1)) put(doc, c.label, c.x, y + 5, { font: 'Times-Bold', size: 7.5, color: PALETTE.navy, width: c.w, align: c.label === 'BASIS' ? 'left' : 'right', spacing: 0.5 });
  hline(doc, y + 17, X, X + CONTENT, PALETTE.navy, 0.8);
  return y + 17;
}

/** The A4 payslip (S5). Every figure comes from the frozen lines; two decimals; the signature is the one who signed that version (PD18). */
export async function renderPayslipPdf(model: PayslipDoc): Promise<Buffer> {
  const label = model.number ?? 'Payslip';
  const { doc, script, done } = openPortrait({ title: `Payslip ${label} · ${model.period}`, subject: label, created: model.created });
  const watermark = model.variant === 'REPLACED' ? 'REPLACED' : null;
  const page = () => addPortraitPage(doc, watermark);
  page();
  let y = letterhead(doc, { site: `${model.site} branch`, label: 'PAYSLIP', number: label, line: `Pay period ${model.period}${model.payDay ? ` · Pay day ${model.payDay}` : ''}`, extra: model.replacesLine });
  if (model.version > 1 && model.variant === 'ORIGINAL') stamp(doc, 'CORRECTED', X + CONTENT - 76, y - 4);
  if (model.replacedLine) put(doc, model.replacedLine, X, y, { font: 'Times-Italic', size: 10, color: '#8A5A16', width: CONTENT });
  y += model.replacedLine ? 16 : 6;
  const e = model.employee;
  pair(doc, y, ['EMPLOYEE', e.name], ['EMPLOYEE NO.', e.number]);
  pair(doc, y + 30, ['JOB TITLE', e.jobTitle], ['DEPARTMENT', e.department]);
  pair(doc, y + 60, ['KRA PIN', e.kraPin], ['NSSF NO.', e.nssf]);
  pair(doc, y + 90, ['SHA NO.', e.sha], ['PAID TO', e.paidTo]);
  y += 126;
  const cells: [string, string][] = [['GROSS PAY (KES)', model.gross], ['TOTAL DEDUCTIONS (KES)', model.totalDeductions], ['NET PAY (KES)', model.net]];
  const cw = CONTENT / 3;
  cells.forEach(([name, value], i) => {
    const x = X + i * cw;
    const last = i === 2;
    doc.save().lineWidth(0.8).strokeColor(PALETTE.rule);
    if (last) doc.rect(x, y, cw, 38).fill(PALETTE.navy); else doc.rect(x, y, cw, 38).stroke();
    doc.restore();
    put(doc, name, x + 8, y + 6, { size: 7, color: last ? '#FFFFFF' : PALETTE.muted, width: cw - 16, spacing: 0.5 });
    put(doc, shillings(value, 2), x + 8, y + 18, { font: 'Times-Bold', size: 14, color: last ? '#FFFFFF' : PALETTE.ink, width: cw - 16 });
  });
  y += 52;

  const drawRows = (title: string, items: DocRow[]): void => {
    y = tableHead(doc, y, title);
    for (const r of items) {
      if (y + ROW > PORTRAIT.bottom - 150) {
        page();
        y = tableHead(doc, 34, title);
      }
      put(doc, r.label, COLS[0]!.x, y + 4, { size: 9.5, width: COLS[0]!.w - 4 });
      put(doc, r.corrected ? `(corrected from ${shillings(r.corrected, 2)}) ${r.basis}`.trim() : r.basis, COLS[1]!.x, y + 5, { size: 8, color: r.corrected ? '#8A5A16' : PALETTE.muted, width: COLS[1]!.w - 6 });
      put(doc, shillings(r.month, 2), COLS[2]!.x, y + 4, { size: 9.5, width: COLS[2]!.w, align: 'right' });
      put(doc, shillings(r.ytd, 2), COLS[3]!.x, y + 4, { size: 9.5, width: COLS[3]!.w, align: 'right' });
      y += ROW;
      hline(doc, y, X, X + CONTENT, PALETTE.row, 0.5);
    }
  };
  drawRows('EARNINGS', model.earnings);
  doc.save().rect(X, y, CONTENT, 18).fill(PALETTE.band).restore();
  put(doc, 'Gross pay', X + 4, y + 5, { font: 'Times-Bold', size: 9.5, width: 200 });
  put(doc, shillings(model.gross, 2), COLS[2]!.x, y + 5, { font: 'Times-Bold', size: 9.5, width: COLS[2]!.w, align: 'right' });
  y += 28;
  drawRows('DEDUCTIONS', model.deductions);
  doc.save().rect(X, y, CONTENT, 18).fill(PALETTE.band).restore();
  put(doc, 'Total deductions', X + 4, y + 5, { font: 'Times-Bold', size: 9.5, width: 200 });
  put(doc, shillings(model.totalDeductions, 2), COLS[2]!.x, y + 5, { font: 'Times-Bold', size: 9.5, width: COLS[2]!.w, align: 'right' });
  y += 20;
  doc.save().rect(X, y, CONTENT, 22).fill(PALETTE.navy).restore();
  put(doc, 'NET PAY', X + 6, y + 6, { font: 'Times-Bold', size: 10.5, color: '#FFFFFF', width: 200, spacing: 0.8 });
  put(doc, shillings(model.net, 2), COLS[2]!.x, y + 6, { font: 'Times-Bold', size: 10.5, color: '#FFFFFF', width: COLS[2]!.w, align: 'right' });
  put(doc, shillings(model.netYtd, 2), COLS[3]!.x, y + 6, { font: 'Times-Bold', size: 10.5, color: '#FFFFFF', width: COLS[3]!.w, align: 'right' });
  y += 36;

  if (y > PORTRAIT.bottom - 150) {
    page();
    y = 40;
  }
  if (model.employer.length > 0) {
    doc.save().lineWidth(0.8).strokeColor(PALETTE.rule).rect(X, y, CONTENT, 14 + model.employer.length * 14).stroke().restore();
    put(doc, 'EMPLOYER CONTRIBUTIONS (NOT TAKEN FROM YOU)', X + 8, y + 5, { size: 7, color: PALETTE.muted, width: 300, spacing: 0.5 });
    model.employer.forEach((l, i) => {
      put(doc, l.label, X + 8, y + 17 + i * 14, { size: 9.5, width: 260 });
      put(doc, shillings(l.amount, 2), X + CONTENT - 108, y + 17 + i * 14, { size: 9.5, width: 100, align: 'right' });
    });
    y += 26 + model.employer.length * 14;
  }
  if (model.signer) {
    signature(doc, script, { x: X, y: y + 4, width: 220, name: model.signer.name, roleLine: model.signer.roleLine, signedLine: `Signed with PIN · ${model.signer.signedAt} · ${model.signer.versionLine}` });
  }
  if (model.number) {
    drawQr(doc, `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/ps/${model.number}?h=${model.hashPrefix}`, X + CONTENT - 62, y, 62);
    put(doc, `Scan to open ${model.number}`, X + CONTENT - 120, y + 66, { size: 7.5, color: PALETTE.muted, width: 120, align: 'right' });
  }
  footers(doc, `Generated by Wendo RMS · ${label}`, 'Approved by the Accountant, published by HR');
  doc.end();
  return done;
}
