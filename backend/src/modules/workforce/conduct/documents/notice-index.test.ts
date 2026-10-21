import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { hashPrefixOf } from '../../_shared/documents/qr-hash';
import type { ConductNotice } from '../_shared/conduct-notices-repository';
import type { ConductDecision } from '../appeals/decisions-repository';
import { conductDocumentHash, verifyAddressOf } from './notice-hash';
import { isIndexable, noticeDocumentInput } from './notice-index';

const notice = (over: Partial<ConductNotice> = {}): ConductNotice =>
  ({
    id: 'n1', companyId: 'c1', siteId: 's1', personUserId: 'u1', issuerId: 'i1', issuerName: 'Faith Njeri', issuerRole: 'Branch Manager',
    level: 'WRITTEN_WARNING', about: 'LATENESS', number: 7, issuedAt: new Date('2026-10-19T08:00:00Z'), status: 'SIGNED', signedAt: new Date('2026-10-19T09:00:00Z'),
    letterSnapshot: { heading: 'Written warning', body: ['Arrived late on 3 days'] }, factsSnapshot: { lateDays: 3 }, documentVersion: 1,
    ...over,
  }) as unknown as ConductNotice;
const decision = (version: number, over: Partial<ConductDecision> = {}): ConductDecision =>
  ({ version, outcome: 'KEEP', reason: 'The dates in the letter are right.', decidedById: 'h1', decidedByName: 'Mercy Achieng', decidedByRole: 'HR', decidedAt: new Date('2026-10-22T08:00:00Z'), ...over }) as ConductDecision;

describe('conduct documents: the hash and the QR', () => {
  it('is stable, differs per version, and ignores the receipt state and the decision reason', () => {
    const a = conductDocumentHash(notice(), 1, []);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(conductDocumentHash(notice({ status: 'APPEALED', signedAt: null }), 1, [])).toBe(a);
    const withDecision = [decision(2)];
    expect(conductDocumentHash(notice({ documentVersion: 2 }), 2, withDecision)).not.toBe(a);
    expect(conductDocumentHash(notice({ documentVersion: 2 }), 2, [decision(2, { reason: 'something else entirely' })])).toBe(conductDocumentHash(notice({ documentVersion: 2 }), 2, withDecision));
    expect(conductDocumentHash(notice({ documentVersion: 2 }), 1, withDecision)).toBe(a);
  });

  it('prints the first 10 characters of the hash the index stores', () => {
    const n = notice();
    const input = noticeDocumentInput(n, 1, []);
    expect(verifyAddressOf('http://localhost:3000/', n, 1, [])).toBe(`http://localhost:3000/verify/wrn/WRN-0007?h=${hashPrefixOf(input.hash)}`);
    expect(hashPrefixOf(input.hash)).toHaveLength(10);
  });
});

describe('conduct documents: what the index row carries', () => {
  it('has the level and the issue day, and no reason, category, fact or name of the person', () => {
    const input = noticeDocumentInput(notice(), 1, []);
    expect(input).toMatchObject({ kind: 'WRN', number: 'WRN-0007', version: 1, title: 'Warning notice · Written warning', about: 'Mon 19 Oct', subjectUserId: 'u1', signedBy: { id: 'i1', role: 'Branch Manager' } });
    expect(JSON.stringify({ title: input.title, about: input.about })).not.toMatch(/late|lateness|behaviour|3 days/i);
  });

  it('version 2 is signed by the person who decided, on the decision day', () => {
    const input = noticeDocumentInput(notice({ documentVersion: 2 }), 2, [decision(2)]);
    expect(input).toMatchObject({ version: 2, signedBy: { id: 'h1', name: 'Mercy Achieng', role: 'HR' }, signedAt: new Date('2026-10-22T08:00:00Z') });
  });
});

describe('conduct documents: which notices are indexed', () => {
  it.each([
    ['signed', {}, true],
    ['appealed', { status: 'APPEALED', signedAt: null }, true],
    ['ended unsigned', { status: 'ENDED', signedAt: null }, true],
    ['recorded by a reduction', { status: 'RECORDED', signedAt: null }, true],
    ['issued, waiting for the person', { status: 'ISSUED', signedAt: null }, false],
    ['given, not signed', { status: 'GIVEN_NOT_SIGNED', signedAt: null }, false],
    ['a verbal note', { level: 'VERBAL_NOTE', number: null, letterSnapshot: null }, false],
  ] as const)('%s', (_label, over, expected) => {
    expect(isIndexable(notice(over as Partial<ConductNotice>))).toBe(expected);
  });
});
