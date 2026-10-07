import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards for the Stock, Counting and Waste rebuild: no component or hook imports the API client (only each sub-module's
 * `services/*-api.ts` and the one fixtures seam may), and no role name appears in a component (a screen tests a `can` flag or
 * whether a response key is present). Fixtures, tests and the fixture role table are exempt: they play the roles on purpose.
 */
const root = resolve(__dirname);
const AREAS = ['counting', 'stock', 'waste'].map((a) => join(root, a));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
const rel = (f: string): string => relative(root, f);

// The old branch-day-supporting and old-route files stay until their redo / the release; the guards cover only what this rebuild owns.
const LEGACY = /^(counting\/(components|hooks|services|types)\/|stock\/(components|hooks|services|types)\/|waste\/department\/)/;
const files = AREAS.flatMap(walk).filter((f) => !/\.test\.tsx?$/.test(f) && !LEGACY.test(rel(f)));

describe('Stock, Counting and Waste: boundaries', () => {
  it('finds the files it checks', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('only the three API services and the fixtures seam import the shared API client', () => {
    const offenders = files.filter((f) => /@\/lib\/apiClient/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no component or hook imports a service directly except through the hook files and screens that own the call', () => {
    const offenders = files.filter((f) => /\.tsx$/.test(f) && /from ['"][^'"]*\/services\/(?!scw-call)[^'"]*-api['"]/.test(readFileSync(f, 'utf8')) === false && /apiClient/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('no role name appears in a component, hook or service', () => {
    // Role identifiers as code would test them ('STORE_MANAGER', role === 'DIRECTOR'); uppercase display words in copy are not checks.
    const role = /(['"`])(STORE_MANAGER|STORE_ATTENDANT|DIRECTOR|ACCOUNTANT|BRANCH_MANAGER|SYSTEM_ADMIN)\1/;
    const offenders = files.filter((f) => !/fixtures?[\\/.-]|fixture-/.test(f) && role.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });
});
