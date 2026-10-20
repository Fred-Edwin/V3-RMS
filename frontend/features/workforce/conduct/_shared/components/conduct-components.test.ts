import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { FactsTable } from '../../desk/components/facts-table';
import { PersonPicker } from '../../issue/components/person-picker';
import { NoticeCard } from '../../staff/components/notice-card';
import { StatColumns } from '../../staff/components/stat-columns';
import type { StaffItem } from '../types/conduct-types';
import { LegendLine } from './legend-line';
import { LegacyRows } from './legacy-rows';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() }));

const item: StaffItem = {
  id: 'n1',
  level: 'WRITTEN_WARNING',
  number: 'WRN-0007',
  title: 'Written warning · WRN-0007',
  aboutLabel: 'Lateness',
  issuedAt: '2026-10-09T13:42:00.000Z',
  validUntil: '2027-04-09',
  validUntilLabel: '9 Apr 2027',
  status: 'ISSUED',
  statusWord: 'To sign',
  headline: 'Lateness · Fri 9 Oct · ends 9 Apr 2027',
  canSign: true,
  canAppeal: true,
  hasLetter: true,
  replacedById: null,
};
const draw = (over: Partial<StaffItem> = {}, muted = false): string => renderToStaticMarkup(createElement(NoticeCard, { item: { ...item, ...over }, tone: 'warning', muted, onDownload: () => undefined, downloading: false }));

describe('NoticeCard', () => {
  it('is one link to the notice, with a separate named download button and the status in words', () => {
    const html = draw();
    expect(html).toContain('href="/app/conduct/n1"');
    expect(html).toContain('aria-label="Download signed notice WRN-0007"');
    expect(html).toContain('Status: </span>To sign');
  });
  it('marks a notice waiting to be signed with the amber bar, and a finished one with none', () => {
    expect(draw()).toContain('border-l-wds-caramel-600');
    expect(draw({ canSign: false, status: 'ENDED', statusWord: 'Ended' }, true)).not.toContain('border-l-wds-caramel-600');
  });
  it('has no download square for a verbal note (no letter)', () => {
    expect(draw({ level: 'VERBAL_NOTE', hasLetter: false, number: null })).not.toContain('Download signed notice');
  });
});

describe('StatColumns', () => {
  it('lists the three figures as a description list and warms the middle one when it is above zero', () => {
    const html = renderToStaticMarkup(createElement(StatColumns, { columns: [{ key: 'toSign', label: 'TO SIGN', value: 0 }, { key: 'canAppeal', label: 'CAN APPEAL', value: 1 }, { key: 'ended', label: 'ENDED', value: 0 }] }));
    expect(html).toContain('<dl');
    expect(html).toContain('TO SIGN');
    expect(html.match(/text-wds-caramel-300/g)).toHaveLength(1);
  });
});

describe('FactsTable', () => {
  const rows = [
    { date: '2026-09-09', plannedIn: '06:00', clockIn: '06:09', minutesLate: 9, excused: false, named: true },
    { date: '2026-09-16', plannedIn: '06:00', clockIn: '06:08', minutesLate: 8, excused: false, named: false },
  ];
  const html = renderToStaticMarkup(createElement(FactsTable, { rows, totalMinutes: 17, kind: 'LATENESS' }));
  it('is a real table with column scopes and a total', () => {
    expect(html).toContain('<table');
    expect(html.match(/scope="col"/g)).toHaveLength(3);
    expect(html).toContain('17 min');
  });
  it('tints and announces only the day named in the appeal', () => {
    expect(html.match(/bg-wds-warning-bg/g)).toHaveLength(1);
    expect(html).toContain('named in the appeal');
  });
});

describe('PersonPicker', () => {
  it('is a labelled combobox that starts closed', () => {
    const html = renderToStaticMarkup(createElement(PersonPicker, { person: null, siteLabel: 'Nyeri Town', onPick: () => undefined, onClear: () => undefined, disabled: false }));
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Who is this notice for?"');
  });
  it('shows the chosen person with a Change button', () => {
    const person = { id: 'p1', name: 'Mark Njoroge', department: 'Barista', employeeNumber: 'WND-0412', isMyTeam: true, hasLogin: true, activeNotices: [] };
    const html = renderToStaticMarkup(createElement(PersonPicker, { person, siteLabel: 'Nyeri Town', onPick: () => undefined, onClear: () => undefined, disabled: false }));
    expect(html).toContain('Mark Njoroge · Barista · Nyeri Town');
    expect(html).toContain('Change');
  });
});

describe('status help and old records', () => {
  it('opens from a summary and lists every status', () => {
    const html = renderToStaticMarkup(createElement(LegendLine));
    expect(html).toContain('<details');
    expect(html).toContain('What do the statuses mean?');
    for (const word of ['Issued', 'Given, not signed', 'Replaced on appeal', 'Withdrawn', 'Ended']) expect(html).toContain(word);
  });
  it('lists old records read only, with no way to act on them', () => {
    const html = renderToStaticMarkup(createElement(LegacyRows, { rows: [{ id: 'l1', level: 'WRITTEN', actionDate: '2025-03-04', label: 'Written warning · lateness' }] }));
    expect(html).toContain('BEFORE THE NEW SYSTEM');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<a ');
  });
});
