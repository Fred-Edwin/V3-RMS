/**
 * Contract drift guard for the Stock rebuild: the shared sample payloads parse against the frozen Zod schemas, bad
 * queries are refused, and the front end's copy of the payloads is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './stock-contract.fixtures.json';
import {
  ledgerListSchema,
  ledgerQuerySchema,
  stockCardSchema,
  stockItemsListSchema,
  stockItemsQuerySchema,
  stockOverviewSchema,
} from './stock-contract';

const F = fixtures as Record<string, unknown>;

describe('stock contract fixtures', () => {
  it.each([
    ['stockOverview', stockOverviewSchema],
    ['stockItemsList', stockItemsListSchema],
    ['ledgerList', ledgerListSchema],
    ['stockCard', stockCardSchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'stock-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(
      join(__dirname, '../../../../../../frontend/features/inventory/stock/_shared/types/stock-contract.fixtures.json'),
      'utf8',
    );
    expect(theirs).toBe(mine);
  });
});

describe('stock queries', () => {
  it('rows per page is 25, 50 or 100 and defaults to 50', () => {
    expect(stockItemsQuerySchema.parse({}).pageSize).toBe(50);
    expect(stockItemsQuerySchema.safeParse({ pageSize: '75' }).success).toBe(false);
    expect(ledgerQuerySchema.safeParse({ pageSize: '100' }).success).toBe(true);
  });

  it('dates are Nairobi days', () => {
    expect(ledgerQuerySchema.safeParse({ from: '2026-09-14', to: '2026-10-13' }).success).toBe(true);
    expect(ledgerQuerySchema.safeParse({ from: '14 Sep 2026' }).success).toBe(false);
  });

  it('the ledger chips are the four drawn in step 28', () => {
    expect(ledgerQuerySchema.parse({}).chip).toBe('all');
    expect(ledgerQuerySchema.safeParse({ chip: 'adjustments' }).success).toBe(true);
    expect(ledgerQuerySchema.safeParse({ chip: 'journal' }).success).toBe(false);
  });
});
