import { existsSync } from 'node:fs';
import path from 'node:path';
import type PDFDocument from 'pdfkit';

/**
 * The Wendo logo in the header of every timesheet PDF. The file lives in `backend/assets/images/` and the production image copies that
 * folder (see the Dockerfile). The path counts up from this folder in both `src/` and `dist/`. Returns false when the file is missing,
 * so the caller can draw its plain mark instead and the export never fails over a picture.
 */
export const LOGO_FILE = path.resolve(__dirname, '../../../../../assets/images/wendo-logo.jpg');

/** The logo clipped to a circle of radius `r` centred on (cx, cy). */
export function drawLogo(doc: InstanceType<typeof PDFDocument>, cx: number, cy: number, r: number): boolean {
  if (!existsSync(LOGO_FILE)) return false;
  doc.save().circle(cx, cy, r).clip();
  doc.image(LOGO_FILE, cx - r, cy - r, { width: 2 * r, height: 2 * r });
  doc.restore();
  return true;
}
