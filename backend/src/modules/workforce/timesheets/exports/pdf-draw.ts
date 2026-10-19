import type PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/** The document palette (spec section 10): navy, rule, band fill, ink. No design token exists for these; they live here. */
export const PALETTE = { navy: '#14284B', rule: '#D8DEE9', band: '#EEF1F7', ink: '#111111', muted: '#47433D', row: '#E4E2DE' } as const;

/** A4 landscape in points. */
export const PAGE = { width: 841.89, height: 595.28, marginX: 40.5 } as const;
export const CONTENT_WIDTH = PAGE.width - 2 * PAGE.marginX;

type Doc = InstanceType<typeof PDFDocument>;
type Font = 'Times-Roman' | 'Times-Bold' | 'Times-Italic' | 'Times-BoldItalic';

export interface TextOptions {
  font?: Font;
  size?: number;
  color?: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  spacing?: number;
}

/** One line of text at a fixed place, cut with an ellipsis at the width. Nothing here ever starts a new page by itself. */
export function put(doc: Doc, text: string, x: number, y: number, options: TextOptions = {}): void {
  doc.font(options.font ?? 'Times-Roman').fontSize(options.size ?? 8.25).fillColor(options.color ?? PALETTE.ink);
  doc.text(text, x, y, { width: options.width ?? CONTENT_WIDTH, align: options.align ?? 'left', lineBreak: false, ellipsis: true, characterSpacing: options.spacing ?? 0 });
}

export function hline(doc: Doc, y: number, x1: number, x2: number, color: string, width: number): void {
  doc.save().lineWidth(width).strokeColor(color).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/** A QR code drawn as vector squares (no image, no font), `size` points wide. */
export function drawQr(doc: Doc, text: string, x: number, y: number, size: number): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const cell = size / count;
  doc.save().fillColor(PALETTE.ink);
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) doc.rect(x + col * cell, y + row * cell, cell + 0.2, cell + 0.2).fill();
    }
  }
  doc.restore();
}

/** The very top bar of every page, and the light diagonal "DRAFT" across a draft. */
export function pageFurniture(doc: Doc, draft: boolean): void {
  doc.save().rect(0, 0, PAGE.width, 7.5).fill(PALETTE.navy).restore();
  if (!draft) return;
  doc.save().fillColor(PALETTE.navy).fillOpacity(0.08).font('Times-Bold').fontSize(150);
  doc.rotate(-28, { origin: [PAGE.width / 2, PAGE.height / 2] });
  doc.text('DRAFT', PAGE.width / 2 - 200, PAGE.height / 2 - 80, { width: 400, align: 'center', lineBreak: false });
  doc.restore();
}
