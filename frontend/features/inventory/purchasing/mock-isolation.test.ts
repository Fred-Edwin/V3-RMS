import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: the Purchasing and Receiving screens run on the in-browser mock only. None of them (and none of the supplier-page code that
 * now shows the mock's orders, owing and statement) may import the real inventory API services, and the old `legacy-payables` code
 * and its calls to the old back-end purchasing routes must stay deleted.
 */
const root = resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });

const imports = (file: string): string[] => Array.from(readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1] as string);

/** Anything that reaches the real back-end: the shared API client, the inventory service barrel, or a feature's `*-api-service`. */
const REAL_API = /(^|\/)(apiClient|services\/index|services)$|api-service|receiving-api|^@\/services|^@\/lib\/apiClient/;

describe('Purchasing runs on the mock only', () => {
  const purchasing = walk(join(root, 'purchasing'));
  const supplierTabs = [join(root, 'suppliers/components/supplier-purchasing-tabs.tsx')];

  it('finds the files it is supposed to check', () => {
    expect(purchasing.length).toBeGreaterThan(30);
    expect(existsSync(supplierTabs[0] as string)).toBe(true);
  });

  it('no purchasing screen, hook, service or mock file imports a real API service', () => {
    const offenders = [...purchasing, ...supplierTabs].flatMap((f) => imports(f).filter((i) => REAL_API.test(i)).map((i) => `${f.replace(root, '')} -> ${i}`));
    expect(offenders).toEqual([]);
  });

  it('the supplier page no longer reads what we owe from the old back-end', () => {
    const files = [join(root, 'suppliers/hooks/use-supplier-page.ts'), join(root, 'suppliers/components/screens/supplier-page-screen.tsx'), join(root, 'suppliers/components/overview-tab.tsx')];
    const text = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(text).not.toMatch(/getSupplierApDetail|legacy-payables|RecordSupplierInvoiceDrawer|RecordSupplierPaymentDrawer/);
  });

  it('legacy-payables is gone and nothing under features, app or docs of the feature refers to it', () => {
    expect(existsSync(join(root, 'suppliers/legacy-payables'))).toBe(false);
    const hits = walk(root).filter((f) => /legacy-payables/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
