import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { env } from '../../../../../config/env';
import { parseCents } from '../../engine/money';
import type { SnapshotLine, SnapshotPayslip } from '../../approval/month-snapshot';
import { roleLabel } from '../../../timesheets/approval/decided-by';
import { longStamp } from '../../../timesheets/exports/export-format';
import { PALETTE, drawQr, hline, put } from '../../../timesheets/exports/pdf-draw';
import { drawLogo } from '../../../timesheets/exports/pdf-logo';
import { registerSignatureFont, signedName } from '../../../timesheets/exports/signature-font';
import type { PayrollModel } from '../export-model';

const W = 595.28;
const H = 841.89;
const M = 54;
const CW = W - 2 * M;
type Doc = InstanceType<typeof PDFDocument>;

/** All but the last three characters hidden: the payslip proves who it is for without printing a whole filing number. */
export const maskId = (value: string | null | undefined): string => (value ? `${'•'.repeat(Math.max(0, value.length - 3))}${value.slice(-3)}` : '—');
const money = (v: string): string => {
  const cents = parseCents(v);
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${(abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(abs % 100n).toString().padStart(2, '0')}`;
};

/** The first ten characters of a hash over this payslip as it was frozen: the QR carries it, the verify page compares it. */
export const payslipHash = (p: SnapshotPayslip): string => createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 10);

function section(doc: Doc, title: string, lines: readonly SnapshotLine[], y: number, ensure: (need: number, y: number) => number): number {
  y = ensure(30, y);
  put(doc, title, M, y, { font: 'Times-Bold', size: 8, color: PALETTE.navy, spacing: 0.9, width: CW });
  hline(doc, y + 12, M, M + CW, PALETTE.navy, 0.75);
  y += 17;
  for (const line of lines) {
    doc.font('Times-Roman').fontSize(8);
    const h = Math.max(13, doc.heightOfString(line.workingText, { width: 230 }) + 4);
    y = ensure(h, y);
    put(doc, line.label, M, y, { size: 9.5, width: 190 });
    doc.font('Times-Roman').fontSize(8).fillColor(PALETTE.muted).text(line.workingText, M + 195, y + 1, { width: 230 });
    put(doc, money(line.amount), M, y, { size: 9.5, width: CW, align: 'right', font: 'Times-Roman' });
    hline(doc, y + h - 1, M, M + CW, PALETTE.row, 0.5);
    y += h;
  }
  return y + 6;
}

/**
 * One payslip as an A4 document (Segment 3 S5), from the frozen snapshot only. Version 2 and later carry a CORRECTED box and the
 * words "replaces version n"; the signature is the Accountant's approval (version 1) and the QR opens the verify page, which shows
 * the number, month and whether this version is current, never a name or an amount.
 */
export function renderPayslip(model: PayrollModel, p: SnapshotPayslip): Promise<Buffer> {
  const number = model.numbers.get(p.employeeId) ?? 'PS-draft';
  const version = p.version ?? 1;
  const doc: Doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, bufferPages: true, info: { Title: `Payslip ${number} ${model.monthLabel}`, Author: 'Wendo RMS', Subject: number, CreationDate: model.exportedAt, ModDate: model.exportedAt } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const bar = (): void => void doc.save().rect(0, 0, W, 7.5).fill(PALETTE.navy).restore();
  const ensure = (need: number, y: number): number => {
    if (y + need <= H - 70) return y;
    doc.addPage({ size: 'A4', margin: 0 });
    bar();
    return 40;
  };
  doc.addPage({ size: 'A4', margin: 0 });
  bar();

  if (!drawLogo(doc, M + 15, 45, 15)) {
    doc.save().circle(M + 15, 45, 15).fill(PALETTE.navy).restore();
    put(doc, 'W', M, 38, { font: 'Times-Bold', size: 15, color: '#FFFFFF', width: 30, align: 'center' });
  }
  put(doc, 'Wendo Coffee Bistro', M + 40, 30, { font: 'Times-Bold', size: 15, color: PALETTE.navy, width: 300 });
  put(doc, `Payslip · ${model.monthLabel}`, M + 40, 50, { size: 10, color: PALETTE.muted, width: 300 });
  put(doc, number, M, 30, { font: 'Times-Bold', size: 15, color: PALETTE.navy, width: CW, align: 'right' });
  put(doc, `Version ${version}`, M, 50, { size: 10, color: PALETTE.muted, width: CW, align: 'right' });
  if (version > 1) {
    doc.save().lineWidth(1.5).strokeColor(PALETTE.navy).rect(W - M - 190, 68, 100, 20).stroke().restore();
    put(doc, 'CORRECTED', W - M - 190, 73, { font: 'Times-Bold', size: 9, color: PALETTE.navy, width: 100, align: 'center', spacing: 1.2 });
    const when = model.correctedAt.get(p.employeeId);
    put(doc, `Version ${version} · replaces version ${version - 1}${when ? ` of ${longStamp(when).split(',')[0]}` : ''}`, M, 74, { font: 'Times-Italic', size: 8.5, color: PALETTE.muted, width: CW - 210, align: 'left' });
  }
  hline(doc, 96, M, M + CW, PALETTE.rule, 0.75);

  const facts: [string, string][] = [['EMPLOYEE', p.employeeName], ['EMPLOYEE NUMBER', p.employeeNumber], ['DEPARTMENT', p.department ?? '—'], ['SITE', p.siteName], ['KRA PIN', maskId(p.ids?.kraPin)], ['NSSF / SHA', `${maskId(p.ids?.nssfNumber)} / ${maskId(p.ids?.shaNumber)}`]];
  facts.forEach(([label, value], i) => {
    const x = M + (i % 2) * (CW / 2);
    const y = 108 + Math.floor(i / 2) * 30;
    put(doc, label, x, y, { size: 6.75, color: PALETTE.muted, spacing: 0.9, width: CW / 2 - 10 });
    put(doc, value, x, y + 10, { size: 10.5, width: CW / 2 - 10 });
  });

  let y = 208;
  y = section(doc, 'EARNINGS', p.lines.filter((l) => l.kind === 'EARNING'), y, ensure);
  put(doc, 'Gross pay', M, y, { font: 'Times-Bold', size: 10, width: 200 });
  put(doc, money(p.gross), M, y, { font: 'Times-Bold', size: 10, width: CW, align: 'right' });
  y += 20;
  y = section(doc, 'DEDUCTIONS', p.lines.filter((l) => l.kind === 'DEDUCTION' || l.kind === 'STATUTORY'), y, ensure);
  y = ensure(50, y);
  doc.save().rect(M, y, CW, 30).fill(PALETTE.band).restore();
  put(doc, 'NET PAY', M + 10, y + 10, { font: 'Times-Bold', size: 10, color: PALETTE.navy, spacing: 1, width: 200 });
  put(doc, `KES ${money(p.net)}`, M, y + 8, { font: 'Times-Bold', size: 14, color: PALETTE.navy, width: CW - 10, align: 'right' });
  y += 44;
  const employer = p.lines.filter((l) => l.kind === 'MEMO');
  if (employer.length > 0) y = section(doc, 'EMPLOYER CONTRIBUTIONS (NOT DEDUCTED FROM YOUR PAY)', employer, y, ensure);

  y = ensure(110, y) + 8;
  if (model.approved?.at) {
    put(doc, signedName(model.approved.name), M, y - 4, { font: registerSignatureFont(doc), size: 28, color: PALETTE.navy, width: 230 });
    hline(doc, y + 30, M, M + 200, PALETTE.navy, 0.75);
    put(doc, `${model.approved.name} · ${roleLabel(model.approved.role ?? '')}`, M, y + 34, { size: 9, width: 300 });
    put(doc, `Approved · signed with PIN · ${longStamp(model.approved.at)}`, M, y + 46, { size: 8, color: PALETTE.muted, width: 330 });
  }
  if (model.documentNumber && model.hashPrefix) {
    drawQr(doc, `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/verify/ps/${number}?h=${payslipHash(p)}`, W - M - 57, y - 6, 57);
    put(doc, `Scan to check ${number}`, W - M - 200, y + 53, { size: 8, color: PALETTE.muted, width: 200, align: 'right' });
  }
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    hline(doc, H - 36, M, M + CW, PALETTE.rule, 0.5);
    put(doc, `Generated by Wendo RMS · ${number} · ${model.documentNumber ?? 'PAY-draft'} · Page ${i + 1} of ${range.count} · ${longStamp(model.exportedAt)}`, M, H - 30, { size: 7.5, color: PALETTE.muted, width: CW });
  }
  doc.end();
  return done;
}
