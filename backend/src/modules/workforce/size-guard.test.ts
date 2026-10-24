/**
 * Guard: Workforce stays small. No source file is longer than 350 lines and no folder holds more than 12 files.
 *
 * Source files are `.ts` files that are not tests or `.d.ts`; a folder's count is every file directly inside it (tests and the README
 * included). The allow-lists are today's exceptions (24 Oct 2026, People close-out). They only SHRINK: when a section splits a long file
 * or groups a crowded folder, remove its entry (the test also fails when an entry is stale, so it cannot be forgotten). Never add an
 * entry for new code: split the file or group the folder instead. The front end has the same guard in
 * `frontend/features/workforce/size-guard.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = __dirname; // backend/src/modules/workforce
const MAX_LINES = 350;
const MAX_FILES = 12;

/** file (relative to this folder) -> lines it is allowed to have. */
const ALLOWED_LONG_FILES: Record<string, number> = {};

/** folder (relative to this folder) -> files it is allowed to hold. Each belongs to the section that owns the folder (section 10 clean-up). */
const ALLOWED_CROWDED_FOLDERS: Record<string, number> = {
  'conduct/notices': 21,
  audit: 19,
  'needs-you': 16,
  '_shared/time': 15,
  'conduct/_shared': 15,
  'timesheets/exports': 14,
  '_shared/audit': 14,
  notifications: 13,
  leave: 13,
};

const walk = (dir: string, onFolder: (folder: string, files: string[]) => void): void => {
  const entries = readdirSync(dir, { withFileTypes: true });
  onFolder(dir, entries.filter((e) => e.isFile()).map((e) => e.name));
  for (const entry of entries) if (entry.isDirectory() && entry.name !== 'node_modules') walk(join(dir, entry.name), onFolder);
};

const posix = (path: string): string => relative(ROOT, path).split(sep).join('/');
const isSource = (name: string): boolean => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts');

const longFiles = new Map<string, number>();
const crowdedFolders = new Map<string, number>();
walk(ROOT, (folder, files) => {
  if (files.length > MAX_FILES) crowdedFolders.set(posix(folder), files.length);
  for (const name of files.filter(isSource)) {
    const lines = (readFileSync(join(folder, name), 'utf8').match(/\n/g) ?? []).length; // the same count as `wc -l`
    if (lines > MAX_LINES) longFiles.set(posix(join(folder, name)), lines);
  }
});

describe('workforce size guard (back end)', () => {
  it(`no source file is over ${MAX_LINES} lines except the allow-list`, () => {
    const offenders = [...longFiles].filter(([file, lines]) => lines > (ALLOWED_LONG_FILES[file] ?? MAX_LINES));
    expect(offenders, 'Split the file into files in the same folder, each at most 350 lines.').toEqual([]);
  });

  it(`no folder holds more than ${MAX_FILES} files except the allow-list`, () => {
    const offenders = [...crowdedFolders].filter(([folder, count]) => count > (ALLOWED_CROWDED_FOLDERS[folder] ?? MAX_FILES));
    expect(offenders, 'Group the files into sub-folders named for what they do.').toEqual([]);
  });

  it('the allow-lists have no stale entries (remove or lower an entry when its file or folder shrinks)', () => {
    const staleFiles = Object.entries(ALLOWED_LONG_FILES).filter(([file, allowed]) => (longFiles.get(file) ?? 0) < allowed);
    const staleFolders = Object.entries(ALLOWED_CROWDED_FOLDERS).filter(([folder, allowed]) => (crowdedFolders.get(folder) ?? 0) < allowed);
    expect([...staleFiles, ...staleFolders]).toEqual([]);
  });
});
