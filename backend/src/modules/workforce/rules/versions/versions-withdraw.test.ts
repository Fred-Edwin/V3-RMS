import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPinTries } from '../../_shared/pin/signer-pin';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed, state } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('./versions-repository', async () => ({ versionsRepository: (await import('../testing/rules-fake')).fakeVersionsRepository }));
vi.mock('../../_shared/audit/audit-writer', async () => ({ runAudited: (await import('../testing/rules-fake')).fakeRunAudited }));
vi.mock('../../_shared/pin/signer-pin-repository', async () => ({ signerPinRepository: { hashOf: (await import('../testing/rules-fake')).fakePinHash } }));
vi.mock('../../../../utils/password', () => ({ comparePin: async (pin: string, hash: string) => pin === hash }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { withdrawVersion } from './versions-withdraw';

const NOW = new Date('2026-10-06T08:00:00Z'); // 6 Oct in Nairobi
const lateness = (graceMinutes: number) => ({ ...RULE_DEFAULTS.LATENESS, graceMinutes });
const withdraw = (actor: string, id: string, over: { reason?: string; pin?: string } = {}) => withdrawVersion(as(actor), id, { reason: 'Wrong day', pin: '1234', ...over }, NOW);

beforeEach(() => {
  reset();
  resetPinTries();
});

describe('withdrawing a scheduled version', () => {
  it('marks it Withdrawn, keeps the row, writes the audit entry with the reason and the signature, and tells the same people', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    const done = await withdraw('dir', 'v1');
    expect(done).toMatchObject({ replay: false, version: { id: 'v1', status: 'WITHDRAWN', withdrawn: { reason: 'Wrong day', by: { name: 'Dina Director', role: 'DIRECTOR' } } } });
    expect(state.rows).toHaveLength(1); // never deleted
    expect(state.entries[0]).toMatchObject({ action: 'rules.version_withdrawn', category: 'RULES_OPERATING', reason: 'Wrong day', after: { group: 'LATENESS', version: 1, signature: { method: 'PIN' } } });
    expect(JSON.stringify(state.entries[0])).not.toContain('1234');
    const event = state.events[0];
    expect(event).toMatchObject({ name: 'rules.version_withdrawn', payload: { version: 1, withdrawnById: 'dir' } });
    expect(event && 'notice' in event.payload ? event.payload.notice.recipients.map((r) => r.userId).sort() : []).toEqual(['acc', 'bm1', 'bm2', 'hr', 'sm']);
  });

  it('a pay change is filed under RULES_PAY', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: { ...lateness(5), deductionCapPercentOfPay: 2 } });
    await withdraw('dir', 'v1');
    expect(state.entries[0]).toMatchObject({ category: 'RULES_PAY' });
  });

  it('is idempotent: a second withdrawal answers the same and writes nothing more', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    await withdraw('dir', 'v1');
    const again = await withdraw('dir', 'v1');
    expect(again).toMatchObject({ replay: true, version: { status: 'WITHDRAWN' } });
    expect(state.entries).toHaveLength(1);
  });

  it('a version that starts today or has started cannot be withdrawn', async () => {
    seed({ id: 'today', group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-06'), values: lateness(10) });
    seed({ id: 'old', group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: RULE_DEFAULTS.OVERTIME });
    await expect(withdraw('dir', 'today')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_VERSION_STARTED' });
    await expect(withdraw('dir', 'old')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_VERSION_STARTED' });
    expect(state.entries).toHaveLength(0);
  });

  it('only the newest version of a scope can be withdrawn, because the later ones were built on it', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    seed({ id: 'v2', group: 'LATENESS', version: 2, effectiveFrom: day('2026-12-01'), values: lateness(12) });
    await expect(withdraw('dir', 'v1')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_VERSION_NOT_LATEST', details: { latestVersion: 2 } });
    await withdraw('dir', 'v2');
    await expect(withdraw('dir', 'v1')).resolves.toBeTruthy(); // v2 is gone, so v1 is the newest again
  });

  it('needs the right to change that tab: HR, the Accountant and a waiter cannot withdraw lateness', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    for (const actor of ['hr', 'acc', 'w1']) await expect(withdraw(actor, 'v1')).rejects.toMatchObject({ statusCode: 403 });
    expect(state.entries).toHaveLength(0);
  });

  it('a branch manager withdraws their own site’s version, never the company’s, never another site’s (which does not exist for them)', async () => {
    seed({ id: 'own', group: 'LATENESS', siteId: 's1', version: 1, effectiveFrom: day('2026-11-02'), values: { graceMinutes: 3 } });
    seed({ id: 'other', group: 'LATENESS', siteId: 's2', version: 1, effectiveFrom: day('2026-11-02'), values: { graceMinutes: 3 } });
    seed({ id: 'company', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    await expect(withdraw('bm1', 'other')).rejects.toMatchObject({ statusCode: 404 });
    await expect(withdraw('bm1', 'company')).rejects.toMatchObject({ statusCode: 403 });
    await expect(withdraw('bm1', 'own')).resolves.toMatchObject({ version: { status: 'WITHDRAWN' } });
  });

  it('an unknown version, or one of another company, is a 404', async () => {
    await expect(withdraw('dir', 'nope')).rejects.toMatchObject({ statusCode: 404 });
    seed({ id: 'foreign', companyId: 'c2', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    await expect(withdraw('dir', 'foreign')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a wrong PIN stops it and nothing changes', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness(10) });
    await expect(withdraw('dir', 'v1', { pin: '0000' })).rejects.toMatchObject({ statusCode: 403, code: 'PIN_INVALID' });
    expect(state.rows[0]?.withdrawal).toBeNull();
  });

  it('the day is Nairobi’s: just after midnight in Nairobi, a version dated today has started', async () => {
    seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-10-07'), values: lateness(10) });
    await expect(withdrawVersion(as('dir'), 'v1', { reason: 'x', pin: '1234' }, new Date('2026-10-06T21:30:00Z'))).rejects.toMatchObject({ code: 'RULE_VERSION_STARTED' });
    await expect(withdrawVersion(as('dir'), 'v1', { reason: 'x', pin: '1234' }, new Date('2026-10-06T20:30:00Z'))).resolves.toBeTruthy();
  });
});
