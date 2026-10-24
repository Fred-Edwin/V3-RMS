/**
 * Guard: Workforce and the shell stay small. No source file is longer than 350 lines and no folder holds more than 12 files.
 *
 * Checked: `features/workforce`, `components/app/shell`, `app/app/workforce` and the legacy `app/app/admin` pages. Source files are
 * `.ts` and `.tsx` files that are not tests or `.d.ts`; a folder's count is every file directly inside it. The allow-lists are today's
 * exceptions (24 Oct 2026, People close-out). They only SHRINK: remove an entry when its file is split or its folder grouped (the test
 * also fails when an entry is stale). Never add an entry for new code: split the file or group the folder instead. The back end has
 * the same guard in `backend/src/modules/workforce/size-guard.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const FRONTEND = join(__dirname, '..', '..');
const CHECKED = ['features/workforce', 'components/app/shell', 'app/app/workforce', 'app/app/admin'];
const MAX_LINES = 350;
const MAX_FILES = 12;

/** file (relative to frontend/) -> lines it is allowed to have. The sign sheet is the shell's; the admin pages are legacy, not Workforce. */
const ALLOWED_LONG_FILES: Record<string, number> = {
  'components/app/shell/sign-sheet.tsx': 477,
  'app/app/admin/order-corrections/page.tsx': 1328,
  'app/app/admin/page.tsx': 1081,
  'app/app/admin/menu/page.tsx': 902,
  'app/app/admin/corporate-accounts/page.tsx': 563,
  'app/app/admin/discounts/page.tsx': 485,
  'app/app/admin/house-accounts/page.tsx': 479,
};

/** folder (relative to frontend/) -> files it is allowed to hold. */
const ALLOWED_CROWDED_FOLDERS: Record<string, number> = {};

const walk = (dir: string, onFolder: (folder: string, files: string[]) => void): void => {
  const entries = readdirSync(dir, { withFileTypes: true });
  onFolder(dir, entries.filter((e) => e.isFile()).map((e) => e.name));
  for (const entry of entries) if (entry.isDirectory() && entry.name !== 'node_modules') walk(join(dir, entry.name), onFolder);
};

const posix = (path: string): string => relative(FRONTEND, path).split(sep).join('/');
const isSource = (name: string): boolean => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts');

const longFiles = new Map<string, number>();
const crowdedFolders = new Map<string, number>();
for (const root of CHECKED) {
  walk(join(FRONTEND, root), (folder, files) => {
    if (files.length > MAX_FILES) crowdedFolders.set(posix(folder), files.length);
    for (const name of files.filter(isSource)) {
      const lines = (readFileSync(join(folder, name), 'utf8').match(/\n/g) ?? []).length; // the same count as `wc -l`
      if (lines > MAX_LINES) longFiles.set(posix(join(folder, name)), lines);
    }
  });
}

describe('workforce size guard (front end)', () => {
  it(`no source file is over ${MAX_LINES} lines except the allow-list`, () => {
    const offenders = Array.from(longFiles).filter(([file, lines]) => lines > (ALLOWED_LONG_FILES[file] ?? MAX_LINES));
    expect(offenders, 'Split the file into files in the same folder, each at most 350 lines.').toEqual([]);
  });

  it(`no folder holds more than ${MAX_FILES} files except the allow-list`, () => {
    const offenders = Array.from(crowdedFolders).filter(([folder, count]) => count > (ALLOWED_CROWDED_FOLDERS[folder] ?? MAX_FILES));
    expect(offenders, 'Group the files into sub-folders named for what they do.').toEqual([]);
  });

  it('the allow-lists have no stale entries (remove or lower an entry when its file or folder shrinks)', () => {
    const staleFiles = Object.entries(ALLOWED_LONG_FILES).filter(([file, allowed]) => (longFiles.get(file) ?? 0) < allowed);
    const staleFolders = Object.entries(ALLOWED_CROWDED_FOLDERS).filter(([folder, allowed]) => (crowdedFolders.get(folder) ?? 0) < allowed);
    expect([...staleFiles, ...staleFolders]).toEqual([]);
  });
});
