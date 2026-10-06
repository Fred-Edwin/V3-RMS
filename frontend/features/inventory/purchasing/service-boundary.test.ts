import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guard: the Purchasing and Receiving screens talk to the server through ONE interface (`services/purchasing-service.ts`) supplied by
 * ONE hook (`hooks/use-purchasing.ts`). Only the HTTP implementation (`services/purchasing-api-service.ts`) may import the shared API
 * client, and only that hook may import the HTTP implementation. The in-browser mock, the demo bar and the demo "view as" role are gone
 * and must stay gone, and so must the old `legacy-payables` code and its calls to the old back-end purchasing routes.
 */
const root = resolve(__dirname, '..');
const purchasing = join(root, 'purchasing');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });

const imports = (file: string): string[] => Array.from(readFileSync(file, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)).map((m) => m[1] as string);
const rel = (file: string): string => relative(root, file);

/** Anything that reaches the real back-end directly: the shared API client, the inventory service barrel, or a feature's `*-api-service`. */
const REAL_API = /(^|\/)(apiClient|services\/index|services)$|api-service|receiving-api|^@\/services|^@\/lib\/apiClient/;
const API_SERVICE = 'purchasing/services/purchasing-api-service.ts';
const HOOK = 'purchasing/hooks/use-purchasing.ts';

describe('Purchasing reaches the server through the service interface only', () => {
  const files = walk(purchasing);
  const supplierTabs = [join(root, 'suppliers/components/supplier-purchasing-tabs.tsx')];

  it('finds the files it is supposed to check', () => {
    expect(files.length).toBeGreaterThan(25);
    expect(existsSync(supplierTabs[0] as string)).toBe(true);
    expect(files.map(rel)).toContain(API_SERVICE);
    expect(files.map(rel)).toContain(HOOK);
  });

  it('no screen, component or hook imports the API client; only the HTTP service does', () => {
    const offenders = [...files, ...supplierTabs]
      .filter((f) => rel(f) !== API_SERVICE && rel(f) !== HOOK)
      .flatMap((f) => imports(f).filter((i) => REAL_API.test(i)).map((i) => `${rel(f)} -> ${i}`));
    expect(offenders).toEqual([]);
  });

  it('only the use-purchasing hook imports the HTTP service', () => {
    const offenders = [...files, ...supplierTabs].filter((f) => rel(f) !== HOOK).flatMap((f) => imports(f).filter((i) => /purchasing-api-service/.test(i)).map((i) => `${rel(f)} -> ${i}`));
    expect(offenders).toEqual([]);
  });

  it('the HTTP service is the one file that may use the shared API client', () => {
    expect(imports(join(root, API_SERVICE))).toContain('@/lib/apiClient');
  });

  it('the in-browser mock, the demo bar, the demo banner and the demo "view as" role are deleted and nothing refers to them', () => {
    for (const gone of ['purchasing/mock', 'purchasing/components/demo-bar.tsx', 'purchasing/components/demo-banner.tsx', '_shared/hooks/use-demo-view.ts']) {
      expect(existsSync(join(root, gone))).toBe(false);
    }
    const hits = walk(root).filter((f) => /\/mock\/|demo-bar|demo-banner|use-demo-view|DemoBar|DemoBanner|createMockPurchasingService/.test(readFileSync(f, 'utf8')));
    expect(hits.map(rel)).toEqual([]);
  });

  it('the supplier page reads what we owe from Purchasing, not from the old back-end', () => {
    const list = [join(root, 'suppliers/hooks/use-supplier-page.ts'), join(root, 'suppliers/components/screens/supplier-page-screen.tsx'), join(root, 'suppliers/components/overview-tab.tsx')];
    const text = list.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(text).not.toMatch(/getSupplierApDetail|legacy-payables|RecordSupplierInvoiceDrawer|RecordSupplierPaymentDrawer/);
  });

  it('legacy-payables is gone and nothing under features refers to it', () => {
    expect(existsSync(join(root, 'suppliers/legacy-payables'))).toBe(false);
    const hits = walk(root).filter((f) => /legacy-payables/.test(readFileSync(f, 'utf8')));
    expect(hits.map(rel)).toEqual([]);
  });
});
