import { existsSync } from 'node:fs';
import path from 'node:path';
import type PDFDocument from 'pdfkit';

/**
 * The signature of a signed timesheet is drawn in Alex Brush (spec section 10, D14), as the on-screen documents do. The file lives in
 * `backend/assets/fonts/` (SIL Open Font License, licence beside it) and the production image copies that folder (see the Dockerfile).
 * The path counts up from this folder in both `src/` and `dist/`, so it points at the backend root (or `/app`) either way.
 * It must be the TrueType file: a .woff2 loads and measures but its glyphs do not embed, which left the signature blank.
 * If the file is ever missing the export still works and the signature falls back to Times-Italic.
 */
export const SIGNATURE_FONT_FILE = path.resolve(__dirname, '../../../../../assets/fonts/AlexBrush-Regular.ttf');

export type SignatureFont = 'AlexBrush' | 'Times-Italic';

export function registerSignatureFont(doc: InstanceType<typeof PDFDocument>): SignatureFont {
  if (!existsSync(SIGNATURE_FONT_FILE)) return 'Times-Italic';
  doc.registerFont('AlexBrush', SIGNATURE_FONT_FILE);
  return 'AlexBrush';
}

/** The signature shows the first and second name only (brackets dropped); the full name stays in the line under it. */
export const signedName = (full: string): string => full.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
