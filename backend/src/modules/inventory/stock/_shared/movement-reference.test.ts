import { describe, expect, it } from 'vitest';
import { movementReference, type MovementSources } from './movement-reference';

const none: MovementSources = { type: 'WASTE', adjustmentReference: null, countReference: null, deliveryReference: null, prepReference: null, dispatchLabel: null };

describe('movementReference', () => {
  it('reads a count adjustment as ADJ with the count as its source', () => {
    expect(movementReference({ ...none, type: 'ADJUSTMENT', adjustmentReference: 'ADJ-3402', countReference: 'CNT-2026-1013' })).toEqual({
      reference: 'ADJ-3402',
      source: 'CNT-2026-1013',
      all: ['ADJ-3402', 'CNT-2026-1013'],
    });
  });

  it('reads a plain adjustment as ADJ alone', () => {
    expect(movementReference({ ...none, type: 'ADJUSTMENT', adjustmentReference: 'ADJ-0007' })).toMatchObject({ reference: 'ADJ-0007', source: null });
  });

  it('reads receipts, prep rows and dispatches by their own number', () => {
    expect(movementReference({ ...none, type: 'RECEIVE', deliveryReference: 'GRN-0412' }).reference).toBe('GRN-0412');
    expect(movementReference({ ...none, type: 'PREP_PRODUCE', prepReference: 'PREP-0021' }).reference).toBe('PREP-0021');
    expect(movementReference({ ...none, type: 'PREP_CONSUME', prepReference: 'PREP-0021' }).reference).toBe('PREP-0021');
    expect(movementReference({ ...none, type: 'DISPATCH_OUT', dispatchLabel: 'Dispatch 4 · Nyeri Town · 17 Sep' }).reference).toBe('Dispatch 4 · Nyeri Town · 17 Sep');
  });

  it('gives waste no reference', () => {
    expect(movementReference(none)).toEqual({ reference: null, source: null, all: [] });
  });

  it('a row with no number at all has none, however it was linked', () => {
    expect(movementReference({ ...none, type: 'RECEIVE' }).reference).toBeNull();
  });
});
