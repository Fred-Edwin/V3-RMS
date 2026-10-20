import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HiddenNote } from '../../_shared/components/amount';
import type { Section } from '../../_shared/types/payslip-types';
import { YearCard } from '../../home/components/year-card';
import { SectionTable } from './section-table';

const section: Section = {
  earnings: [
    { key: 'BASIC', label: 'Basic pay', amount: '45000.00', working: 'Monthly rate', correctedFrom: null },
    { key: 'OT', label: 'Overtime, 35 min', amount: '190.00', working: '35 min × KES 216.35 an hour × 1.5', correctedFrom: '410.00' },
  ],
  gross: '45190.00',
  deductions: [{ key: 'PAYE', label: 'PAYE', amount: '7329.00', working: 'Personal relief KES 2,400 a month', correctedFrom: null }],
  totalDeductions: '10330.00',
  net: '34860.00',
};
const FIGURES = ['45,000', '45000', '190', '45,190', '7,329', '10,330', '34,860', '410', '216.35', '2,400'];

describe('hidden amounts are not in the page', () => {
  it('puts no figure, no working line and no old figure in the markup while hidden', () => {
    const out = renderToStaticMarkup(h(SectionTable, { caption: 'Earned this month', heading: 'EARNED', lines: section.earnings, totalLabel: 'Gross pay', total: section.gross, shown: false }))
      + renderToStaticMarkup(h(SectionTable, { caption: 'Taken off this month', heading: 'TAKEN OFF', lines: section.deductions, totalLabel: 'Total taken off', total: section.totalDeductions, shown: false }))
      + renderToStaticMarkup(h(YearCard, { ytd: { fromMonth: '2026-01', toMonth: '2026-09', earned: '406420.00', takenOff: '92770.00', net: '313650.00' }, shown: false }));
    for (const f of [...FIGURES, '406,420', '92,770', '313,650']) expect(out, f).not.toContain(f);
    expect(out).toContain('corrected'); // the word stays; the old figure does not
    expect(out).toContain('Amount hidden'); // read once for the year card
  });

  it('shows the figures, the working and the old figure when shown', () => {
    const out = renderToStaticMarkup(h(SectionTable, { caption: 'Earned this month', heading: 'EARNED', lines: section.earnings, totalLabel: 'Gross pay', total: section.gross, shown: true }));
    expect(out).toContain('45,000');
    expect(out).toContain('corrected from 410');
    expect(out).toContain('35 min × KES 216.35 an hour × 1.5');
  });

  it('is a real table with a caption and header cells, and a corrected line is marked by words as well as fill', () => {
    const out = renderToStaticMarkup(h(SectionTable, { caption: 'Earned this month', heading: 'EARNED', lines: section.earnings, totalLabel: 'Gross pay', total: section.gross, shown: false }));
    expect(out).toContain('<caption');
    expect(out).toContain('scope="row"');
    expect(out).toContain('scope="col"');
  });

  it('reads "Amount hidden" once per group, and nothing when shown', () => {
    expect(renderToStaticMarkup(h(HiddenNote, { shown: false }))).toContain('Amount hidden');
    expect(renderToStaticMarkup(h(HiddenNote, { shown: true }))).toBe('');
  });
});
