import { describe, expect, it } from 'vitest';
import type { DocumentRow } from '../_shared/documents/documents-repository';
import { PUBLIC_KEYS, answerFor, bare, matchVersion, samePrefix } from './verify-outcome';

const now = new Date('2026-10-20T11:00:00.000Z');
const row = (over: Partial<DocumentRow> = {}): DocumentRow => ({
  id: 'd1', companyId: 'c1', siteId: 'site-secret', kind: 'PS', number: 'PS-0987', version: 1, title: 'Payslip', about: 'September 2026', subjectUserId: 'person-secret',
  signedById: 'u1', signedByName: 'Anne Muthoni', signedByRole: 'ACCOUNTANT', reviewedById: null, reviewedByName: 'Mercy Achieng', reviewedByRole: 'HR_MANAGER', reviewedAt: null,
  signedAt: new Date('2026-10-19T08:05:00.000Z'), method: 'PIN', hashPrefix: 'abcdef0123', hash: 'abcdef0123'.padEnd(64, '0'), status: 'CURRENT', replacedByVersion: null, replacedAt: null,
  withdrawnAt: null, withdrawnByRole: null, replacedByNumber: null, openHref: '/x', searchText: 'ps-0987', createdAt: now, ...over,
});

describe('verify outcomes', () => {
  it('genuine: role and date only', () => {
    const { answer, recorded } = answerFor(row(), now);
    expect(recorded).toBe('GENUINE');
    expect(answer).toMatchObject({ outcome: 'GENUINE', kind: 'PS', number: 'PS-0987', periodLabel: 'September 2026', signedByRole: 'ACCOUNTANT', version: 1 });
  });

  it('never carries a name, a person, a site, a hash or a figure, whatever the row holds', () => {
    const variants = [row(), row({ status: 'REPLACED', replacedByVersion: 2, replacedAt: now }), row({ status: 'WITHDRAWN', withdrawnAt: now, withdrawnByRole: 'ACCOUNTANT', replacedByNumber: 'PS-0990' }), row({ signedAt: new Date('2015-01-01') })];
    for (const r of variants) {
      const { answer } = answerFor(r, now);
      expect(Object.keys(answer).every((k) => (PUBLIC_KEYS as readonly string[]).includes(k))).toBe(true);
      const json = JSON.stringify(answer);
      expect(json).not.toMatch(/Anne|Mercy|site-secret|person-secret|abcdef0123|reviewed|total|differ/i);
    }
    expect(Object.keys(bare('NOT_VERIFIED', now)).sort()).toEqual(['checkedAt', 'employerName', 'outcome']);
  });

  it('replaced, withdrawn and archived each read as themselves', () => {
    expect(answerFor(row({ status: 'REPLACED', replacedByVersion: 2, replacedAt: now }), now).answer).toMatchObject({ outcome: 'REPLACED', replacedByVersion: 2 });
    expect(answerFor(row({ status: 'WITHDRAWN', withdrawnAt: now, withdrawnByRole: 'ACCOUNTANT', replacedByNumber: 'PS-0990' }), now).answer).toMatchObject({ outcome: 'WITHDRAWN', withdrawnByRole: 'ACCOUNTANT', replacedByNumber: 'PS-0990' });
    expect(answerFor(row({ signedAt: new Date('2015-01-01') }), now).answer.outcome).toBe('ARCHIVED');
  });

  it('a version is matched by its own hash prefix, and a wrong or short one matches nothing', () => {
    const v1 = row({ hashPrefix: 'aaaaaaaaaa' });
    const v2 = row({ version: 2, hashPrefix: 'bbbbbbbbbb' });
    expect(matchVersion([v2, v1], 'aaaaaaaaaa')).toBe(v1);
    expect(matchVersion([v2, v1], 'cccccccccc')).toBeNull();
    expect(samePrefix('abc', 'abcdef')).toBe(false);
    expect(samePrefix('abcdef0123', 'abcdef0123')).toBe(true);
  });
});
