import { describe, expect, it } from 'vitest';

import { ApiError } from '@/types/api';
import { block2ErrorMessage, deliveryChip, doneRowChip, onTheWayRowChip, resultChip } from '../../_shared/lib/block2-words';
import type { PackLine, ReviewDepartment } from '../_shared/types/dispatch-contract';
import { askedLine, clampSend, countWord, deliveryNotesText, groupByCategory, maxSend, reviewTotals, shortSummary, signLabel, stillToPackText, waitChip, wentOutText, withEdits } from './pack-logic';

const line = (over: Partial<PackLine>): PackLine => ({
  lineId: 'l1',
  itemId: 'i1',
  itemName: 'Cooking oil 10L',
  unit: 'cans',
  categoryPath: ['Dry items'],
  requestedQty: '2',
  onHand: '1',
  sentQty: '1',
  packedTick: false,
  short: true,
  addedAfterApproval: false,
  ...over,
});

const dept = (over: Partial<ReviewDepartment>): ReviewDepartment => ({ departmentId: 'd1', departmentName: 'Kitchen', lineCount: 12, allTicked: true, canLeaveOut: true, shortCount: 0, shortLines: [], ...over });

describe('packing lines', () => {
  it('lays the packer\'s edits over the server lines and flags short ones', () => {
    const [a] = withEdits([line({ sentQty: '2', requestedQty: '2', onHand: '9' })], { l1: { sentQty: '1', packedTick: true } });
    expect(a?.packedTick).toBe(true);
    expect(a?.short).toBe(true);
    expect(a?.notEnough).toBe(false);
  });
  it('never sends more than asked or more than the store holds', () => {
    expect(maxSend(line({ requestedQty: '2', onHand: '1' }))).toBe(1);
    expect(maxSend(line({ requestedQty: '2', onHand: '9' }))).toBe(2);
    expect(clampSend(line({ requestedQty: '2', onHand: '1' }), 5)).toBe('1');
    expect(clampSend(line({ requestedQty: '2', onHand: '1' }), -3)).toBe('0');
  });
  it('writes the quantity line as Paper does', () => {
    expect(askedLine(line({ requestedQty: '22', onHand: '140', unit: 'portions', itemName: 'Chicken wings (kg)' }), false)).toBe('Asked 22 · In store 140');
    expect(askedLine(line({ requestedQty: '4', onHand: '18', unit: 'bags', itemName: 'Pishori rice' }), false)).toBe('Asked 4 bags · In store 18');
    expect(askedLine(line({}), true)).toBe('Asked 2 · Not enough in store (1)');
  });
  it('groups by category, joining a two-level path', () => {
    const groups = groupByCategory([line({ lineId: 'a', categoryPath: ['Prep kitchen', 'Chicken'] }), line({ lineId: 'b', categoryPath: ['Dry items'] }), line({ lineId: 'c', categoryPath: ['Prep kitchen', 'Chicken'] })]);
    expect(groups.map((g) => [g.heading, g.lines.length])).toEqual([['Prep kitchen · Chicken', 2], ['Dry items', 1]]);
  });
});

describe('the final review', () => {
  const review = { departments: [dept({ shortCount: 1, shortLines: [{ itemName: 'Cooking oil', unit: 'cans', requestedQty: '2', sentQty: '1' }] }), dept({ departmentId: 'd2', departmentName: 'Barista', lineCount: 8 }), dept({ departmentId: 'd3', departmentName: 'Pastry', lineCount: 9, allTicked: false, canLeaveOut: false })] };
  it('counts only departments that ship now', () => {
    const t = reviewTotals(review, new Set());
    expect(t.lineCount).toBe(20);
    expect(t.shortCount).toBe(1);
    expect(t.canSend).toBe(true);
    expect(reviewTotals(review, new Set(['d1'])).lineCount).toBe(8);
  });
  it('blocks leaving everything out', () => {
    expect(reviewTotals(review, new Set(['d1', 'd2'])).canSend).toBe(false);
  });
  it('words the sign button and the notes line', () => {
    const t = reviewTotals(review, new Set());
    expect(signLabel('Nyeri Town', t, false)).toBe('Sign and send 20 lines to Nyeri Town');
    expect(signLabel('Nyeri Town', t, true)).toBe('Sign and send to Nyeri Town');
    expect(deliveryNotesText(5)).toBe('Five delivery notes');
    expect(deliveryNotesText(1)).toBe('One delivery note');
    expect(countWord(12)).toBe('12');
  });
  it('summarises short lines under a department', () => {
    expect(shortSummary(review.departments[0]!)).toEqual({ text: '12 lines · Cooking oil 1 of 2', short: true });
    expect(shortSummary(dept({ shortCount: 3 }))).toEqual({ text: '12 lines · 3 short', short: true });
    expect(shortSummary(dept({}))).toEqual({ text: '12 lines', short: false });
  });
  it('writes the sent screen sentences', () => {
    expect(wentOutText(31, 1, '3:05 pm')).toBe('30 lines in full and 1 short went out at 3:05 pm.');
    expect(wentOutText(40, 0, '3:05 pm')).toBe('40 lines in full went out at 3:05 pm.');
    expect(stillToPackText(['Pastry'])?.line).toBe('Pastry is still to pack. It stays in To pack and ships later with its own review and signature.');
    expect(stillToPackText(['Pastry', 'Service'])?.line).toContain('Pastry and Service are still to pack.');
    expect(stillToPackText([])).toBeNull();
  });
});

describe('the wait chip', () => {
  const now = new Date('2026-10-09T12:00:00Z').getTime();
  it('is grey under 20 minutes and amber from 20', () => {
    expect(waitChip('2026-10-09T11:47:00Z', now)).toEqual({ text: 'Waiting 13 min', amber: false });
    expect(waitChip('2026-10-09T11:31:00Z', now)).toEqual({ text: 'Waiting 29 min', amber: true });
    expect(waitChip('2026-10-09T10:30:00Z', now).text).toBe('Waiting 1 h 30 min');
  });
});

describe('chips and error words', () => {
  it('maps every state to its D22 chip', () => {
    expect(onTheWayRowChip('WAITING_FOR_BRANCH')).toEqual({ text: 'Waiting for the branch', tone: 'warning', dot: true });
    expect(onTheWayRowChip('GAP_HELD').text).toBe('Gap found');
    expect(doneRowChip('GAP_SETTLED').text).toBe('Gap settled');
    expect(deliveryChip('ON_THE_WAY', null).text).toBe('On the way');
    expect(deliveryChip('ON_THE_WAY', '3:28 pm').text).toBe('Arrived · 3:28 pm');
    expect(resultChip('GAP_OPEN', 2)?.text).toBe('2 gaps · open');
    expect(resultChip('GAP_RESOLVED', 1)?.text).toBe('1 gap · resolved');
    expect(resultChip(null, null)).toBeNull();
  });
  it('words known codes, offline and unknown errors', () => {
    expect(block2ErrorMessage(new ApiError('x', 409, 'STOCK_CHANGED'))).toBe('Stock changed while you were packing. Check the lines marked and sign again.');
    expect(block2ErrorMessage(new ApiError('x', 409, 'ALREADY_CONFIRMED', { confirmedByTitle: 'Pastry Department Head', confirmedAtText: '3:35 pm' }))).toBe('Pastry Department Head already confirmed this delivery at 3:35 pm.');
    expect(block2ErrorMessage(new TypeError('fetch failed'))).toBe('No connection. Your counts are kept; try again when you are back online.');
    expect(block2ErrorMessage(new ApiError('x', 500, 'WHATEVER'))).toBe('Something went wrong. Try again.');
  });
});
