import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RunTable } from '../../_shared/components/run-table';
import type { RunSummary } from '../../_shared/types/prep-contract';
import { HistoryTable } from './history-table';

const sarah = { id: 'u1', name: 'Sarah Achieng', initials: 'SA', roleLabel: 'Store Attendant' };
const joseph = { id: 'u2', name: 'Joseph Mwangi', initials: 'JM', roleLabel: 'Store Manager' };
const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  id: 'r1', reference: 'PREP-0131', at: '2026-10-12T07:05:00.000Z', outputItemId: 'o', outputName: 'Samosa filling',
  inputsPreview: { firstLabel: '6 kg beef mince', moreCount: 1 }, made: '5', unit: 'kg',
  vsUsual: { label: 'LOW', deltaAmount: '−2', text: '−2 kg · low yield' }, status: 'RECORDED', isCorrection: false, by: sarah, mine: false, ...over,
});
const table = (runs: RunSummary[] | null) => renderToStaticMarkup(createElement(HistoryTable, { runs, onOpen: () => undefined }));

describe('History table (Paper step 12)', () => {
  it('has the seven columns and a row per run, opening by keyboard', () => {
    const out = table([run()]);
    for (const heading of ['When', 'Run', 'Output', 'Yield', 'Vs usual', 'By', 'Status']) expect(out).toContain(`>${heading}<`);
    expect(out).toContain('PREP-0131');
    expect(out).toContain('Sarah Achieng');
    expect(out).toContain('tabindex="0"');
    expect(out).toContain('aria-label="PREP-0131, Samosa filling"');
  });
  it('says what became of each run in the Status cell', () => {
    expect(table([run({ needsLook: true })])).toContain('Needs a look');
    expect(table([run({ needsLook: false, reviewedBy: joseph, reviewedAt: '2026-10-12T09:34:00.000Z' })])).toContain('Reviewed by Joseph, 12:34');
    expect(table([run({ status: 'CANCELLED' })])).toContain('Cancelled');
    expect(table([run({ status: 'CORRECTED' })])).toContain('Corrected');
    expect(table([run({ isCorrection: true })])).toContain('Corrected run');
  });
  it('shows a dash with words for a screen reader when there is nothing to say (the Attendant sees only this and Cancelled/Corrected)', () => {
    const out = table([run()]);
    expect(out).toContain('Nothing to review');
    expect(out).not.toMatch(/Needs a look|Reviewed by/);
  });
  it('tags the caller’s own runs', () => {
    expect(table([run({ mine: true })])).toContain('· yours');
  });
  it('loading keeps the header and shows skeleton rows', () => {
    const out = table(null);
    expect(out).toContain('>When<');
    expect(out).not.toContain('PREP-');
    expect(out).toContain('aria-hidden');
  });
});

describe('Runs table row tint', () => {
  const html = (variant: 'manager' | 'attendant', runs: RunSummary[]) => renderToStaticMarkup(createElement(RunTable, { runs, variant, onOpen: () => undefined }));
  it('tints a flagged run for the manager and says so to a screen reader', () => {
    const out = html('manager', [run({ needsLook: true })]);
    expect(out).toContain('bg-wds-warning-bg');
    expect(out).toContain('(needs a look)');
  });
  it('does not tint an unflagged run, a reviewed run, or anything on the Attendant’s table', () => {
    expect(html('manager', [run({ needsLook: false })])).not.toContain('bg-wds-warning-bg');
    expect(html('attendant', [run()])).not.toContain('bg-wds-warning-bg');
    expect(html('attendant', [run({ needsLook: true })])).not.toContain('bg-wds-warning-bg'); // the server never sends it; the table would still not paint it
  });
});
