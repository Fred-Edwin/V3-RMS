/** Upload rules for supplier documents: images and PDFs only, checked by content. */

export const MAX_SUPPLIER_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;

export type DetectedFileType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

/** Magic-byte sniffing; the client-declared mime type and extension are never trusted. */
export const detectFileType = (buf: Buffer): DetectedFileType | null => {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
};

/** Strips any path and control characters; caps the length. */
export const sanitizeFileName = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return (cleaned || 'document').slice(0, 200);
};
