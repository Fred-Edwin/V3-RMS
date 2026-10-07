import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import fixtures from '../../_shared/types/prep-contract.fixtures.json';
import type { CancelPreview, CheckResult, RunDetail } from '../../_shared/types/prep-contract';
import { linesFromRun } from '../lib/fix-logic';
import { CancelRunView, belowZeroText, type CancelRunViewProps } from './cancel-run-dialog';
import { CheckCorrectionBody, CorrectRunFormView, type CorrectRunFormViewProps } from './correct-run-form';
import { CorrectedCompare, compareRows } from './corrected-compare';
import { FixRunView, fixModeOf } from './fix-run-view';

const manager = fixtures.runDetailManager as unknown as RunDetail;

/** Sarah's own run as the server shows it to her: no costs, no flags, inside the window. */
const attendantRun = {
  ...manager,
  id: 'run-30',
  reference: 'PREP-0130',
  made: '38',
  isCorrection: false,
  mine: true,
  replaces: null,
  correction: null,
  inputs: [
    { itemId: 'a', itemName: 'Chicken, cut', quantity: '10', unit: 'kg' },
    { itemId: 'b', itemName: 'Garlic-ginger paste', quantity: '1', unit: 'kg' },
  ],
  vsUsual: { label: 'ON_TARGET', deltaAmount: null, text: 'on target' },
  can: { correct: true, cancel: true, review: false, lockedReason: null },
  windowEndsAt: '2026-10-08T04:20:00.000Z',
} as unknown as RunDetail;
delete (attendantRun as Partial<RunDetail>).flags;
delete (attendantRun as Partial<RunDetail>).needsLook;
delete (attendantRun as Partial<RunDetail>).totalInputCost;
delete (attendantRun as Partial<RunDetail>).outputUnitCost;

const noop = () => undefined;

describe('FixRunView (steps 13 and 22)', () => {
  const html = (run: RunDetail, mode = fixModeOf(run)) => renderToStaticMarkup(createElement(FixRunView, { run, mode, onCorrect: noop, onCancel: noop }));

  it('open: shows the window text and two live buttons, and no costs or flags', () => {
    const out = html(attendantRun);
    expect(out).toContain('You can correct or cancel this run until');
    expect(out).toContain('After that, ask the Store Manager.');
    expect(out).toContain('Correct this run');
    expect(out).toContain('Cancel this run');
    expect(out).not.toContain('disabled');
    expect(out).not.toContain('KES');
    expect(out).toContain('Chicken, cut 10 kg');
  });

  it('locked: really disables both buttons, says why, and points to the Store Manager', () => {
    const locked = { ...attendantRun, can: { correct: false, cancel: false, review: false, lockedReason: 'Ask the Store Manager' }, windowEndsAt: null } as RunDetail;
    expect(fixModeOf(locked)).toBe('locked');
    const out = html(locked);
    expect(out).toContain('This run is more than 24 hours old');
    expect(out).toContain('Only the Store Manager can correct or cancel it now.');
    expect(out.match(/disabled=""/g)).toHaveLength(2);
    expect(out).toContain('Ask the Store Manager');
  });

  it("someone else's run: read-only with the reason, no buttons", () => {
    const notYours = { ...attendantRun, mine: false, can: { correct: false, cancel: false, review: false, lockedReason: null }, windowEndsAt: null } as RunDetail;
    expect(fixModeOf(notYours)).toBe('notYours');
    const out = html(notYours);
    expect(out).toContain('Only the person who recorded this run');
    expect(out).not.toContain('Correct this run');
  });

  it('a corrected or cancelled run says so and offers nothing', () => {
    const corrected = { ...attendantRun, status: 'CORRECTED', replacedBy: { id: 'r2', reference: 'PREP-0131', at: '2026-10-07T08:00:00.000Z' } } as RunDetail;
    expect(html(corrected)).toContain('replaced by PREP-0131');
    const cancelled = { ...attendantRun, status: 'CANCELLED', cancellation: { reason: 'ENTERED_TWICE', note: null, by: attendantRun.by, at: '2026-10-07T08:00:00.000Z' } } as RunDetail;
    const out = html(cancelled);
    expect(out).toContain('This run was cancelled');
    expect(out).toContain('Entered twice');
    expect(out).not.toContain('Cancel this run');
  });

  it('a server 403 on save locks the screen even when the run looked open', () => {
    expect(fixModeOf(attendantRun, true)).toBe('locked');
  });

  it('a Store Manager sees the any-age note instead of a window', () => {
    const out = html({ ...manager, windowEndsAt: null, status: 'RECORDED' } as RunDetail, 'open');
    expect(out).toContain('whatever its age');
  });
});

describe('CorrectRunFormView (step 14)', () => {
  const base: CorrectRunFormViewProps = {
    run: attendantRun,
    lines: linesFromRun(attendantRun),
    made: '38',
    reason: undefined,
    note: '',
    check: null,
    checkFailed: false,
    blocker: 'Change an amount, or add or remove something, to correct this run.',
    onQuantity: noop,
    onMade: noop,
    onRemove: noop,
    onAdd: noop,
    onReason: noop,
    onNote: noop,
    onReview: noop,
  };
  const html = (over: Partial<CorrectRunFormViewProps> = {}) => renderToStaticMarkup(createElement(CorrectRunFormView, { ...base, ...over }));

  it('prefills the recorded amounts and offers the four reasons, none chosen', () => {
    const out = html();
    expect(out).toContain('What you used');
    expect(out).toContain('Why are you correcting it?');
    for (const label of ['Typo', 'Wrong item', 'Wrong quantity', 'Other']) expect(out).toContain(label);
    expect(out).not.toContain('aria-pressed="true"');
  });

  it('the review button is really disabled and the reason it is off is written under it', () => {
    const out = html();
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Review the correction/);
    expect(out).toContain('Change an amount');
  });

  it('with a change and a reason it is enabled and says the original stays on record', () => {
    const lines = linesFromRun(attendantRun).map((l) => (l.itemId === 'a' ? { ...l, quantity: '9' } : l));
    const out = html({ lines, reason: 'WRONG_QUANTITY', blocker: null });
    expect(out).toContain('Was 10 kg');
    expect(out).toContain('aria-pressed="true"');
    expect(out).not.toMatch(/<button[^>]*disabled=""[^>]*>Review the correction/);
    expect(out).toContain('The original run stays on record, linked to this one.');
  });

  it('shows the amber yield warning and the typo warning without blocking', () => {
    const check = {
      expected: { amount: '76', unit: 'portions', source: 'RECIPE', text: 'about 76 portions' },
      vsUsual: { label: 'LOW', deltaAmount: '−16', text: '−16 portions · low yield' },
      tier: 'WARN',
      typoSuspect: { suspect: true, text: 'That is much less than the usual (about 76 portions). Please check the number.' },
      repeat: { duplicate: false, of: null },
      usualRecipeText: null,
      mainIngredientMissing: false,
    } as unknown as CheckResult;
    const out = html({ check, blocker: null, reason: 'TYPO' });
    expect(out).toContain('less than the 76 expected');
    expect(out).toContain('Please check the number.');
  });

  it('"Other" asks for an optional note; the other reasons do not', () => {
    expect(html({ reason: 'OTHER' })).toContain('Tell the Store Manager what happened');
    expect(html({ reason: 'TYPO' })).not.toContain('Tell the Store Manager');
  });

  it('while saving every control is disabled', () => {
    const out = html({ disabled: true });
    expect(out).not.toMatch(/<input(?![^>]*disabled)/);
  });

  it('a line taken out reads "not used now"', () => {
    const lines = linesFromRun(attendantRun).map((l) => (l.itemId === 'b' ? { ...l, quantity: '0' } : l));
    expect(html({ lines })).toContain('not used now');
  });
});

describe('CheckCorrectionBody (step 15)', () => {
  const lines = linesFromRun(attendantRun).map((l) => (l.itemId === 'a' ? { ...l, quantity: '9' } : l));
  it("tells an Attendant the Store Manager will see it, and lists the before and after", () => {
    const out = renderToStaticMarkup(createElement(CheckCorrectionBody, { run: attendantRun, lines, made: '38', reason: 'WRONG_QUANTITY', toManager: true, failure: null }));
    expect(out).toContain('10 kg → 9 kg');
    expect(out).toContain('1 kg · no change');
    expect(out).toContain('38 portions · no change');
    expect(out).toContain('Wrong quantity');
    expect(out).toContain('The Store Manager will see this correction.');
  });

  it("shows a failed save inside the sheet and does not claim the manager is told when it is the manager's own", () => {
    const out = renderToStaticMarkup(createElement(CheckCorrectionBody, { run: attendantRun, lines, made: '38', reason: 'TYPO', toManager: false, failure: { message: "Couldn't save the correction. Nothing was changed. Try again.", locked: false, notOpen: false } }));
    expect(out).not.toContain('will see this correction');
    expect(out).toContain('Nothing was changed');
  });
});

describe('CancelRunView (steps 16 and 18)', () => {
  const preview = fixtures.cancelPreview as unknown as CancelPreview;
  const base: CancelRunViewProps = { run: attendantRun, showStock: false, previewStatus: 'idle', preview: null, reason: undefined, note: '', failure: null, onReason: noop, onNote: noop };
  const html = (over: Partial<CancelRunViewProps> = {}) => renderToStaticMarkup(createElement(CancelRunView, { ...base, ...over }));

  it("the Attendant's sheet lists what is put back and removed, with no stock figures and no preview call", () => {
    const out = html();
    expect(out).toContain('10 kg put back');
    expect(out).toContain('38 portions removed');
    expect(out).not.toContain('What happens to stock');
    for (const label of ['Entered twice', 'Never made', 'Wrong item', 'Other']) expect(out).toContain(label);
  });

  it('the manager sees the CHANGE table with signs, a loading line, then the below-zero warning', () => {
    expect(html({ showStock: true, previewStatus: 'loading' })).toContain('Checking stock');
    const below: CancelPreview = { items: [{ itemId: 'o', itemName: 'Chapati dough', onHandNow: '6', onHandAfter: '-8', unit: 'kg', belowZero: true }] };
    const out = html({ showStock: true, previewStatus: 'ready', preview: below });
    expect(out).toContain('What happens to stock');
    expect(out).toContain('+10 kg put back');
    expect(out).toContain('−38 portions removed');
    expect(out).toContain('Only 6 kg of chapati dough is in stock now. After this it will show −8 kg.');
    expect(out).toContain('role="alert"');
  });

  it('shows no warning when nothing goes below zero, and a soft note when the preview fails', () => {
    const fine: CancelPreview = { items: preview.items.map((i) => ({ ...i, belowZero: false })) };
    expect(html({ showStock: true, previewStatus: 'ready', preview })).toContain('role="alert"');
    expect(html({ showStock: true, previewStatus: 'ready', preview: fine })).not.toContain('role="alert"');
    expect(html({ showStock: true, previewStatus: 'error' })).toContain('You can still cancel');
  });

  it('shows a failed cancel and an optional note for "Other"', () => {
    expect(html({ failure: { message: "Couldn't cancel the run. Nothing was changed. Try again.", locked: false, notOpen: false } })).toContain('Nothing was changed');
    expect(html({ reason: 'OTHER' })).toContain('Add a note (optional)');
  });

  it('words the below-zero line for any item', () => {
    expect(belowZeroText({ itemId: 'x', itemName: 'Wheat Flour', onHandNow: '4.5', onHandAfter: '-1', unit: 'kg', belowZero: true })).toBe(
      'Only 4.5 kg of wheat flour is in stock now. After this it will show −1 kg. That is allowed and will be marked negative on stock screens.',
    );
  });
});

describe('CorrectedCompare (step 17)', () => {
  const html = (run: RunDetail) => renderToStaticMarkup(createElement(CorrectedCompare, { run }));
  const corrected = {
    ...manager,
    inputs: [
      { itemId: 'a', itemName: 'Chicken, cut', quantity: '9', unit: 'kg', unitCost: '420', lineCost: '3780' },
      { itemId: 'b', itemName: 'Garlic-ginger paste', quantity: '1', unit: 'kg', unitCost: '380', lineCost: '380' },
    ],
    made: '38',
    replaces: { id: 'r0', reference: 'PREP-0130', at: '2026-10-12T04:20:00.000Z' },
    correction: {
      reason: 'WRONG_QUANTITY',
      note: null,
      by: manager.by,
      at: '2026-10-12T10:15:00.000Z',
      changed: [{ itemName: 'Chicken, cut', was: '10', now: '9', unit: 'kg', costNow: '3780' }],
      unitCostBefore: '121',
      unitCostAfter: '109',
    },
    timeline: [
      { at: '2026-10-12T04:20:00.000Z', text: 'Recorded as PREP-0130 · Sarah Achieng' },
      { at: '2026-10-12T10:15:00.000Z', text: 'Corrected to PREP-0132 · Sarah Achieng' },
    ],
  } as unknown as RunDetail;

  it('lists every line with was, now and cost now, changed ones in bold, the made figure last', () => {
    const rows = compareRows(corrected);
    expect(rows.map((r) => [r.name, r.was, r.now, r.changed])).toEqual([
      ['Chicken, cut', '10', '9', true],
      ['Garlic-ginger paste', '1', '1', false],
      ['Marinated chicken', '38', '38', false],
    ]);
    const out = html(corrected);
    expect(out).toContain('Corrected by Sarah Achieng');
    expect(out).toContain('Replaces PREP-0130');
    expect(out).toContain('Reason: wrong quantity.');
    expect(out).toContain('KES 3,780');
    expect(out).toContain('KES 121');
    expect(out).toContain('KES 109');
    expect(out).toContain('Recorded as PREP-0130 · Sarah Achieng');
    expect(out).toContain('Corrected to PREP-0132 · Sarah Achieng');
  });

  it('shows a dropped ingredient with "—" now', () => {
    const dropped = { ...corrected, inputs: [corrected.inputs[0]], correction: { ...corrected.correction!, changed: [...corrected.correction!.changed, { itemName: 'Garlic-ginger paste', was: '1', now: null, unit: 'kg' }] } } as RunDetail;
    expect(compareRows(dropped).find((r) => r.name === 'Garlic-ginger paste')).toMatchObject({ was: '1', now: null });
    expect(html(dropped)).toContain('—');
  });

  it('shows no money at all to a caller without costs', () => {
    const blind = { ...corrected, inputs: corrected.inputs.map(({ unitCost: _u, lineCost: _l, ...rest }) => rest), correction: { ...corrected.correction!, changed: [{ itemName: 'Chicken, cut', was: '10', now: '9', unit: 'kg' }], unitCostBefore: undefined, unitCostAfter: undefined } } as unknown as RunDetail;
    const out = html(blind);
    expect(out).not.toContain('KES');
    expect(out).not.toContain('Cost now');
    expect(out).not.toContain('Output unit cost');
  });

  it('says so when the run is not a correction', () => {
    expect(html({ ...corrected, correction: null } as RunDetail)).toContain('not a correction');
  });
});
