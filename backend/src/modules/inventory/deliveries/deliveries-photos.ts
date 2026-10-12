import { randomUUID } from 'node:crypto';
import type { PHOTO_MIME_TYPES } from '../dispatch/_shared/dispatch-contract';

/** The three image kinds a delivery photo may be (Amendment 1 row 6), decided from the first bytes, never from the name the browser sent. */
export type PhotoMime = (typeof PHOTO_MIME_TYPES)[number];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const startsWith = (buf: Buffer, bytes: number[], offset = 0): boolean => buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);
const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

export const sniffPhotoMime = (buf: Buffer): PhotoMime | null => {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, PNG_SIGNATURE)) return 'image/png';
  if (startsWith(buf, ascii('RIFF')) && startsWith(buf, ascii('WEBP'), 8)) return 'image/webp';
  return null;
};

const EXTENSION: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** `dispatch-photos/<hub>/<dispatch>/<uuid>.jpg`: the key is ours, so the browser's file name never reaches the store. */
export const photoKeyOf = (hubId: string, dispatchId: string, mime: PhotoMime): string => `dispatch-photos/${hubId}/${dispatchId}/${randomUUID()}.${EXTENSION[mime]}`;

/** A file name safe to keep on the row: no path, no control characters, at most 120 characters. */
export const safeFileName = (name: string | undefined): string => {
  const base = (name ?? 'photo').split(/[\\/]/).pop() ?? 'photo';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f"]/g, '_').trim();
  return (cleaned.length > 0 ? cleaned : 'photo').slice(0, 120);
};
