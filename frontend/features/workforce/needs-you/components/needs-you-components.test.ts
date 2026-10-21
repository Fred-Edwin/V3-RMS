import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { NeedsYouRow } from '../types/needs-you-types';
import { NeedsYouPhoneCards } from './needs-you-phone-cards';
import { NeedsYouTable } from './needs-you-table';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const NOW = new Date('2026-10-20T09:00:00Z');

const row = (over: Partial<NeedsYouRow>): NeedsYouRow => ({
  id: 'overtime:1',
  kind: 'overtime',
  text: 'Dan Kiprop, Waiter · 1 h 40 over the week',
  opens: '/app/workforce/timesheets',
  badge: 'workforce-timesheets',
  since: '2026-10-19T08:00:00Z',
  siteId: null,
  siteName: null,
  waitingOnRole: 'MANAGER',
  personUserId: null,
  canRemind: false,
  isNew: false,
  ...over,
});

describe('the Needs you table', () => {
  it('is a real table with the four columns of the design', () => {
    const out = html(h(NeedsYouTable, { rows: [row({})], now: NOW }));
    expect(out).toContain('<table');
    for (const column of ['Kind', 'Request', 'Where you decide', 'Since']) expect(out).toContain(column);
  });

  it('makes each row one link named with the kind, the request and since, and opens the page where it is decided', () => {
    const out = html(h(NeedsYouTable, { rows: [row({})], now: NOW }));
    expect(out).toContain('href="/app/workforce/timesheets"');
    expect(out).toContain('aria-label="Overtime, Dan Kiprop, Waiter · 1 h 40 over the week, since Yesterday"');
    expect(out).toContain('Timesheets');
  });

  it('uses the amber fill, bold text and bar only for a row that is new, and reads it as "new"', () => {
    const plain = html(h(NeedsYouTable, { rows: [row({})], now: NOW }));
    const fresh = html(h(NeedsYouTable, { rows: [row({ isNew: true })], now: NOW }));
    expect(plain).not.toContain('bg-wds-warning-bg');
    expect(fresh).toContain('bg-wds-warning-bg');
    expect(fresh).toContain('font-semibold');
    expect(fresh).toContain(', new"');
  });

  it('colours Since neutral today, amber from yesterday and red after 3 days', () => {
    expect(html(h(NeedsYouTable, { rows: [row({ since: '2026-10-20T06:02:00Z' })], now: NOW }))).toContain('Today 09:02');
    expect(html(h(NeedsYouTable, { rows: [row({})], now: NOW }))).toContain('text-wds-warning-fg');
    expect(html(h(NeedsYouTable, { rows: [row({ since: '2026-10-10T08:00:00Z' })], now: NOW }))).toContain('text-wds-error-fg');
  });

  it('fixes the links the server guessed', () => {
    const out = html(h(NeedsYouTable, { rows: [row({ kind: 'tables', text: 'Confirm the tables', opens: '/app/workforce/rules/statutory' })], now: NOW }));
    expect(out).toContain('href="/app/workforce/rules?tab=statutory"');
    expect(out).toContain('Rules');
  });

  it('draws a keyboard ring on the row overlay and a hover tint for pointer devices only', () => {
    const out = html(h(NeedsYouTable, { rows: [row({})], now: NOW }));
    expect(out).toContain('focus-visible:after:shadow');
    expect(out).toContain('hover:bg-wds-neutral-50');
    expect(out).toContain('(hover:hover)');
  });

  it('shows a greyed table when the list is old', () => {
    expect(html(h(NeedsYouTable, { rows: [row({})], now: NOW, dim: true }))).toContain('opacity-60');
  });
});

describe('the Needs you cards on a phone', () => {
  it('draws one card per row with a 44 px Open link', () => {
    const out = html(h(NeedsYouPhoneCards, { rows: [row({}), row({ id: 'clock-fix:2', kind: 'clock-fix', text: 'Amina Hassan, Barista · a clock-out was missed', opens: '/app/workforce/requests' })], now: NOW }));
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain('min-h-[44px]');
    expect(out).toContain('href="/app/workforce/requests"');
    expect(out).toContain('CLOCK FIX');
  });

  it('holds no pay figure for any kind of row', () => {
    const out = html(h(NeedsYouPhoneCards, { rows: [row({ kind: 'payroll', text: 'Approve the October payroll · 86 people · reviewed by Mercy Achieng, HR Manager', opens: '/app/workforce/payroll' })], now: NOW }));
    expect(out).not.toMatch(/KES|Ksh|\d,\d{3}/);
    expect(out).toContain('86 people');
  });
});
