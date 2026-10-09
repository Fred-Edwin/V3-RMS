/**
 * Contract drift guard for Dispatch (P1 to P10): the shared sample payloads parse against the frozen Zod schemas, bad inputs are
 * refused, the blind and money rules hold in the payloads, and the front end's copy of the fixtures is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './dispatch-contract.fixtures.json';
import {
  addCarrierInputSchema,
  cancelDispatchInputSchema,
  cancelDispatchResultSchema,
  carrierSchema,
  dispatchFileSchema,
  dispatchMineQuerySchema,
  dispatchMineSchema,
  DISPATCH_ERROR_CODES,
  DISPATCH_STAGES,
  DISPATCH_STAGE_TEXT,
  errorBodySchema,
  listCarriersQuerySchema,
  listCarriersSchema,
  packDepartmentSchema,
  printDispatchQuerySchema,
  printDispatchSchema,
  queueSchema,
  reviewSchema,
  savePackLinesInputSchema,
  signDispatchInputSchema,
  signDispatchResultSchema,
  updateCarrierInputSchema,
} from './dispatch-contract';

const F = fixtures as Record<string, unknown>;

describe('dispatch contract fixtures', () => {
  it.each([
    ['queue', queueSchema],
    ['packDepartment', packDepartmentSchema],
    ['savePackLinesInput', savePackLinesInputSchema],
    ['review', reviewSchema],
    ['signInput', signDispatchInputSchema],
    ['signInputLeaveOut', signDispatchInputSchema],
    ['signResult', signDispatchResultSchema],
    ['fileHub', dispatchFileSchema],
    ['fileAttendantOnTheWay', dispatchFileSchema],
    ['fileBranchManagerBlind', dispatchFileSchema],
    ['printStore', printDispatchSchema],
    ['printBranch', printDispatchSchema],
    ['printQuery', printDispatchQuerySchema],
    ['cancelInput', cancelDispatchInputSchema],
    ['cancelResult', cancelDispatchResultSchema],
    ['mineQuery', dispatchMineQuerySchema],
    ['mine', dispatchMineSchema],
    ['listCarriersQuery', listCarriersQuerySchema],
    ['listCarriers', listCarriersSchema],
    ['addCarrierInput', addCarrierInputSchema],
    ['addCarrierResult', carrierSchema],
    ['renameCarrierInput', updateCarrierInputSchema],
    ['retireCarrierInput', updateCarrierInputSchema],
    ['errorNotAllPacked', errorBodySchema],
    ['errorInvalidPin', errorBodySchema],
    ['errorCarrierInactive', errorBodySchema],
    ['errorNothingToSend', errorBodySchema],
    ['errorAlreadyCounted', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(5);
    for (const name of errorFixtures) {
      const code = (F[name] as { error: { code: string } }).error.code;
      expect(DISPATCH_ERROR_CODES as readonly string[]).toContain(code);
    }
  });

  it('the contract lists the four codes dispatch-contract.md names for P5', () => {
    expect(DISPATCH_ERROR_CODES).toEqual(expect.arrayContaining(['NOT_ALL_PACKED', 'INVALID_PIN', 'CARRIER_INACTIVE', 'NOTHING_TO_SEND']));
  });

  it('the front-end copy of the fixtures is identical', () => {
    const mine = readFileSync(join(__dirname, 'dispatch-contract.fixtures.json'), 'utf8');
    const theirs = readFileSync(join(__dirname, '../../../../../../frontend/features/inventory/dispatch/_shared/types/dispatch-contract.fixtures.json'), 'utf8');
    expect(theirs).toBe(mine);
  });
});

/** Every key anywhere in a payload. */
const allKeys = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
};
const MONEY = /value|kes|cost|price/i;

describe('money rules in the payloads', () => {
  it('the Attendant and packing payloads carry no money anywhere', () => {
    for (const name of ['queue', 'packDepartment', 'review', 'signResult', 'fileAttendantOnTheWay', 'printStore', 'printBranch', 'mine', 'cancelResult']) {
      expect(allKeys(F[name]).filter((k) => MONEY.test(k)), name).toEqual([]);
    }
  });

  it('a money field is absent, not null, without the capability, and present with it', () => {
    expect(Object.keys(fixtures.fileAttendantOnTheWay)).not.toContain('valueKes');
    expect(Object.keys(fixtures.fileHub)).toContain('valueKes');
    expect(Object.keys(fixtures.fileHub.items[0]!)).toEqual(expect.arrayContaining(['unitCostKes', 'valueKes']));
    expect(Object.keys(fixtures.fileAttendantOnTheWay.items[0]!)).not.toContain('unitCostKes');
  });

  it('the delivery notes carry no money', () => {
    expect(allKeys(fixtures.printStore).filter((k) => MONEY.test(k))).toEqual([]);
    expect(allKeys(fixtures.printBranch).filter((k) => MONEY.test(k))).toEqual([]);
  });
});

describe('blind rules in the payloads', () => {
  it('a branch-side file before the count carries no sent figure, no gap, and no money total', () => {
    const file = fixtures.fileBranchManagerBlind;
    expect(file.sentVisible).toBe(false);
    expect(file.counted).toBeNull();
    const keys = allKeys(file);
    expect(keys).not.toContain('sentQty');
    expect(keys).not.toContain('gapQty');
    expect(keys).not.toContain('valueKes');
  });

  it('a hub-side file shows sent quantities and says so', () => {
    expect(fixtures.fileAttendantOnTheWay.sentVisible).toBe(true);
    expect(fixtures.fileAttendantOnTheWay.items.every((i) => 'sentQty' in i)).toBe(true);
  });

  it('the branch copy of the delivery note has no quantities; the store copy has them', () => {
    const branchKeys = allKeys(fixtures.printBranch);
    expect(branchKeys).not.toContain('sentQty');
    expect(branchKeys).not.toContain('requestedQty');
    expect(Object.keys(fixtures.printStore.lines[0]!)).toEqual(expect.arrayContaining(['requestedQty', 'sentQty']));
    // The schema itself refuses a quantity on the branch copy's lines only by omission, so the union is pinned by `copy`.
    expect(printDispatchSchema.safeParse({ ...fixtures.printBranch, copy: 'store' }).success).toBe(false);
  });
});

describe('inputs that must be refused', () => {
  it('the final signature needs a carrier, a four digit PIN and a key, and refuses unknown keys', () => {
    expect(signDispatchInputSchema.safeParse({ ...fixtures.signInput, pin: '12' }).success).toBe(false);
    expect(signDispatchInputSchema.safeParse({ carrierId: fixtures.signInput.carrierId, pin: '4821' }).success).toBe(false);
    expect(signDispatchInputSchema.safeParse({ ...fixtures.signInput, extra: 1 }).success).toBe(false);
    expect(signDispatchInputSchema.safeParse({ ...fixtures.signInput, carrierId: 'van' }).success).toBe(false);
  });

  it('leaveOut is optional, holds department ids, and lists a department once', () => {
    const [a] = fixtures.signInputLeaveOut.leaveOut;
    expect(signDispatchInputSchema.safeParse(fixtures.signInput).success).toBe(true);
    expect(signDispatchInputSchema.safeParse({ ...fixtures.signInput, leaveOut: [a, a] }).success).toBe(false);
    expect(signDispatchInputSchema.safeParse({ ...fixtures.signInput, leaveOut: ['pastry'] }).success).toBe(false);
  });

  it('a saved pack line has a non-negative sent quantity and a line is listed once', () => {
    const line = fixtures.savePackLinesInput.lines[0]!;
    expect(savePackLinesInputSchema.safeParse({ lines: [{ ...line, sentQty: '-1' }] }).success).toBe(false);
    expect(savePackLinesInputSchema.safeParse({ lines: [{ ...line, sentQty: '0' }] }).success).toBe(true);
    expect(savePackLinesInputSchema.safeParse({ lines: [line, line] }).success).toBe(false);
    expect(savePackLinesInputSchema.safeParse({ lines: [] }).success).toBe(false);
  });

  it('a cancel needs a reason and a PIN', () => {
    expect(cancelDispatchInputSchema.safeParse({ pin: '4821' }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ reason: 'no', pin: '4821' }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ reason: 'Wrong carrier', pin: 'abcd' }).success).toBe(false);
  });

  it('a carrier update is a rename or a retire or restore, never both and never neither', () => {
    expect(updateCarrierInputSchema.safeParse({ name: 'New name', active: false }).success).toBe(false);
    expect(updateCarrierInputSchema.safeParse({}).success).toBe(false);
    expect(updateCarrierInputSchema.safeParse({ active: true }).success).toBe(true);
    expect(addCarrierInputSchema.safeParse({ name: 'Van', kind: 'TRUCK' }).success).toBe(false);
  });

  it('the Done tab defaults, pages by 25, 50 or 100, and refuses another tab', () => {
    expect(dispatchMineQuerySchema.parse({})).toMatchObject({ tab: 'done', page: 1, pageSize: 50 });
    expect(dispatchMineQuerySchema.safeParse({ tab: 'to-pack' }).success).toBe(false);
    expect(dispatchMineQuerySchema.safeParse({ pageSize: 10 }).success).toBe(false);
  });

  it('the delivery note copy is store or branch', () => {
    expect(printDispatchQuerySchema.safeParse({ copy: 'both' }).success).toBe(false);
    expect(printDispatchQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe('words and stages', () => {
  it('D21 draws eight states plus the quiet Confirmed between a clean count and Closed; every stage has a name', () => {
    expect(Object.keys(DISPATCH_STAGE_TEXT).sort()).toEqual([...DISPATCH_STAGES].sort());
    expect(DISPATCH_STAGE_TEXT.WAITING_FOR_BRANCH).toBe('Waiting for the branch');
    expect(DISPATCH_STAGE_TEXT.GAP_HELD).toBe('Gap held');
  });

  it('the leave-out result keeps the left-out department in To pack: it is reported, not shipped', () => {
    expect(fixtures.signResult.leftOut).toHaveLength(1);
    const shipped = fixtures.signResult.dispatches.map((d) => d.departmentId);
    expect(shipped).not.toContain(fixtures.signResult.leftOut[0]!.id);
  });
});
