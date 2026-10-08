/**
 * Guard: nothing writes the stock ledger except the door (ledger-repository.ts).
 *
 * Fails when app code calls create / createMany / update / updateMany / delete / deleteMany / upsert
 * on `inventoryTransaction`, or writes `inventory_transactions` with raw SQL, outside the door and the
 * allow-list below. The allow-list is today's writers (4 Oct 2026). It only SHRINKS: when a sub-module's
 * rebuild moves a writer onto `postStockMovement`, lower its count here (the test also fails when the
 * list is stale, so it cannot be forgotten). Seed scripts (src/scripts) and tests are not checked.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..', '..'); // backend/src
const DOOR_DIR = join('modules', 'inventory', 'stock', 'ledger');

/** file (relative to backend/src) -> number of direct ledger writes still allowed there. */
const ALLOWED_DIRECT_WRITES: Record<string, number> = {
  'modules/inventory/branch-day/branch-day-repository.ts': 1, // writeAdjustment
  'modules/inventory/dispatch/discrepancy-service.ts': 3,
  'modules/inventory/dispatch/dispatch-service.ts': 2,
};

const PRISMA_WRITE = /inventoryTransaction\s*\.\s*(create|createMany|update|updateMany|delete|deleteMany|upsert)\b/g;
const RAW_SQL_WRITE = /(insert\s+into|update|delete\s+from)\s+"?inventory_transactions\b/gi;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'scripts' && dir === SRC ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [full] : [];
  });

const countWrites = (): Map<string, number> => {
  const found = new Map<string, number>();
  for (const file of sourceFiles(SRC)) {
    const rel = relative(SRC, file);
    if (rel.startsWith(DOOR_DIR + sep)) continue;
    const text = readFileSync(file, 'utf8');
    const hits = (text.match(PRISMA_WRITE)?.length ?? 0) + (text.match(RAW_SQL_WRITE)?.length ?? 0);
    if (hits > 0) found.set(rel.split(sep).join('/'), hits);
  }
  return found;
};

describe('stock ledger guard', () => {
  const found = countWrites();

  it('no code outside the door and the allow-list writes the ledger directly', () => {
    const offenders = [...found].filter(([file, hits]) => hits > (ALLOWED_DIRECT_WRITES[file] ?? 0));
    expect(
      offenders,
      'Post stock movements through postStockMovement (modules/inventory/stock/ledger). Do not add direct inventoryTransaction writes.',
    ).toEqual([]);
  });

  it('the allow-list has no stale entries (shrink it when a writer moves onto the door)', () => {
    const stale = Object.entries(ALLOWED_DIRECT_WRITES).filter(([file, allowed]) => (found.get(file) ?? 0) < allowed);
    expect(stale, 'These files write the ledger less than the allow-list says: lower or remove their entry.').toEqual([]);
  });

  it('the moved writers (Waste, Prep) no longer write the ledger directly', () => {
    expect(found.has('modules/inventory/waste/waste-service.ts')).toBe(false);
    expect(found.has('modules/inventory/prep/prep-service.ts')).toBe(false);
  });

  it('the database append-only bypass (wendo.allow_ledger_edit) is used only by seed scripts', () => {
    // sourceFiles() skips src/scripts, so anything it finds here is application code.
    const leaks = sourceFiles(SRC).filter((file) => {
      if (file === __filename) return false;
      return readFileSync(file, 'utf8').includes('wendo.allow_ledger_edit');
    });
    expect(
      leaks.map((file) => relative(SRC, file)),
      'Application code must never lift the ledger lock; only dev seed scripts (src/scripts) may.',
    ).toEqual([]);
  });
});
