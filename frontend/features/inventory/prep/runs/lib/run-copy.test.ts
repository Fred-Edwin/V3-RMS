import { describe, expect, it } from 'vitest';
import type { RunDetail } from '../../_shared/types/prep-contract';
import { drawerStatus, drawerSubtitle, saidWho, stockWarningSentence, unitCostText, yieldGapSentence, yieldReasonWords } from './run-copy';

const person = { id: 'u1', name: 'Sarah Achieng', initials: 'SA', roleLabel: 'Store Attendant' };

describe('drawer header and status', () => {
  it('words the subtitle by what became of the run', () => {
    expect(drawerSubtitle({ reference: 'PREP-0131', status: 'RECORDED', isCorrection: false })).toBe('PREP-0131 · RECORDED RUN');
    expect(drawerSubtitle({ reference: 'PREP-0132', status: 'RECORDED', isCorrection: true })).toBe('PREP-0132 · CORRECTED RUN');
    expect(drawerSubtitle({ reference: 'PREP-0128', status: 'CORRECTED', isCorrection: false })).toBe('PREP-0128 · CORRECTED · REPLACED');
    expect(drawerSubtitle({ reference: 'PREP-0129', status: 'CANCELLED', isCorrection: false })).toBe('PREP-0129 · CANCELLED RUN');
  });
  it('says Needs a look, Reviewed by, Recorded, Corrected or Cancelled', () => {
    expect(drawerStatus({ status: 'RECORDED', needsLook: true })).toEqual({ label: 'Needs a look', tone: 'warning' });
    expect(drawerStatus({ status: 'RECORDED', needsLook: false, reviewedBy: { ...person, name: 'Joseph Mwangi' }, reviewedAt: 'x' })).toEqual({ label: 'Reviewed by Joseph', tone: 'success' });
    expect(drawerStatus({ status: 'RECORDED' })).toEqual({ label: 'Recorded', tone: 'neutral' });
    expect(drawerStatus({ status: 'CORRECTED' }).label).toBe('Corrected');
    expect(drawerStatus({ status: 'CANCELLED', needsLook: true }).tone).toBe('error');
  });
});

describe('the notes', () => {
  const run = { made: '5', unit: 'kg', expected: { amount: '7.00', unit: 'kg', source: 'RECIPE', text: 'about 7 kg' }, vsUsual: { label: 'LOW', deltaAmount: '−2', text: '−2 kg · low yield' } } as const;
  it('compares the run with the usual figure, with the share', () => {
    expect(yieldGapSentence(run)).toBe('Usually this gives about 7 kg. This run gave 5 kg, which is 2 kg (29%) under.');
    expect(yieldGapSentence({ ...run, made: '9', vsUsual: { label: 'HIGH', deltaAmount: '+2', text: '+2 kg · high yield' } })).toContain('(29%) over');
  });
  it('says nothing for an on-target run, or one with nothing to compare with', () => {
    expect(yieldGapSentence({ ...run, vsUsual: { label: 'ON_TARGET', deltaAmount: '0', text: 'on target' } })).toBeNull();
    expect(yieldGapSentence({ ...run, vsUsual: { label: 'NO_BASIS', deltaAmount: null, text: 'x' }, expected: { amount: null, unit: 'kg', source: 'NONE', text: 'no usual yet' } })).toBeNull();
  });

  const inputs = [
    { itemId: 'b', itemName: 'Beef mince', quantity: '6', unit: 'kg', onHand: '4.5', exceedsStock: true },
    { itemId: 'o', itemName: 'Onions', quantity: '2', unit: 'kg', onHand: '14', exceedsStock: false },
  ];
  it('names the input that went over the stock, in the manager’s words', () => {
    expect(stockWarningSentence({ inputs, flags: { yield: 'LOW', notify: false, stockExceeded: true, exceedsText: 'x' } })).toBe(
      'Beef mince used (6 kg) is 1.5 kg more than the system expected in stock. Only you see this.'
    );
  });
  it('uses the server wording when the caller has no stock figures, and nothing when no flag', () => {
    const blind = inputs.map(({ onHand: _onHand, ...rest }) => rest);
    expect(stockWarningSentence({ inputs: blind, flags: { yield: null, notify: false, stockExceeded: true, exceedsText: 'Used 6 kg beef mince; 4.5 kg was in stock' } })).toBe('Used 6 kg beef mince; 4.5 kg was in stock Only you see this.');
    expect(stockWarningSentence({ inputs, flags: { yield: null, notify: false, stockExceeded: false, exceedsText: null } })).toBeNull();
    expect(stockWarningSentence({ inputs })).toBeNull();
  });
});

describe('what the Attendant said', () => {
  it('names the speaker and the chip', () => {
    expect(saidWho({ by: person, mine: false })).toBe('Sarah said');
    expect(saidWho({ by: person, mine: true })).toBe('You said');
    expect(yieldReasonWords({ yieldReason: 'SPILLAGE', yieldReasonNote: null })).toBe('Spillage');
    expect(yieldReasonWords({ yieldReason: 'OTHER', yieldReasonNote: 'power cut' })).toBe('power cut');
    expect(yieldReasonWords({ yieldReason: 'OTHER', yieldReasonNote: null })).toBe('Other');
    expect(yieldReasonWords({ yieldReason: null, yieldReasonNote: null })).toBeNull();
  });
  it('writes the unit cost only when the server sent it', () => {
    expect(unitCostText({ outputUnitCost: '828', unit: 'kg' } as Pick<RunDetail, 'outputUnitCost' | 'unit'>)).toBe('KES 828 / kg');
    expect(unitCostText({ unit: 'kg' })).toBeNull();
  });
});
