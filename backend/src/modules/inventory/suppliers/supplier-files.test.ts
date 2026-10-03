import { describe, expect, it } from 'vitest';
import { detectFileType, sanitizeFileName } from './supplier-files';

describe('detectFileType (magic bytes)', () => {
  it('recognises JPEG, PNG, WebP and PDF', () => {
    expect(detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(detectFileType(Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]))).toBe('image/webp');
    expect(detectFileType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
  });

  it('rejects everything else, whatever the extension claims', () => {
    expect(detectFileType(Buffer.from('MZ\x90\x00'))).toBeNull(); // exe
    expect(detectFileType(Buffer.from('<html><script>'))).toBeNull();
    expect(detectFileType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
    expect(detectFileType(Buffer.from('RIFF\x01\x00\x00\x00WAVEfmt '))).toBeNull(); // RIFF but not WebP
  });
});

describe('sanitizeFileName', () => {
  it('strips paths, quotes and control characters', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\scans\\inv"oice\u0000.pdf')).toBe('invoice.pdf');
    expect(sanitizeFileName('')).toBe('document');
    expect(sanitizeFileName('a'.repeat(500))).toHaveLength(200);
  });
});
