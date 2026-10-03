import { describe, expect, it } from 'vitest';

import type { ItemChangeReview } from '../../types';
import { buildEditPlan, itemToFormValues, type ItemFormSource } from './item-form-model';
import { editReviewBullets } from './item-review';

const flour: ItemFormSource = {
  name: 'Wheat flour',
  type: 'RAW_INGREDIENT',
  buyUnit: 'bag',
  usageUnit: 'kg',
  conversionFactor: '25',
  packSize: '25',
  categoryId: null,
  departmentTags: [],
  centralStoreRestockLevel: null,
};

const review = (over: Partial<ItemChangeReview>): ItemChangeReview => ({
  inventoryItemId: 'i1',
  itemName: 'Wheat flour',
  onHandQty: '0',
  locationsHoldingStock: 0,
  stockEntries: 0,
  receipts: 0,
  receiptLines: 0,
  openOrders: 0,
  hasHistory: false,
  ...over,
});

const pack24 = buildEditPlan(flour, { ...itemToFormValues(flour), holds: '24' });

describe('editReviewBullets', () => {
  it('with history: stock stays, past receipts stay, new counts apply with the open orders named', () => {
    const bullets = editReviewBullets(pack24, review({ hasHistory: true, onHandQty: '100.0000', stockEntries: 3, receipts: 2, receiptLines: 2, openOrders: 1 }));
    expect(bullets.map((b) => b.tone)).toEqual(['safe', 'safe', 'change']);
    expect(bullets[0].text).toBe('Stock stays in kg. The 100 kg on hand does not change.');
    expect(bullets[1].text).toContain('2 receipts');
    expect(bullets[2].text).toBe('From now on a bag counts as 24 kg on new orders and receipts. 1 open order will show its bags at 24 kg each.');
  });
  it('with no history uses the no-history wording', () => {
    const bullets = editReviewBullets(pack24, review({}));
    expect(bullets[0].text).toBe('No stock has been counted for this item yet, so no figures change.');
    expect(bullets[1].text).toBe('No receipts yet. Nothing in the item history is affected.');
    expect(bullets[2].text).toContain('No open order uses this item.');
  });
});
