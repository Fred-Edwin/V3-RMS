import { crc32 } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Buffer;
}

const u16 = (n: number): Buffer => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

/** A name is a plain file name: no folders, no `..`, nothing a zip reader would write outside its folder. */
export const safeEntryName = (name: string): string => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 120) || 'file';

/**
 * A zip with every file stored, not compressed: the files are PDFs, which are already compressed, and writing the format by hand
 * keeps a dependency out of the project. Fixed time stamps make the same files the same bytes. Entries over 4 GB or 65,535 files
 * are not possible here (an export is capped far below that).
 */
export function zipStore(entries: readonly ZipEntry[]): Buffer {
  if (entries.length > 0xffff) throw new RangeError('Too many files for one zip');
  const DOS_TIME = 0;
  const DOS_DATE = (46 << 9) | (1 << 5) | 1; // 1 Jan 2026: the content carries the real dates
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const used = new Set<string>();
  for (const entry of entries) {
    let name = safeEntryName(entry.name);
    for (let n = 2; used.has(name); n += 1) name = safeEntryName(`${n}-${entry.name}`);
    used.add(name);
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(entry.data);
    const flags = 0x0800; // UTF-8 names
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(flags), u16(0), u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(nameBytes.length), u16(0), nameBytes]);
    parts.push(local, entry.data);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(flags), u16(0), u16(DOS_TIME), u16(DOS_DATE), u32(crc), u32(entry.data.length), u32(entry.data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]));
    offset += local.length + entry.data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(directory.length), u32(offset), u16(0)]);
  return Buffer.concat([...parts, directory, end]);
}
