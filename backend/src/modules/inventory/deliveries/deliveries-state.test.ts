import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { DELIVERY_ERROR_CODES } from './_shared/deliveries-contract';
import { deliveryError } from './deliveries-errors';
import {
  canCheck,
  checkLine,
  confirmBlockerOf,
  deliveryResultOf,
  differs,
  directionOf,
  gapOf,
  isFinal,
  isLockedLine,
  isOnBehalf,
  lineStateOf,
  visibleDirectionOf,
  type CountFacts,
} from './deliveries-state';

const D = (n: number | string) => new Prisma.Decimal(n);
const line = (sent: number, counted: number | null, checkCount: number): CountFacts => ({ sentQty: D(sent), countedQty: counted === null ? null : D(counted), checkCount });

describe('what a line shows', () => {
  it.each([
    // sent, counted, checks, state
    [10, null, 0, 'NOT_COUNTED'],
    [10, 10, 0, 'COUNTED'], // typed, not checked yet: no comparison has happened
    [10, 8, 0, 'COUNTED'], // a differing number is not flagged until the check
    [10, 8, 1, 'COUNT_AGAIN'],
    [10, 10, 1, 'COUNTED'], // counted again and it now matches
    [10, 8, 2, 'SHORT'],
    [10, 12, 2, 'EXTRA'],
    [10, 10, 2, 'COUNTED'], // a match is final at once
    [10, 0, 2, 'SHORT'], // 0 is a valid count
  ] as const)('sent %s counted %s after %s checks is %s', (sent, counted, checks, state) => {
    expect(lineStateOf(line(sent, counted, checks))).toBe(state);
  });
});

describe('the blind rule on direction', () => {
  it('the direction is told only after a check has flagged the line, never before', () => {
    expect(visibleDirectionOf(line(10, 8, 0))).toBeNull();
    expect(visibleDirectionOf(line(10, 8, 1))).toBe('SHORT');
    expect(visibleDirectionOf(line(10, 12, 1))).toBe('EXTRA');
    expect(visibleDirectionOf(line(10, 12, 2))).toBe('EXTRA');
    expect(visibleDirectionOf(line(10, 10, 2))).toBeNull();
  });
  it('direction and difference compare counted with sent', () => {
    expect(directionOf(line(10, 8, 2))).toBe('SHORT');
    expect(directionOf(line(10, 11, 2))).toBe('EXTRA');
    expect(directionOf(line(10, 10, 2))).toBeNull();
    expect(directionOf(line(10, null, 0))).toBeNull();
    expect(differs(line(10, 10, 0))).toBe(false);
    expect(differs(line(10, 9.5, 0))).toBe(true);
    expect(gapOf({ sentQty: D(20), countedQty: D(18) }).toString()).toBe('-2');
    expect(gapOf({ sentQty: D(24), countedQty: D(26) }).toString()).toBe('2');
  });
});

describe('the check: two passes, the second count is final', () => {
  it.each([
    // sent, counted, checks before, checks after, countedTwice
    [10, 10, 0, 2, false], // matches the first time: passes silently and is locked
    [10, 8, 0, 1, false], // differs the first time: flagged once
    [10, 10, 1, 2, true], // flagged, counted again, now matches
    [10, 8, 1, 2, true], // flagged, counted again, still differs: final
    [10, 8, 2, 2, false], // already final: untouched
    [10, 10, 2, 2, false],
  ] as const)('sent %s counted %s with %s checks goes to %s', (sent, counted, before, after, twice) => {
    expect(checkLine(line(sent, counted, before))).toEqual({ checkCount: after, countedTwice: twice });
  });
  it('a line with no number is never checked', () => {
    expect(checkLine(line(10, null, 0))).toEqual({ checkCount: 0, countedTwice: false });
  });
  it('never takes more than two checks to decide a line', () => {
    let l = line(10, 7, 0);
    for (let i = 0; i < 5; i += 1) l = { ...l, checkCount: checkLine(l).checkCount };
    expect(l.checkCount).toBe(2);
  });
  it('a final line cannot be saved over (RECOUNT_USED)', () => {
    expect(isFinal(line(10, 8, 2))).toBe(true);
    expect(isLockedLine(line(10, 10, 2))).toBe(true);
    expect(isLockedLine(line(10, 8, 1))).toBe(false);
    expect(isLockedLine(line(10, 8, 0))).toBe(false);
  });
});

describe('Check and sign, and what stops a confirm', () => {
  it('Check and sign needs every line to have a number; 0 is a number, an empty box is not', () => {
    expect(canCheck([{ countedQty: D(0) }, { countedQty: D(3) }])).toBe(true);
    expect(canCheck([{ countedQty: D(0) }, { countedQty: null }])).toBe(false);
    expect(canCheck([])).toBe(false);
  });
  const withReason = (l: CountFacts, hasReason: boolean) => ({ ...l, hasReason });
  it.each([
    ['a line with no count', [withReason(line(10, null, 0), false)], 'NOT_COUNTED'],
    ['a flagged line not counted again', [withReason(line(10, 8, 1), false)], 'COUNT_AGAIN_PENDING'],
    ['typed but never checked', [withReason(line(10, 10, 0), false)], 'COUNT_AGAIN_PENDING'],
    ['a final difference without a reason', [withReason(line(10, 8, 2), false)], 'REASON_REQUIRED'],
    ['all final and every difference has a reason', [withReason(line(10, 8, 2), true), withReason(line(5, 5, 2), false)], null],
    ['everything matched', [withReason(line(10, 10, 2), false)], null],
  ] as const)('%s', (_name, lines, blocker) => {
    expect(confirmBlockerOf([...lines])).toBe(blocker);
  });
  it('a missing count is reported before a pending recount, and that before a missing reason', () => {
    expect(confirmBlockerOf([{ ...line(10, null, 0), hasReason: false }, { ...line(10, 8, 1), hasReason: false }])).toBe('NOT_COUNTED');
    expect(confirmBlockerOf([{ ...line(10, 8, 1), hasReason: false }, { ...line(10, 8, 2), hasReason: false }])).toBe('COUNT_AGAIN_PENDING');
  });
});

describe('who signs, and the result chip', () => {
  it('the Branch Manager signs on behalf of a department they do not belong to; a member signs for their own', () => {
    expect(isOnBehalf({ role: 'MANAGER', departmentId: null }, 'kitchen')).toBe(true);
    expect(isOnBehalf({ role: 'BARISTA', departmentId: 'kitchen' }, 'kitchen')).toBe(false);
    expect(isOnBehalf({ role: 'MANAGER', departmentId: 'kitchen' }, 'kitchen')).toBe(false);
  });
  it.each([
    [[], 'MATCHED'],
    [[{ status: 'OPEN' }], 'GAP_OPEN'],
    [[{ status: 'RECORDED' }, { status: 'OPEN' }], 'GAP_OPEN'],
    [[{ status: 'REVERSED' }], 'GAP_OPEN'],
    [[{ status: 'RECORDED' }, { status: 'RECORDED' }], 'GAP_RESOLVED'],
  ] as const)('discrepancies %j give %s', (discrepancies, result) => {
    expect(deliveryResultOf([...discrepancies])).toBe(result);
  });
});

describe('error codes', () => {
  it.each(DELIVERY_ERROR_CODES.filter((c) => c !== 'INVALID_PIN'))('%s has a status and keeps its code', (code) => {
    const e = deliveryError(code, 'message');
    expect(e.code).toBe(code);
    expect(e.statusCode).toBeGreaterThanOrEqual(400);
  });
  it('the statuses are the ones the contract documents', () => {
    expect(deliveryError('NOT_YOUR_DEPARTMENT', 'x').statusCode).toBe(403);
    expect(deliveryError('ON_BEHALF_NOT_ALLOWED', 'x').statusCode).toBe(403);
    expect(deliveryError('PHOTO_TYPE_NOT_ALLOWED', 'x').statusCode).toBe(415);
    expect(deliveryError('PHOTO_TOO_LARGE', 'x').statusCode).toBe(413);
    expect(deliveryError('REASON_REQUIRED', 'x').statusCode).toBe(422);
    for (const code of ['ALREADY_CONFIRMED', 'NOT_COUNTED', 'RECOUNT_USED', 'DISPATCH_CANCELLED', 'TOO_MANY_PHOTOS', 'NOT_ON_THE_WAY', 'COUNT_AGAIN_PENDING', 'LINE_NOT_DIFFERENT'] as const) {
      expect(deliveryError(code, 'x').statusCode).toBe(409);
    }
  });
});
