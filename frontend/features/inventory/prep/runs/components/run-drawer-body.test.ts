import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { RunDetail } from '../../_shared/types/prep-contract';
import { RunDrawerBody } from './run-drawer-body';

const sarah = { id: 'u1', name: 'Sarah Achieng', initials: 'SA', roleLabel: 'Store Attendant' };
const joseph = { id: 'u2', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Store Manager' };

/** What the Store Manager's server answer looks like for a flagged run (Paper step 11). */
const managerView: RunDetail = {
  id: 'r1', reference: 'PREP-0131', at: '2026-10-12T07:05:00.000Z', outputItemId: 'o', outputName: 'Samosa filling',
  inputsPreview: { firstLabel: '6 kg beef mince', moreCount: 1 }, made: '5', unit: 'kg',
  vsUsual: { label: 'LOW', deltaAmount: '−2', text: '−2 kg · low yield' }, status: 'RECORDED', isCorrection: false, by: sarah, mine: false,
  outputUnitCost: '828', needsLook: true, reviewedBy: null, reviewedAt: null,
  inputs: [
    { itemId: 'b', itemName: 'Beef mince', quantity: '6', unit: 'kg', unitCost: '650', lineCost: '3900', onHand: '4.5', exceedsStock: true },
    { itemId: 'o', itemName: 'Onions', quantity: '2', unit: 'kg', unitCost: '120', lineCost: '240', onHand: '14', exceedsStock: false },
  ],
  totalInputCost: '4140', expected: { amount: '7.00', unit: 'kg', source: 'RECIPE', text: 'about 7 kg' }, recipeVersion: 1,
  yieldReason: 'SPILLAGE', yieldReasonNote: null,
  flags: { yield: 'LOW', notify: false, stockExceeded: true, exceedsText: 'Used 6 kg beef mince; 4.5 kg was in stock' },
  replaces: null, replacedBy: null, correction: null, cancellation: null,
  timeline: [{ at: '2026-10-12T07:05:00.000Z', text: 'Recorded as PREP-0131 · Sarah Achieng' }],
  can: { correct: true, cancel: true, review: true, lockedReason: null }, windowEndsAt: null,
};

/** The same run as the Attendant's server answer: no costs, no stock, no flags, no needsLook. */
const attendantView: RunDetail = (() => {
  const { outputUnitCost: _a, needsLook: _b, reviewedBy: _c, reviewedAt: _d, totalInputCost: _e, flags: _f, ...rest } = managerView;
  return {
    ...rest,
    mine: true,
    inputs: managerView.inputs.map(({ unitCost: _u, lineCost: _l, onHand: _o, exceedsStock: _x, ...line }) => line),
    can: { correct: true, cancel: true, review: false, lockedReason: null },
    windowEndsAt: '2026-10-13T07:05:00.000Z',
  };
})();

const html = (run: RunDetail): string => renderToStaticMarkup(createElement(RunDrawerBody, { run, onOpenRun: () => undefined }));

describe('the manager’s drawer (flagged run)', () => {
  const out = html(managerView);
  it('shows who, when, status and the output', () => {
    expect(out).toContain('Sarah Achieng · Store Attendant');
    expect(out).toContain('Needs a look');
    expect(out).toContain('Samosa filling');
    expect(out).toContain('5 kg');
  });
  it('shows the input table with the stock column and costs, and marks the input that went over', () => {
    expect(out).toContain('Expected in stock');
    expect(out).toContain('KES 3,900');
    expect(out).toContain('4.5 kg');
    expect(out).toContain('More than the system expected in stock');
  });
  it('shows the three notes in the manager’s words', () => {
    expect(out).toContain('Beef mince used (6 kg) is 1.5 kg more than the system expected in stock. Only you see this.');
    expect(out).toContain('Usually this gives about 7 kg. This run gave 5 kg, which is 2 kg (29%) under.');
    expect(out).toContain('Sarah said');
    expect(out).toContain('Spillage');
  });
  it('has no history block for a plain recorded run', () => {
    expect(out).not.toContain('History of this run');
  });
});

describe('the Attendant’s drawer (same run, their server answer)', () => {
  const out = html(attendantView);
  it('has no costs, no stock column, no warnings, no flags', () => {
    expect(out).not.toMatch(/KES|Expected in stock|Only you see this|Needs a look|more than the system expected|Usually this gives/);
    expect(out).not.toContain('Cost</th>');
  });
  it('still shows what they entered, and what they said, as "You said"', () => {
    expect(out).toContain('Beef mince');
    expect(out).toContain('You said');
    expect(out).toContain('Spillage');
    expect(out).toContain('Recorded');
  });
});

describe('reviewed, cancelled, corrected and linked runs', () => {
  it('shows who reviewed it', () => {
    expect(html({ ...managerView, needsLook: false, reviewedBy: joseph, reviewedAt: '2026-10-12T09:34:00.000Z' })).toContain('Reviewed by Joseph');
  });
  it('shows the cancellation reason, who and when', () => {
    const out = html({ ...managerView, status: 'CANCELLED', needsLook: false, cancellation: { reason: 'ENTERED_TWICE', note: null, by: joseph, at: '2026-10-12T08:00:00.000Z' } });
    expect(out).toContain('Cancelled: Entered twice');
    expect(out).toContain('By Joseph Mwangi');
  });
  it('shows what a correction changed, and links to the run it replaces and the run that replaced it', () => {
    const out = html({
      ...managerView,
      isCorrection: true,
      replaces: { id: 'old', reference: 'PREP-0128', at: '2026-10-11T07:00:00.000Z' },
      replacedBy: { id: 'new', reference: 'PREP-0133', at: '2026-10-12T11:00:00.000Z' },
      correction: { reason: 'TYPO', note: null, by: joseph, at: '2026-10-12T08:30:00.000Z', changed: [{ itemName: 'Beef mince', was: '60', now: '6', unit: 'kg' }] },
      timeline: [
        { at: '2026-10-12T07:05:00.000Z', text: 'Recorded as PREP-0131 · Sarah Achieng' },
        { at: '2026-10-12T08:30:00.000Z', text: 'Corrected · Joseph Mwangi' },
      ],
    });
    // The side-by-side from Slice 3 (Paper step 17): the amber note, then Was and Now columns.
    expect(out).toContain('Corrected by Joseph Mwangi');
    expect(out).toContain('Reason: typo');
    expect(out).toMatch(/60 kg<\/td><td[^>]*>6 kg/);
    expect(out).toContain('Replaces PREP-0128');
    expect(out).toContain('Replaced by PREP-0133');
    expect(out).toContain('History of this run');
  });
});
