/**
 * Contract drift guard for Dispatch (P1 to P10): the shared sample payloads parse against the frozen Zod schemas, bad inputs are
 * refused, the blind and money rules hold in the payloads, and the front end's copy of the fixtures is byte-identical.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixtures from './dispatch-contract.fixtures.json';
import { DISPATCH_DERIVED_STATE_VALUES, DISPATCH_STATUS_VALUES } from '../../requisitions/_shared/requisitions-contract';
import { DELIVERY_ERROR_CODES } from '../../deliveries/_shared/deliveries-contract';
import { DISCREPANCY_CHANGED_EVENT, DISCREPANCY_ERROR_CODES } from '../../discrepancies/_shared/discrepancies-contract';
import {
  addCarrierInputSchema,
  CARRIER_KINDS,
  DELIVERY_RESULTS,
  DISPATCH_CANCEL_PRESETS,
  DISPATCH_CHANGED_EVENT,
  DISPATCH_DONE_RESULTS,
  DISPATCH_STATUSES,
  PACK_WAITING_CHIP_AFTER_MINUTES,
  WAITING_FOR_BRANCH_AFTER_HOURS,
  dispatchChangedPayloadSchema,
  parseDispatchCancelReason,
  photoRefSchema,
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
    ['cancelInputBarePreset', cancelDispatchInputSchema],
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
    ['errorDispatchAlreadyCounted', errorBodySchema],
    ['errorAlreadySigned', errorBodySchema],
    ['errorStockChanged', errorBodySchema],
    ['errorDispatchCancelled', errorBodySchema],
  ] as const)('%s parses', (name, schema) => {
    const result = schema.safeParse(F[name]);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('every error fixture uses a code the contract lists', () => {
    const errorFixtures = Object.keys(F).filter((name) => name.startsWith('error'));
    expect(errorFixtures).toHaveLength(8);
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

  it('a cancel needs a reason, a PIN and an idempotency key', () => {
    const key = 'cancel-dsp-nyr-0233-a9';
    expect(cancelDispatchInputSchema.safeParse({ pin: '4821', idempotencyKey: key }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ reason: 'no', pin: '4821', idempotencyKey: key }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ reason: 'Packed the wrong lines', pin: 'abcd', idempotencyKey: key }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ reason: 'Packed the wrong lines', pin: '4821' }).success).toBe(false);
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

/** Dispatch Amendment 1 (docs/features/inventory/dispatch-amendment-1.md): every new field and rule is pinned. */
describe('Amendment 1', () => {
  it('row 1: the clock runs from signedAt; arrivedAt is separate and nullable', () => {
    for (const file of [fixtures.fileHub, fixtures.fileAttendantOnTheWay, fixtures.fileBranchManagerBlind]) {
      expect(Object.keys(file)).toEqual(expect.arrayContaining(['arrivedAt', 'packedAt', 'countedById', 'countedAt', 'onBehalf']));
    }
    expect(fixtures.fileBranchManagerBlind.arrivedAt).toBeNull();
    expect(fixtures.fileBranchManagerBlind.nextStep.facts.waitingSince).toBe(fixtures.fileBranchManagerBlind.signed.at);
    expect(WAITING_FOR_BRANCH_AFTER_HOURS).toBe(2);
    expect(PACK_WAITING_CHIP_AFTER_MINUTES).toBe(20);
  });

  it('row 2: go to the review once one department is ticked; a ticked department can be left out; the sign result counts departments', () => {
    expect(Object.keys(fixtures.packDepartment)).toContain('canReview');
    for (const d of fixtures.review.departments) expect(Object.keys(d)).toEqual(expect.arrayContaining(['allTicked', 'canLeaveOut']));
    expect(fixtures.signResult.sentDepartments).toBeLessThanOrEqual(fixtures.signResult.totalDepartments);
    expect(fixtures.signResult.sentDepartments + fixtures.signResult.leftOut.length).toBe(fixtures.signResult.totalDepartments);
  });

  it('row 4: carrier kinds are Person, Vehicle and Courier company', () => {
    expect(CARRIER_KINDS).toEqual(['PERSON', 'VEHICLE', 'COMPANY']);
    expect(addCarrierInputSchema.safeParse({ name: 'Kenya Couriers Ltd', kind: 'COMPANY' }).success).toBe(true);
    expect(fixtures.listCarriers.carriers.some((c) => c.kind === 'COMPANY')).toBe(true);
  });

  it('row 6: a photo is { id, url } and nothing else', () => {
    expect(photoRefSchema.safeParse({ id: '90000000-0000-4000-8000-000000000001', url: '/x' }).success).toBe(true);
    expect(photoRefSchema.parse({ id: '90000000-0000-4000-8000-000000000001', url: '/x', fileName: 'a.jpg' })).toEqual({ id: '90000000-0000-4000-8000-000000000001', url: '/x' });
  });

  it('row 8: the cancel reason is "preset — note"; Other needs a note; a bare preset is allowed', () => {
    expect(DISPATCH_CANCEL_PRESETS).toEqual(['Packed the wrong lines', 'Branch asked us to stop', 'Vehicle did not leave', 'Other']);
    const base = { pin: '4821', idempotencyKey: 'cancel-dsp-nyr-0233-b1' };
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Branch asked us to stop' }).success).toBe(true);
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Branch asked us to stop — the Kitchen closed early' }).success).toBe(true);
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Other' }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Other — ' }).success).toBe(false);
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Other — the carrier fell ill' }).success).toBe(true);
    expect(cancelDispatchInputSchema.safeParse({ ...base, reason: 'Changed my mind' }).success).toBe(false);
    expect(parseDispatchCancelReason('Vehicle did not leave — flat tyre')).toEqual({ preset: 'Vehicle did not leave', note: 'flat tyre' });
  });

  it('row 10: the Done chips and the delivery results are the amendment words', () => {
    expect(DISPATCH_DONE_RESULTS).toEqual(['CONFIRMED', 'GAP_FOUND', 'GAP_SETTLED', 'CANCELLED']);
    expect(DELIVERY_RESULTS).toEqual(['MATCHED', 'GAP_OPEN', 'GAP_RESOLVED']);
    expect(fixtures.mine.rows.map((r) => r.result)).toEqual(['GAP_FOUND', 'CONFIRMED']);
  });

  it('row 10: a delivery note carries the VOID band date, null unless voided', () => {
    expect(fixtures.printStore.cancelledAt).toBeNull();
    expect(printDispatchSchema.safeParse({ ...fixtures.printStore, voided: true, cancelledAt: '2026-10-08T12:20:00.000Z' }).success).toBe(true);
  });

  it('row 10: the requisition contract repeats the status and derived-state lists exactly', () => {
    expect([...DISPATCH_STATUS_VALUES]).toEqual([...DISPATCH_STATUSES]);
    expect([...DISPATCH_DERIVED_STATE_VALUES]).toEqual([...DISPATCH_STAGES]);
  });

  it('row 11: the three contracts together list all thirteen codes of the amendment', () => {
    const all = new Set<string>([...DISPATCH_ERROR_CODES, ...DELIVERY_ERROR_CODES, ...DISCREPANCY_ERROR_CODES]);
    for (const code of [
      'ALREADY_CONFIRMED',
      'NOT_COUNTED',
      'RECOUNT_USED',
      'REASON_REQUIRED',
      'NOT_YOUR_DEPARTMENT',
      'DISPATCH_CANCELLED',
      'PHOTO_TOO_LARGE',
      'TOO_MANY_PHOTOS',
      'ALREADY_SIGNED',
      'STOCK_CHANGED',
      'DISPATCH_ALREADY_COUNTED',
      'CARRIER_NAME_TAKEN',
      'FINDING_NOT_REVERSIBLE',
    ]) {
      expect(all.has(code), code).toBe(true);
    }
  });

  it('row 11: STOCK_CHANGED names the affected lines', () => {
    expect(fixtures.errorStockChanged.error.details.lineIds.length).toBeGreaterThan(0);
  });

  it('row 16: the socket event names and the payload', () => {
    expect(DISPATCH_CHANGED_EVENT).toBe('dispatch:changed');
    expect(DISCREPANCY_CHANGED_EVENT).toBe('discrepancy:changed');
    expect(dispatchChangedPayloadSchema.safeParse({ id: '50000000-0000-4000-8000-000000000001', reference: 'DSP-NYR-0231', siteId: 'hub', reason: 'dispatch.signed' }).success).toBe(true);
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
