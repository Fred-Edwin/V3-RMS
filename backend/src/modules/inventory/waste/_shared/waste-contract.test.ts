/**
 * Contract drift guard for the Waste rebuild: the shared sample payloads parse against the frozen Zod schemas, bad
 * inputs are refused, an Attendant's payloads carry no stock figure, and the front end's copy is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './waste-contract.fixtures.json';
import {
  logWasteInputSchema,
  logWasteResultSchema,
  reverseWasteInputSchema,
  wasteItemsSchema,
  wasteListQuerySchema,
  wasteListSchema,
} from './waste-contract';

const F = fixtures as Record<string, unknown>;

describe('waste contract fixtures', () => {
  it.each([
    ['wasteItems', wasteItemsSchema],
    ['wasteItemsManager', wasteItemsSchema],
    ['logWasteInput', logWasteInputSchema],
    ['logWasteResultAttendant', logWasteResultSchema],
    ['wasteListManager', wasteListSchema],
    ['wasteListAttendant', wasteListSchema],
    ['reverseWasteInput', reverseWasteInputSchema],
    ['reverseWasteInputOther', reverseWasteInputSchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'waste-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(
      join(__dirname, '../../../../../../frontend/features/inventory/waste/_shared/types/waste-contract.fixtures.json'),
      'utf8',
    );
    expect(theirs).toBe(mine);
  });
});

describe('the blind rule in the Attendant payloads', () => {
  it('the Attendant item picker and log result carry no on-hand or "went negative" key', () => {
    for (const option of [...fixtures.wasteItems.often, ...fixtures.wasteItems.items]) expect(Object.keys(option)).not.toContain('onHand');
    expect(Object.keys(fixtures.logWasteResultAttendant)).not.toContain('wentNegative');
  });

  it('the Attendant list has no KPI strip', () => {
    expect(Object.keys(fixtures.wasteListAttendant)).not.toContain('kpis');
  });

  it('the Manager picker may carry on-hand', () => {
    expect(Object.keys(fixtures.wasteItemsManager.items[0]!)).toContain('onHand');
  });
});

describe('inputs that must be refused', () => {
  it('a quantity is greater than zero', () => {
    const bad = { ...fixtures.logWasteInput, entries: [{ inventoryItemId: '10000000-0000-4000-8000-000000000060', quantity: '0', reason: 'EXPIRY' }] };
    expect(logWasteInputSchema.safeParse(bad).success).toBe(false);
  });

  it('a location is never sent (the schema is strict)', () => {
    expect(logWasteInputSchema.safeParse({ ...fixtures.logWasteInput, locationId: 'x' }).success).toBe(false);
  });

  it('a reversal needs a reason, and "Other" needs a note', () => {
    expect(reverseWasteInputSchema.safeParse({}).success).toBe(false);
    expect(reverseWasteInputSchema.safeParse({ reason: 'OTHER' }).success).toBe(false);
  });

  it('waste is never signed with a PIN', () => {
    expect(reverseWasteInputSchema.safeParse({ reason: 'WRONG_ITEM', pin: '1234' }).success).toBe(false);
  });

  it('the list defaults to today, everyone, 50 rows', () => {
    const q = wasteListQuerySchema.parse({});
    expect(q).toMatchObject({ period: 'today', scope: 'all', page: 1, pageSize: 50 });
  });
});
