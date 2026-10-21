import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AlertRow, Phone } from '../types/security-types';
import { AlertPanel } from './alert-panel';
import { PhoneCard } from './phone-card';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;
const NOW = new Date('2026-10-20T11:30:00Z');

const phone = (over: Partial<Phone> = {}): Phone => ({
  id: 'p1',
  label: 'Tecno, Android',
  placeLabel: 'Nairobi',
  firstSeenAt: '2026-10-20T11:03:00Z',
  lastSeenAt: '2026-10-20T11:03:00Z',
  confirmed: false,
  confirmedMode: null,
  isThisPhone: false,
  notUsedFor12Months: false,
  ...over,
});

const alert = (over: Partial<AlertRow> = {}): AlertRow => ({
  id: 'a1',
  kind: 'WASNT_ME',
  status: 'OPEN',
  occurredAt: '2026-10-19T11:05:00Z',
  person: { id: 'u1', name: 'Mercy Achieng', role: 'HR Manager' },
  deviceLabel: 'Tecno, Android',
  placeLabel: 'Nairobi',
  detail: null,
  siteId: null,
  auditEntryId: 'e1',
  clearedBy: null,
  clearedAt: null,
  clearNote: null,
  ...over,
});

const card = (p: Phone) => h(PhoneCard, { phone: p, now: NOW, busy: false, onConfirm: noop, onRemove: noop, onSignOut: noop });

describe('a phone card', () => {
  it('is a region named by the phone and whether it is confirmed, with a left bar in the matching colour', () => {
    const out = html(card(phone()));
    expect(out).toContain('aria-label="Tecno, Android, not confirmed"');
    expect(out).toContain('bg-wds-caramel-500');
    expect(html(card(phone({ confirmed: true })))).toContain('bg-wds-success-fg');
  });

  it('offers "Yes, this is my phone" and "Remove it" on a phone that is not confirmed, and only Remove on a confirmed one', () => {
    const out = html(card(phone()));
    expect(out).toContain('Yes, this is my phone');
    expect(out).toContain('Remove it');
    const confirmed = html(card(phone({ confirmed: true })));
    expect(confirmed).not.toContain('Yes, this is my phone');
    expect(confirmed).toContain('Remove it');
  });

  it('never offers to remove the phone in the person’s hand: it says Sign out instead', () => {
    const out = html(card(phone({ isThisPhone: true, confirmed: true })));
    expect(out).toContain('Sign out instead');
    expect(out).not.toContain('Remove it');
    expect(out).toContain('this phone');
  });

  it('gives every button a 44 px target, a keyboard ring and a pressed state', () => {
    const out = html(card(phone()));
    expect(out).toContain('min-h-[44px]');
    expect(out).toContain('focus-visible:shadow-wds-ring');
    expect(out).toContain('active:scale-[0.98]');
  });

  it('disables the buttons while a write is in flight', () => {
    const out = html(h(PhoneCard, { phone: phone(), now: NOW, busy: true, onConfirm: noop, onRemove: noop, onSignOut: noop }));
    expect(out.match(/disabled=""/g)?.length).toBe(2);
  });
});

describe('the alert panel', () => {
  const panel = (a: AlertRow, extra: { busy?: boolean; error?: string | null } = {}) =>
    h(AlertPanel, { alert: a, now: NOW, busy: extra.busy ?? false, error: extra.error ?? null, onClear: async () => true, onClose: noop });

  it('says which kind it is and writes the sentence, with a role beside the name', () => {
    const out = html(panel(alert()));
    expect(out).toContain("This wasn&#x27;t me");
    expect(out).toContain('Mercy Achieng, HR Manager pressed');
    expect(out).toContain('Every session was signed out. A new password and a new code are required.');
  });

  it('asks for a note and disables Clear with its reason until the note has 3 characters', () => {
    const out = html(panel(alert()));
    expect(out).toContain('What did you do?');
    expect(out).toContain('Clear this alert');
    expect(out).toContain('disabled=""');
    expect(out).toContain('Write what you did.');
  });

  it('shows who cleared a cleared alert, with the note, and no form', () => {
    const cleared = alert({ status: 'CLEARED', clearedBy: { id: 'u2', name: 'Wendo Admin', role: 'System Admin' }, clearedAt: '2026-10-20T08:00:00Z', clearNote: 'Spoke to Mercy; the phone was hers.' });
    const out = html(panel(cleared));
    expect(out).toContain('Cleared by Wendo Admin, System Admin at 11:00.');
    expect(out).toContain('Spoke to Mercy');
    expect(out).not.toContain('Clear this alert');
  });

  it('shows a refusal as an alert region', () => {
    expect(html(panel(alert(), { error: 'Cleared by Wendo Admin, System Admin.' }))).toContain('role="alert"');
  });

  it('holds no amount, code or payslip number', () => {
    const out = html(panel(alert({ kind: 'UNCONFIRMED_PHONE', detail: '2026-09' })));
    expect(out).not.toMatch(/KES|Ksh|\d,\d{3}/);
    expect(out).toContain('September payslip');
  });
});
