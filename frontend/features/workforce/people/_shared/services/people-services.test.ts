import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: { method: string; path: string; body?: unknown; token?: string }[] = [];

vi.mock('@/lib/apiClient', () => {
  const record = (method: string) => async (path: string, ...rest: unknown[]) => {
    const hasBody = method !== 'GET' && method !== 'DELETE';
    calls.push({ method, path, body: hasBody ? rest[0] : undefined, token: (hasBody ? rest[1] : rest[0]) as string | undefined });
    return {};
  };
  return {
    apiClient: {
      get: record('GET'),
      post: record('POST'),
      put: record('PUT'),
      patch: record('PATCH'),
      delete: record('DELETE'),
      getWithEnvelope: async (path: string, token?: string) => {
        calls.push({ method: 'GET', path, token });
        return { data: [{ id: 'e1' }], pagination: { total: 41, page: 2, perPage: 20, totalPages: 3 } };
      },
    },
  };
});
vi.mock('@/lib/env', () => ({ env: { apiUrl: 'http://api.test' } }));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ accessToken: 'tok' }) } }));

import { peopleReads, queryString } from './people-reads';
import { peopleWrites } from './people-writes';

beforeEach(() => {
  calls.length = 0;
});

describe('queryString', () => {
  it('sends only the values that are set', () => {
    expect(queryString({ filter: 'needs_finishing', q: undefined, siteId: '', page: 2 })).toBe('?filter=needs_finishing&page=2');
    expect(queryString({})).toBe('');
  });
  it('encodes what a person typed', () => {
    expect(queryString({ q: 'joy & co' })).toBe('?q=joy%20%26%20co');
  });
});

describe('people reads', () => {
  it('keeps the pager the server sent with the rows', async () => {
    const page = await peopleReads.list({ filter: 'casual_pool', page: 2 });
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/workforce/people?filter=casual_pool&page=2', token: 'tok' });
    expect(page.rows).toHaveLength(1);
    expect(page.pagination.totalPages).toBe(3);
  });
  it('asks the duplicate check by the fields it was given', async () => {
    await peopleReads.duplicateCheck({ nationalId: '31245678' });
    expect(calls[0]?.path).toBe('/workforce/people/duplicate-check?nationalId=31245678');
  });
  it('reads pay changes waiting by default', async () => {
    await peopleReads.payChanges();
    expect(calls[0]?.path).toBe('/workforce/people/pay-changes?status=PENDING');
  });
});

describe('people writes', () => {
  it('sends a pay change to the person it is about', async () => {
    await peopleWrites.requestPayChange('p1', { amount: '31000', effectiveFrom: '2026-11-01', reason: 'PROBATION_CONFIRMED', pin: '1234' });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/workforce/people/p1/pay-changes', token: 'tok' });
    expect(calls[0]?.body).toEqual({ amount: '31000', effectiveFrom: '2026-11-01', reason: 'PROBATION_CONFIRMED', pin: '1234' });
  });
  it('sends the Director decision to the change, not the person', async () => {
    await peopleWrites.decidePayChange('c9', { decision: 'DECLINE', note: 'Not yet', pin: '1234' });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/workforce/people/pay-changes/c9/decision' });
  });
  it('previews a transfer and an exit without writing', async () => {
    await peopleWrites.previewTransfer('p1', { toSiteId: 's2', toDepartmentId: 'd2', startsOn: '2026-10-12' });
    await peopleWrites.previewExit('p1', { lastDay: '2026-10-31', reason: 'RESIGNED' });
    expect(calls.map((c) => c.path)).toEqual(['/workforce/people/p1/transfer/preview', '/workforce/people/p1/exit/preview']);
  });
  it('reveals one named field', async () => {
    await peopleWrites.reveal('p1', 'accountNumber');
    expect(calls[0]).toMatchObject({ path: '/workforce/people/p1/reveal', body: { field: 'accountNumber' } });
  });
  it('removes a draft with DELETE', async () => {
    await peopleWrites.deleteDraft('d1');
    expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/workforce/people/drafts/d1' });
  });
});
