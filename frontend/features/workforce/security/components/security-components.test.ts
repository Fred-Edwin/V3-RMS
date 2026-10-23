import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { AlertRow } from '../types/security-types';
import { AlertPanel } from './alert-panel';

const html = (el: Parameters<typeof renderToStaticMarkup>[0]): string => renderToStaticMarkup(el);
const noop = (): void => undefined;
const NOW = new Date('2026-10-20T11:30:00Z');

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
