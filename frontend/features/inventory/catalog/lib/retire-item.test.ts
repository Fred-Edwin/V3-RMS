import { describe, expect, it } from 'vitest';

import { composeRetireReason, retireTouches } from './retire-item';

const review = { inventoryItemId: 'i', itemName: 'Sugar', onHandQty: '0', locationsHoldingStock: 0, stockEntries: 0, receipts: 0, receiptLines: 0, openOrders: 0, hasHistory: false };

describe('composeRetireReason', () => {
  it('joins the reason and the replacement', () => {
    expect(composeRetireReason('Added twice', '', 'Brown sugar')).toBe('Added twice. Replaced by Brown sugar.');
    expect(composeRetireReason('No longer sold', '', null)).toBe('No longer sold.');
  });
  it('needs words for Other and a reason at all', () => {
    expect(composeRetireReason('Other', '  ', null)).toBeNull();
    expect(composeRetireReason('Other', 'Supplier closed', null)).toBe('Supplier closed.');
    expect(composeRetireReason(null, '', null)).toBeNull();
  });
  it('refuses a sentence over 200 characters', () => {
    expect(composeRetireReason('Other', 'x'.repeat(200), null)).toBeNull();
  });
});

describe('retireTouches', () => {
  it('is all green for an unused item', () => {
    expect(retireTouches(review, 'kg', false).every((l) => l.tone === 'safe')).toBe(true);
  });
  it('warns about stock, orders and the restock list', () => {
    const lines = retireTouches({ ...review, onHandQty: '12.5', openOrders: 1 }, 'kg', true);
    expect(lines.map((l) => l.tone)).toEqual(['change', 'change', 'change']);
    expect(lines[0]?.text).toContain('12.5 kg');
    expect(lines[1]?.text).toContain('One open order has');
  });
});
