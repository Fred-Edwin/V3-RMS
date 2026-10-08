import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A phone screen starts at the app's own header (UI_BUILD_RULES 7a): no drawn clock, signal or battery.
const FRONTEND_ROOT = resolve(__dirname, '../../..');
const SKIP_DIRS = new Set(['node_modules', '.next', 'coverage', 'public']);
const SOURCE_FILE = /\.(ts|tsx)$/;
const FAKE_CLOCK = ['9', '41'].join(':');
const THIS_FILE = __filename;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : sourceFiles(full);
    return SOURCE_FILE.test(name) && full !== THIS_FILE ? [full] : [];
  });
}

describe('no fake phone status bar', () => {
  it('has no drawn clock in frontend source', () => {
    const offenders = sourceFiles(FRONTEND_ROOT).filter((file) => readFileSync(file, 'utf8').includes(FAKE_CLOCK));
    expect(offenders).toEqual([]);
  });

  it('has no MobileStatusBar component or import left', () => {
    const offenders = sourceFiles(FRONTEND_ROOT).filter((file) => /MobileStatusBar|mobile-status-bar/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
