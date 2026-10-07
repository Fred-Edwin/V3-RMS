import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { NeedsLookList, RunsSummary } from '../../_shared/types/prep-contract';
import { KpiStrip } from './kpi-strip';
import { NeedsLookBand } from './needs-look-band';

const noop = () => undefined;
const person = { id: 'u1', name: 'Sarah Achieng', initials: 'SA', roleLabel: 'Store Attendant' };
const item = (over: Partial<NeedsLookList['items'][number]> = {}): NeedsLookList['items'][number] => ({
  id: 'r1', reference: 'PREP-0131', at: '2026-10-12T07:05:00.000Z', outputItemId: 'o', outputName: 'Samosa filling',
  inputsPreview: { firstLabel: '6 kg beef mince', moreCount: 1 }, made: '5', unit: 'kg',
  vsUsual: { label: 'LOW', deltaAmount: '−2', text: '−2 kg · low yield' }, status: 'RECORDED', isCorrection: false, by: person, mine: false,
  needsLook: true, reasons: ['Low yield · 2 kg under usual', 'Beef mince used more than expected', 'Said: spillage'], ...over,
});

describe('KPI strip', () => {
  const summary: RunsSummary = { runsThisWeek: 15, runsToday: 2, needsLookCount: 1, prepValue7d: '52340' };
  const strip = (over: { summary?: RunsSummary | null; status?: 'loading' | 'ready' | 'error' }) =>
    renderToStaticMarkup(createElement(KpiStrip, { summary, status: 'ready', onRetry: noop, ...over }));

  it('shows the three figures (Paper step 10)', () => {
    const out = strip({});
    expect(out).toContain('Runs this week');
    expect(out).toContain('>15<');
    expect(out).toContain('2 today');
    expect(out).toContain('waiting for your review');
    expect(out).toContain('Prep value (7d)');
    expect(out).toContain('KES 52K');
    expect(out).toContain('input cost consumed');
  });
  it('leaves the money out when the server sent none (no prep.see_costs)', () => {
    const { prepValue7d: _drop, ...noCost } = summary;
    const out = strip({ summary: noCost });
    expect(out).not.toMatch(/Prep value|KES/);
    expect(out).toContain('Needs a look');
  });
  it('says "nothing waiting" at zero', () => {
    expect(strip({ summary: { ...summary, needsLookCount: 0 } })).toContain('nothing waiting');
  });
  it('loading is skeleton cells with a label; error offers Try again', () => {
    expect(strip({ summary: null, status: 'loading' })).toContain('Loading this week');
    const err = strip({ summary: null, status: 'error' });
    expect(err).toContain('Try again');
    expect(err).toContain('role="alert"');
  });
});

describe('Needs a look band', () => {
  const band = (props: Partial<Parameters<typeof NeedsLookBand>[0]>) =>
    renderToStaticMarkup(createElement(NeedsLookBand, { data: { count: 1, items: [item()] }, status: 'ready', onRetry: noop, onReview: noop, onShowAll: noop, ...props }));

  it('shows the run, its reasons as chips, who and when, and a Review button', () => {
    const out = band({});
    expect(out).toContain('Samosa filling · 5 kg');
    expect(out).toContain('Low yield · 2 kg under usual');
    expect(out).toContain('Beef mince used more than expected');
    expect(out).toContain('Said: spillage');
    expect(out).toContain('Sarah Achieng');
    expect(out).toContain('Review Samosa filling, PREP-0131');
    expect(out).toContain('>Review<');
  });
  it('draws warning chips for the alarms and the quiet chip for what was said', () => {
    const out = band({});
    expect(out).toMatch(/bg-wds-warning-bg[^"]*">Low yield/);
    expect(out).toMatch(/bg-wds-neutral-50[^"]*">Said: spillage/);
  });
  it('empty is "All clear. Nothing needs your review." with a green dot', () => {
    const out = band({ data: { count: 0, items: [] } });
    expect(out).toContain('All clear');
    expect(out).toContain('Nothing needs your review.');
    expect(out).toContain('bg-wds-success-fg');
    expect(out).not.toContain('Review</button>');
  });
  it('loading is one skeleton row inside the band, header kept', () => {
    const out = band({ data: null, status: 'loading' });
    expect(out).toContain('Needs a look');
    expect(out).toContain('Loading runs that need a look');
  });
  it('error keeps the header and offers Try again, with the step 23 wording', () => {
    const out = band({ data: null, status: 'error' });
    expect(out).toContain("Couldn&#x27;t check for runs that need a look");
    expect(out).toContain('Try again');
  });
  it('shows only 5 and says how many more there are', () => {
    const items = Array.from({ length: 7 }, (_, i) => item({ id: `r${i}`, reference: `PREP-01${i}` }));
    const out = band({ data: { count: 7, items } });
    expect(out).toContain('Showing 5 of 7');
    expect(out).toContain('See all 7 in the table');
    expect(out).not.toContain('PREP-015,');
  });
});
