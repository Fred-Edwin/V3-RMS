import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { DISPATCH_ERROR_CODES } from './_shared/dispatch-contract';
import { dispatchError } from './dispatch-errors';
import {
  canCancelDispatch,
  doneResultOf,
  dispatchTrackerOf,
  effectiveQty,
  isShort,
  isWaiting,
  mineTabOf,
  nextActionOf,
  packStateOf,
  sentVisibleTo,
  stageOf,
  statusAfterSave,
} from './dispatch-state';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const D = (n: number | string) => new Prisma.Decimal(n);

describe('quantities', () => {
  it('packs the approved quantity, else the requested, else nothing', () => {
    expect(effectiveQty({ approvedQty: D(4), requestedQty: D(5) }).toString()).toBe('4');
    expect(effectiveQty({ approvedQty: null, requestedQty: D(5) }).toString()).toBe('5');
    expect(effectiveQty({ approvedQty: null, requestedQty: null }).toString()).toBe('0');
  });
  it('a line is short only when less is sent than asked', () => {
    expect(isShort(D(4), D(5))).toBe(true);
    expect(isShort(D(5), D(5))).toBe(false);
    expect(isShort(D(0), D(5))).toBe(true);
  });
});

describe('pack state and status after a save', () => {
  it.each([
    [[], 'TO_PACK'],
    [[false, false], 'TO_PACK'],
    [[true, false], 'PACKING'],
    [[true, true], 'PACKED'],
  ] as const)('ticks %j -> %s', (ticks, expected) => {
    expect(packStateOf(ticks.map((packedTick) => ({ packedTick })))).toBe(expected);
  });
  it('any tick makes the dispatch PACKING, none leaves it TO_PACK', () => {
    expect(statusAfterSave([{ packedTick: true }, { packedTick: false }])).toBe('PACKING');
    expect(statusAfterSave([{ packedTick: false }])).toBe('TO_PACK');
  });
});

describe('stageOf (Paper D21, nine states)', () => {
  const stage = (status: Parameters<typeof stageOf>[0]['status'], over: Partial<Parameters<typeof stageOf>[0]> = {}) =>
    stageOf({ status, signedAt: null, allTicked: false, gapHeld: false, ...over }, NOW);
  it.each([
    ['TO_PACK', {}, 'TO_PACK'],
    ['PACKING', {}, 'PACKING'],
    ['PACKING', { allTicked: true }, 'READY_TO_SEND'],
    ['ON_THE_WAY', { signedAt: ago(10) }, 'ON_THE_WAY'],
    ['ON_THE_WAY', { signedAt: ago(120) }, 'ON_THE_WAY'],
    ['ON_THE_WAY', { signedAt: ago(121) }, 'WAITING_FOR_BRANCH'],
    ['CONFIRMED', {}, 'CONFIRMED'],
    ['CONFIRMED', { gapHeld: true }, 'GAP_HELD'],
    ['CLOSED', { gapHeld: true }, 'CLOSED'],
    ['CANCELLED', {}, 'CANCELLED'],
  ] as const)('%s %j -> %s', (status, over, expected) => {
    expect(stage(status, over)).toBe(expected);
  });
  it('the 2-hour clock runs from the final sign, and only while nobody has counted', () => {
    expect(isWaiting({ status: 'ON_THE_WAY', signedAt: ago(500) }, NOW)).toBe(true);
    expect(isWaiting({ status: 'CONFIRMED', signedAt: ago(500) }, NOW)).toBe(false);
    expect(isWaiting({ status: 'ON_THE_WAY', signedAt: null }, NOW)).toBe(false);
  });
});

describe('the Done tab and the Attendant tabs', () => {
  it.each([
    ['CANCELLED', [], 'CANCELLED'],
    ['ON_THE_WAY', [], null],
    ['TO_PACK', [], null],
    ['CONFIRMED', [], 'CONFIRMED'],
    ['CLOSED', [], 'CONFIRMED'],
    ['CONFIRMED', [{ status: 'OPEN' }], 'GAP_FOUND'],
    ['CONFIRMED', [{ status: 'REVERSED' }], 'GAP_FOUND'],
    ['CLOSED', [{ status: 'RECORDED' }], 'GAP_SETTLED'],
    ['CLOSED', [{ status: 'RECORDED' }, { status: 'OPEN' }], 'GAP_FOUND'],
  ] as const)('%s %j -> %s', (status, discrepancies, expected) => {
    expect(doneResultOf(status, [...discrepancies])).toBe(expected);
  });
  it('maps statuses to the Attendant tabs', () => {
    expect(mineTabOf('ON_THE_WAY')).toBe('on-the-way');
    for (const s of ['CONFIRMED', 'CLOSED', 'CANCELLED'] as const) expect(mineTabOf(s)).toBe('done');
    for (const s of ['TO_PACK', 'PACKING'] as const) expect(mineTabOf(s)).toBeNull();
  });
});

describe('the main button of a state', () => {
  const act = (stage: Parameters<typeof nextActionOf>[0]['stage'], over: Partial<Parameters<typeof nextActionOf>[0]> = {}) =>
    nextActionOf({ stage, canPack: false, canRecordFinding: false, canConfirmForDepartment: false, ...over });
  it('the packer packs, then signs; a reader has no button on those', () => {
    expect(act('TO_PACK', { canPack: true })).toBe('PACK');
    expect(act('PACKING', { canPack: true })).toBe('PACK');
    expect(act('READY_TO_SEND', { canPack: true })).toBe('SIGN_AND_SEND');
    expect(act('TO_PACK')).toBeNull();
  });
  it('the Branch Manager confirms for a waiting department; the Store Manager records a finding on a held gap; everyone else prints', () => {
    expect(act('WAITING_FOR_BRANCH', { canConfirmForDepartment: true })).toBe('CONFIRM_FOR_DEPARTMENT');
    expect(act('WAITING_FOR_BRANCH')).toBe('PRINT');
    expect(act('GAP_HELD', { canRecordFinding: true })).toBe('RECORD_A_FINDING');
    expect(act('GAP_HELD')).toBe('PRINT');
    expect(act('ON_THE_WAY')).toBe('PRINT');
    expect(act('CLOSED')).toBe('PRINT');
  });
  it('a cancelled dispatch offers Pack again to the packer only', () => {
    expect(act('CANCELLED', { canPack: true })).toBe('PACK_AGAIN');
    expect(act('CANCELLED')).toBeNull();
  });
});

describe('cancel and the blind rule', () => {
  it('cancel only while On the way and uncounted', () => {
    expect(canCancelDispatch({ status: 'ON_THE_WAY', countedAt: null })).toBe(true);
    expect(canCancelDispatch({ status: 'ON_THE_WAY', countedAt: ago(1) })).toBe(false);
    for (const s of ['TO_PACK', 'PACKING', 'CONFIRMED', 'CLOSED', 'CANCELLED'] as const) expect(canCancelDispatch({ status: s, countedAt: null })).toBe(false);
  });
  it('the branch side sees the sent figure only after the department has counted; the hub always', () => {
    expect(sentVisibleTo({ branchSide: true }, { countedAt: null })).toBe(false);
    expect(sentVisibleTo({ branchSide: true }, { countedAt: ago(1) })).toBe(true);
    expect(sentVisibleTo({ branchSide: false }, { countedAt: null })).toBe(true);
  });
});

describe('the tracker', () => {
  const base = { approvedAt: ago(500), approvedBy: null, packedAt: null, packedBy: null, signedAt: null, signedBy: null, carrier: null, countedAt: null, countedBy: null, closedAt: null };
  it('an on-the-way dispatch is done up to On the way, counting is current', () => {
    const t = dispatchTrackerOf({ ...base, status: 'ON_THE_WAY', packedAt: ago(60), signedAt: ago(60) });
    expect(t.map((s) => [s.key, s.state])).toEqual([['APPROVED', 'DONE'], ['PACKED', 'DONE'], ['ON_THE_WAY', 'DONE'], ['COUNTED', 'CURRENT'], ['CLOSED', 'TODO']]);
  });
  it('a cancelled dispatch has no current step', () => {
    expect(dispatchTrackerOf({ ...base, status: 'CANCELLED', packedAt: ago(60), signedAt: ago(60) }).some((s) => s.state === 'CURRENT')).toBe(false);
  });
  it('an unsigned dispatch is current at Packed', () => {
    expect(dispatchTrackerOf({ ...base, status: 'PACKING' }).find((s) => s.state === 'CURRENT')?.key).toBe('PACKED');
  });
});

describe('every error code of the contract has a status, and the new ones are the Amendment 1 names', () => {
  it.each(DISPATCH_ERROR_CODES)('%s builds an AppError with its own code and a 4xx status', (code) => {
    const e = dispatchError(code, 'x', { lineIds: [] });
    expect(e.code).toBe(code);
    expect(e.statusCode).toBeGreaterThanOrEqual(400);
    expect(e.statusCode).toBeLessThan(500);
  });
  it('INVALID_PIN is 401 like Counting and Requisitions; OVER_REQUESTED is 422; the rest are 409', () => {
    expect(dispatchError('INVALID_PIN', 'x').statusCode).toBe(401);
    expect(dispatchError('OVER_REQUESTED', 'x').statusCode).toBe(422);
    for (const c of ['NOT_ALL_PACKED', 'CARRIER_INACTIVE', 'NOTHING_TO_SEND', 'ALREADY_SIGNED', 'STOCK_CHANGED', 'DISPATCH_ALREADY_COUNTED', 'DISPATCH_CANCELLED', 'CARRIER_NAME_TAKEN', 'NOT_SIGNED', 'REQUISITION_NOT_APPROVED'] as const) {
      expect(dispatchError(c, 'x').statusCode).toBe(409);
    }
  });
});
