/**
 * Contract drift guard for the Waste rebuild: the shared sample payloads parse against the frozen Zod schemas, bad
 * inputs are refused, an Attendant's payloads carry no stock figure, and the front end's copy is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './waste-contract.fixtures.json';
import {
  BRANCH_WASTE_BLIND_KEYS,
  BRANCH_WASTE_ERROR_CODES,
  allBranchesWasteQuerySchema,
  branchWasteDetailSchema,
  branchWasteItemsSchema,
  branchWasteListQuerySchema,
  branchWasteListSchema,
  logBranchWasteInputSchema,
  logBranchWasteResultSchema,
  logWasteInputSchema,
  logWasteResultSchema,
  myBranchWasteListSchema,
  myBranchWasteQuerySchema,
  reverseBranchWasteInputSchema,
  reverseWasteInputSchema,
  wasteItemsSchema,
  wasteListQuerySchema,
  wasteListSchema,
} from './waste-contract';
import { errorBodySchema } from '../../requisitions/_shared/requisitions-contract';

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
    ['branchWasteItemsMember', branchWasteItemsSchema],
    ['logBranchWasteInput', logBranchWasteInputSchema],
    ['logBranchWasteResultMember', logBranchWasteResultSchema],
    ['myBranchWasteList', myBranchWasteListSchema],
    ['branchWasteListManager', branchWasteListSchema],
    ['allBranchesWasteDirector', branchWasteListSchema],
    ['branchWasteDetailManager', branchWasteDetailSchema],
    ['branchWasteDetailMember', branchWasteDetailSchema],
    ['reverseWasteInput', reverseBranchWasteInputSchema],
    ['reverseWasteInputOther', reverseBranchWasteInputSchema],
    ['errorItemNotInDepartment', errorBodySchema],
    ['errorBranchItemRetired', errorBodySchema],
    ['errorNotYourDepartment', errorBodySchema],
    ['errorBranchNotYourEntry', errorBodySchema],
    ['errorBranchWindowPassed', errorBodySchema],
    ['errorBranchAlreadyReversed', errorBodySchema],
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
    expect(q).not.toHaveProperty('from');
  });

  it('takes the Lane 0 filters, all optional: a Nairobi date range, a reason, a person, logged or reversed', () => {    const q = wasteListQuerySchema.parse({ from: '2026-10-01', to: '2026-10-05', reason: 'EXPIRY', loggedBy: 'u-peter', status: 'reversed' });
    expect(q).toMatchObject({ from: '2026-10-01', to: '2026-10-05', reason: 'EXPIRY', loggedBy: 'u-peter', status: 'reversed' });
    expect(wasteListQuerySchema.safeParse({ from: '1 Oct' }).success).toBe(false);
    expect(wasteListQuerySchema.safeParse({ reason: 'STOLEN' }).success).toBe(false);
    expect(wasteListQuerySchema.safeParse({ status: 'gone' }).success).toBe(false);
  });
});

const keysDeep = (value: unknown, out: Set<string> = new Set()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
};

describe('branch waste: the blind rule in the head and member payloads', () => {
  it.each(['branchWasteItemsMember', 'logBranchWasteResultMember', 'myBranchWasteList', 'branchWasteDetailMember'] as const)(
    '%s carries no money or stock key at any depth',
    (name) => {
      const keys = keysDeep(F[name]);
      for (const blind of BRANCH_WASTE_BLIND_KEYS) expect(keys.has(blind), `${name} has ${blind}`).toBe(false);
    },
  );

  it('the Branch Manager and any-branch payloads carry values and the four figures', () => {
    for (const name of ['branchWasteListManager', 'allBranchesWasteDirector'] as const) {
      const list = branchWasteListSchema.parse(F[name]);
      expect(list.kpis).toHaveLength(4);
      expect(list.rows.every((r) => r.valueKes !== undefined)).toBe(true);
    }
    expect(branchWasteDetailSchema.parse(F.branchWasteDetailManager).ledger).toHaveLength(2);
  });

  it('a reversed entry counts for nothing and the read-only list offers no Reverse', () => {
    const manager = branchWasteListSchema.parse(F.branchWasteListManager);
    expect(manager.rows.find((r) => r.status === 'REVERSED')?.valueKes).toBe('0.00');
    const any = branchWasteListSchema.parse(F.allBranchesWasteDirector);
    expect(any.rows.every((r) => !r.can.reverse)).toBe(true);
    expect(any.branches).toBeDefined();
    expect(branchWasteListSchema.parse(F.branchWasteListManager).branches).toBeUndefined();
  });

  it('the department list shows other people’s entries but offers Reverse only on the caller’s own', () => {
    const list = myBranchWasteListSchema.parse(F.myBranchWasteList);
    expect(new Set(list.rows.map((r) => r.loggedBy.id)).size).toBeGreaterThan(1);
    expect(list.rows.filter((r) => r.can.reverse).every((r) => r.loggedBy.id === 'u-grace')).toBe(true);
  });
});

describe('branch waste: inputs that must be refused', () => {
  it('the department comes from the caller: a location, a department or a PIN is refused (strict)', () => {
    for (const extra of [{ locationId: 'x' }, { departmentId: '30000000-0000-4000-8000-000000000001' }, { pin: '1234' }]) {
      expect(logBranchWasteInputSchema.safeParse({ ...F.logBranchWasteInput as object, ...extra }).success).toBe(false);
    }
  });

  it('a quantity is greater than zero, a batch has one to thirty entries and the reason is one of the four', () => {
    const base = F.logBranchWasteInput as { entries: Array<Record<string, string>>; idempotencyKey: string };
    expect(logBranchWasteInputSchema.safeParse({ ...base, entries: [{ ...base.entries[0], quantity: '0' }] }).success).toBe(false);
    expect(logBranchWasteInputSchema.safeParse({ ...base, entries: [] }).success).toBe(false);
    expect(logBranchWasteInputSchema.safeParse({ ...base, entries: [{ ...base.entries[0], reason: 'STOLEN' }] }).success).toBe(false);
    expect(logBranchWasteInputSchema.safeParse({ ...base, idempotencyKey: 'short' }).success).toBe(false);
  });

  it('a reversal needs a reason, Other needs a note, and there is no PIN', () => {
    expect(reverseBranchWasteInputSchema.safeParse({}).success).toBe(false);
    expect(reverseBranchWasteInputSchema.safeParse({ reason: 'OTHER' }).success).toBe(false);
    expect(reverseBranchWasteInputSchema.safeParse({ reason: 'WRONG_ITEM', pin: '1234' }).success).toBe(false);
  });

  it('the lists default to their windows and refuse a bad date, reason or status', () => {
    expect(myBranchWasteQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 50 });
    expect(branchWasteListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 50 });
    expect(branchWasteListQuerySchema.safeParse({ from: '7 Oct' }).success).toBe(false);
    expect(branchWasteListQuerySchema.safeParse({ reason: 'STOLEN' }).success).toBe(false);
    expect(branchWasteListQuerySchema.safeParse({ status: 'gone' }).success).toBe(false);
    expect(branchWasteListQuerySchema.safeParse({ departmentId: 'kitchen' }).success).toBe(false);
    expect(allBranchesWasteQuerySchema.parse({ branchId: '20000000-0000-4000-8000-000000000001', reason: 'EXPIRY', status: 'reversed' })).toMatchObject({ reason: 'EXPIRY' });
    expect(allBranchesWasteQuerySchema.safeParse({ branchId: 'nyeri' }).success).toBe(false);
  });

  it('the error fixtures use the six branch waste codes', () => {
    const codes = ['errorItemNotInDepartment', 'errorBranchItemRetired', 'errorNotYourDepartment', 'errorBranchNotYourEntry', 'errorBranchWindowPassed', 'errorBranchAlreadyReversed'].map(
      (name) => errorBodySchema.parse(F[name]).error.code,
    );
    expect([...codes].sort()).toEqual([...BRANCH_WASTE_ERROR_CODES].sort());
  });
});
