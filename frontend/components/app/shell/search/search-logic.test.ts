import { describe, expect, it } from 'vitest';

import { flatLinks, highlight, matches, personLine, searchLinks } from './search-logic';

const GROUPS = [
  {
    key: 'wf',
    label: 'WORKFORCE',
    items: [
      { key: 'home', label: 'Home', href: '/app/workforce' },
      { key: 'pay', label: 'Payroll', href: '/app/workforce/payroll' },
      { key: 'time', label: 'Time', href: '/app/workforce/leave', subItems: [{ key: 'leave', label: 'Leave', href: '/app/workforce/leave' }] },
    ],
  },
];

describe('shell Search', () => {
  it('bolds the typed stretch, or the letters in order', () => {
    expect(highlight('Payroll', 'pay')).toEqual([{ text: 'Pay', bold: true }, { text: 'roll', bold: false }]);
    expect(highlight('Payroll', 'pr')).toEqual([{ text: 'P', bold: true }, { text: 'ay', bold: false }, { text: 'r', bold: true }, { text: 'oll', bold: false }]);
    expect(highlight('Payroll', 'zz')).toEqual([{ text: 'Payroll', bold: false }]);
    expect(highlight('Payroll', '  ')).toEqual([{ text: 'Payroll', bold: false }]);
  });

  it('matches stretches and in-order letters, case blind', () => {
    expect(matches('Audit log', 'AUD')).toBe(true);
    expect(matches('Audit log', 'alg')).toBe(true);
    expect(matches('Audit log', 'xyz')).toBe(false);
  });

  it('flattens the menu (sub-links in place of their parent) and ranks starts-with first', () => {
    const links = flatLinks(GROUPS);
    expect(links.map((l) => l.label)).toEqual(['Home', 'Payroll', 'Leave']);
    expect(searchLinks(links, 'l').map((l) => l.label)).toEqual(['Leave', 'Payroll']);
    expect(searchLinks(links, '', 2)).toHaveLength(2);
  });

  it('writes the person line with the site last', () => {
    expect(personLine({ name: 'Joy Chebet Rotich', positionName: 'Barista', organizationName: 'Nyeri Town' })).toBe('Joy Chebet Rotich · Barista · Nyeri Town');
    expect(personLine({ name: 'Mary', positionName: null, organizationName: 'Central Store' })).toBe('Mary · Central Store');
  });
});
