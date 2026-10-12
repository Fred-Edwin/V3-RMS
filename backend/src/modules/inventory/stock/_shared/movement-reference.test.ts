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
    expect(movementReference({ ...none, type: 'DISPATCH_OUT', dispatchLabel: 'DSP-NYR-0232' }).reference).toBe('DSP-NYR-0232');
    expect(movementReference({ ...none, type: 'DISPATCH_IN', dispatchLabel: 'DSP-NYR-0232' }).reference).toBe('DSP-NYR-0232');
  });

  it('a dispatch finding reads ADJ-nnnn with the DSC- number as its source, and is found by either, or by the DSP- number', () => {
    const finding = movementReference({ ...none, type: 'ADJUSTMENT', adjustmentReference: 'ADJ-0031', dispatchLabel: 'DSP-NYR-0232', discrepancyReference: 'DSC-NYR-0007' });
    expect(finding).toEqual({ reference: 'ADJ-0031', source: 'DSC-NYR-0007', all: ['ADJ-0031', 'DSP-NYR-0232', 'DSC-NYR-0007'] });
  });

  it('a count adjustment keeps the count as its source even when a discrepancy is absent', () => {
    expect(movementReference({ ...none, type: 'ADJUSTMENT', adjustmentReference: 'ADJ-0007', countReference: 'CNT-2026-0007' })).toMatchObject({ reference: 'ADJ-0007', source: 'CNT-2026-0007' });
  });

  it('gives waste no reference', () => {
    expect(movementReference(none)).toEqual({ reference: null, source: null, all: [] });
  });

  it('a row with no number at all has none, however it was linked', () => {
    expect(movementReference({ ...none, type: 'RECEIVE' }).reference).toBeNull();
  });
});
