import { describe, expect, it } from 'vitest';

import { defaultQuery, parseSelected, paramsFromQuery, queryFromParams, selectedKey } from './documents-query';
import { dateLong, documentLine, footer, replacesLine, statusLine, statusWord } from './documents-words';
import { openRequest, listParams } from '../services/documents-services';
import type { DocumentPanelData } from '../types/documents-types';

const TODAY = '2026-10-19';
const from = (s: string) => {
  const p = new URLSearchParams(s);
  return queryFromParams((k) => p.get(k), TODAY, null);
};

describe('the Signed documents view in the address bar', () => {
  it('defaults to the last 30 days, 50 rows, and keeps only what differs', () => {
    expect(from('')).toMatchObject({ from: '2026-09-20', to: TODAY, pageSize: 50, sort: 'newest' });
    const q = { ...defaultQuery(TODAY), q: 'PS-09', type: 'PS', page: 2, pageSize: 25 as const };
    expect(paramsFromQuery(q, TODAY).toString()).toBe('q=PS-09&type=PS&page=2&rows=25');
    expect(from('q=PS-09&type=PS&page=2&rows=25')).toEqual(q);
  });

  it('drops a hand-edited value instead of sending the API a 400', () => {
    expect(from('rows=7&type=nope!&site=x&page=0&from=bad')).toMatchObject({ pageSize: 50, type: '', siteId: '', page: 1, from: '2026-09-20' });
  });

  it('sends page sizes of 25, 50 or 100 only', () => {
    expect(listParams({ ...defaultQuery(TODAY), pageSize: 100 }).get('pageSize')).toBe('100');
    expect(from('rows=100').pageSize).toBe(100);
  });

  it('keeps the chosen document as number.version', () => {
    expect(parseSelected('PS-0987.2')).toEqual({ number: 'PS-0987', version: 2 });
    expect(parseSelected('PAY-2026-09.1')).toEqual({ number: 'PAY-2026-09', version: 1 });
    expect(parseSelected('nonsense')).toBeNull();
    expect(selectedKey('PS-0987', 2)).toBe('PS-0987.2');
  });
});

describe('the words of the index', () => {
  it('words a version, a replacement and a status in text, not colour', () => {
    expect(documentLine({ title: 'Payslip', version: 2, about: 'September 2026' })).toBe('Payslip · version 2 · September 2026');
    expect(replacesLine({ version: 2, replacesVersion: 1 })).toBe('Version 2 replaces version 1');
    expect(statusWord('CURRENT')).toBeNull();
    expect(statusWord('REPLACED')).toBe('Replaced');
    expect(dateLong('2026-10-20T09:00:00.000Z')).toBe('20 Oct 2026');
  });

  it('writes the panel line for withdrawn, replaced and archived', () => {
    const p = (over: Partial<DocumentPanelData>): DocumentPanelData => ({
      number: 'PS-0987', version: 1, kind: 'PS', title: 'Payslip', about: 'September 2026', organizationName: null, signedBy: { name: 'A', role: 'ACCOUNTANT' }, signedAt: '2026-10-19T08:00:00.000Z', status: 'CURRENT', replacesVersion: null,
      approvedBy: { name: 'A', role: 'ACCOUNTANT', at: '2026-10-19T08:00:00.000Z' }, reviewedBy: null, method: 'PIN', replacedBy: null, withdrawn: null, forPerson: null, verifyUrl: 'x', openHref: '/x', ...over,
    });
    expect(statusLine(p({ status: 'WITHDRAWN', withdrawn: { on: '2026-10-20T09:00:00.000Z', byRole: 'ACCOUNTANT', replacedByNumber: 'PS-0987' } }))).toBe('Withdrawn on 20 Oct 2026 by the Accountant. Replaced by PS-0987.');
    expect(statusLine(p({ status: 'REPLACED', replacedBy: { number: 'PS-0987', version: 2, on: '2026-10-20T09:00:00.000Z' } }))).toBe('Replaced by version 2 on 20 Oct 2026.');
    expect(statusLine(p({ status: 'ARCHIVED', openHref: null }))).toBe('Archived. Ask support for a copy.');
    expect(statusLine(p({}))).toBeNull();
  });

  it('writes the footer, with the over-50,000 wording', () => {
    expect(footer(1, 50, 50, 214, true)).toBe('Showing 1 to 50 of 214 documents');
    expect(footer(1, 50, 50, 50000, false)).toContain('of over 50,000 documents. Narrow the dates');
    expect(footer(1, 50, 0, 0, true)).toBe('');
  });
});

describe('opening a document by the method its own route wants', () => {
  it('uses POST for payroll, timesheet and P9 files, GET for the rest', () => {
    expect(openRequest('PAY', '/workforce/payroll/months/2026-09/exports')).toMatchObject({ method: 'POST', body: { kind: 'SUMMARY', format: 'pdf' } });
    expect(openRequest('TSH', '/workforce/timesheets/months/2026-09/exports')).toMatchObject({ method: 'POST', body: { format: 'pdf', scope: 'month' } });
    expect(openRequest('P9', '/workforce/payslips/p9/x')).toMatchObject({ method: 'POST' });
    expect(openRequest('CPS', '/workforce/casual/sheets/abc/document')).toEqual({ method: 'GET' });
    expect(openRequest('PS', '/workforce/payslips/abc/document')).toEqual({ method: 'GET' });
  });
});
