import { describe, expect, it } from 'vitest';

import { config } from '@/middleware';

import type { SignedInAnswer, VerifyAnswer } from '../types/verify-types';
import { checkedWords, issuerRoleOf, reportLabel, validHash, viewOf } from './verify-view';

const NOW = new Date('2026-10-19T11:30:00.000Z'); // 14:30 in Nairobi
const base: VerifyAnswer = { outcome: 'GENUINE', kind: 'PAY', number: 'PAY-2026-09', documentLabel: 'Payroll', version: 1, periodLabel: 'September 2026', signedByRole: 'ACCOUNTANT', signedOn: '2026-10-19T08:05:00.000Z', checkedAt: NOW.toISOString(), employerName: 'Wendo Coffee Bistro' };

describe('the public verify page: seven outcomes, role and date only', () => {
  it('genuine: green, role and date, no name', () => {
    const v = viewOf(base, 'pay', null, NOW);
    expect(v).toMatchObject({ tone: 'success', kicker: '✓ THIS COPY MATCHES THE RECORD', title: 'Payroll PAY-2026-09', action: 'signin' });
    expect(v.text).toBe('September 2026. Signed with a PIN by the Accountant on 19 Oct 2026.');
    expect(v.rows).toEqual([{ label: 'Status', value: 'Signed, not changed' }, { label: 'Version', value: '1' }, { label: 'Checked', value: 'Today 14:30' }]);
  });

  it('replaced: amber, asks for the new copy', () => {
    const v = viewOf({ ...base, outcome: 'REPLACED', kind: 'PS', number: 'PS-0987', documentLabel: 'Payslip', replacedByVersion: 2, replacedOn: '2026-10-20T09:00:00.000Z' }, 'ps', null, NOW);
    expect(v).toMatchObject({ tone: 'warning', kicker: 'THIS COPY IS GENUINE BUT REPLACED', title: 'Payslip PS-0987, version 1' });
    expect(v.text).toBe('Replaced by version 2 on 20 Oct 2026. Ask for the new copy and do not use this one.');
  });

  it('withdrawn: red, no button', () => {
    const v = viewOf({ ...base, outcome: 'WITHDRAWN', withdrawnOn: '2026-10-20T09:00:00.000Z', withdrawnByRole: 'ACCOUNTANT', replacedByNumber: 'PS-0988' }, 'pay', null, NOW);
    expect(v).toMatchObject({ tone: 'error', kicker: 'THIS DOCUMENT WAS WITHDRAWN', action: null });
    expect(v.text).toBe('Withdrawn on 20 Oct 2026 by the Accountant. Replaced by PS-0988.');
  });

  it('archived, too many checks, and not verified (one answer for unknown and wrong hash)', () => {
    expect(viewOf({ ...base, outcome: 'ARCHIVED' }, 'pay', null, NOW)).toMatchObject({ tone: 'neutral', kicker: 'THIS DOCUMENT IS ARCHIVED', action: null });
    expect(viewOf({ outcome: 'RATE_LIMITED', checkedAt: NOW.toISOString(), employerName: 'x' }, 'pay', null, NOW)).toMatchObject({ title: 'Too many checks', text: 'Wait a minute, then scan again.' });
    const nv = viewOf({ outcome: 'NOT_VERIFIED', checkedAt: NOW.toISOString(), employerName: 'x' }, 'cps', null, NOW);
    expect(nv).toMatchObject({ tone: 'error', kicker: 'THIS COPY DOES NOT MATCH', title: 'We could not match this copy', action: null });
    expect(viewOf({ outcome: 'MALFORMED', checkedAt: NOW.toISOString(), employerName: 'x' }, 'cps', null, NOW).kicker).toBe(nv.kicker);
  });

  it('never says which part differs, what a total is, a person, a site or a head count', () => {
    const everything = [base, { ...base, outcome: 'REPLACED' as const }, { ...base, outcome: 'WITHDRAWN' as const }, { ...base, outcome: 'NOT_VERIFIED' as const }].map((a) => JSON.stringify(viewOf(a, 'cps', null, NOW)));
    for (const text of everything) {
      expect(text).not.toMatch(/total|differs|people|KES|head count|site/i);
    }
  });
});

describe('the signed-in view', () => {
  const signed = (over: Partial<SignedInAnswer>): SignedInAnswer => ({ ...base, signedBy: null, canOpen: false, openHref: null, readableBy: [], ...over });

  it('names the signer and offers Open to a person who may read it', () => {
    const v = viewOf(signed({ canOpen: true, signedBy: { name: 'Anne Muthoni', role: 'ACCOUNTANT' }, openHref: '/x' }), 'pay', { name: 'Mercy', role: 'HR_MANAGER' }, NOW);
    expect(v.action).toBe('open');
    expect(v.text).toContain('Anne Muthoni, Accountant');
  });

  it('tells a signed-in person who may not read it, and offers Home', () => {
    const v = viewOf(signed({ readableBy: ['the Accountant', 'HR', 'the Director'] }), 'pay', { name: 'Joy Chebet', role: 'WAITER' }, NOW);
    expect(v).toMatchObject({ tone: 'warning', kicker: 'SIGNED IN AS JOY CHEBET, WAITER', title: 'You cannot read PAY-2026-09', action: 'home' });
    expect(v.text).toBe('It is a payroll for the Accountant, HR, the Director. The check on the earlier page still holds.');
  });

  it('offers "Tell the ..." for a copy that does not match, to the issuer of that type', () => {
    const v = viewOf(signed({ outcome: 'NOT_VERIFIED' }), 'cps', { name: 'A', role: 'MANAGER' }, NOW);
    expect(v.action).toBe('report');
    expect(reportLabel('cps')).toBe('Tell the Branch Manager');
    expect(reportLabel('ps')).toBe('Tell the Accountant');
    expect(issuerRoleOf('zzz')).toBe('System Admin');
  });
});

describe('small helpers and the public gate', () => {
  it('accepts only a 10-character hash for the report call', () => {
    expect(validHash('3f9a1c2b4d')).toBe(true);
    expect(validHash('3F9A1C2B4D')).toBe(false);
    expect(validHash('short')).toBe(false);
    expect(validHash(null)).toBe(false);
  });

  it('words the check time in Nairobi', () => {
    expect(checkedWords('2026-10-18T07:00:00.000Z', NOW)).toBe('18 Oct 2026 10:00');
  });

  it('the sign-in middleware never runs on /verify, so the QR page opens for anyone', () => {
    const covers = (path: string): boolean => config.matcher.some((m) => new RegExp(`^${m.replace(/:path\*/g, '.*')}$`).test(path));
    expect(covers('/verify/ps/PS-0987')).toBe(false);
    expect(covers('/app/workforce/audit-log')).toBe(true);
  });
});
