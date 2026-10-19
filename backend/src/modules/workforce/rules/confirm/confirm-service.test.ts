import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPinTries } from '../../_shared/pin/signer-pin';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed, state } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('../versions/versions-repository', async () => ({ versionsRepository: (await import('../testing/rules-fake')).fakeVersionsRepository }));
vi.mock('../../_shared/audit/audit-writer', async () => ({ runAudited: (await import('../testing/rules-fake')).fakeRunAudited }));
vi.mock('../../_shared/pin/signer-pin-repository', async () => ({ signerPinRepository: { hashOf: (await import('../testing/rules-fake')).fakePinHash } }));
vi.mock('../../../../utils/password', () => ({ comparePin: async (pin: string, hash: string) => pin === hash }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { confirmVersion } from './confirm-service';

const NOW = new Date('2026-10-06T08:00:00Z');
const overtime = { ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay: '1.5', restDay: '2.0' } };
const confirm = (actor: string, id: string, over: { scope?: string; pin?: string; note?: string } = {}) => confirmVersion(as(actor), id, { scope: 'overtime.multipliers', pin: '1234', ...over }, NOW);

beforeEach(() => {
  reset();
  resetPinTries();
  seed({ id: 'ot1', group: 'OVERTIME', version: 1, effectiveFrom: day('2026-11-01'), values: overtime });
});

describe('confirming a pay rate', () => {
  it('the Accountant confirms: one confirmation row, one audit entry under RULES_PAY with the signature, one event', async () => {
    const done = await confirm('acc', 'ot1', { note: 'Checked with the lawyer' });
    expect(done).toMatchObject({ replay: false, version: { confirmations: [{ scope: 'overtime.multipliers', by: { id: 'acc', name: 'Ann Accountant' }, note: 'Checked with the lawyer' }] } });
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ action: 'rules.version_confirmed', category: 'RULES_PAY', reason: 'Checked with the lawyer', after: { group: 'OVERTIME', scope: 'overtime.multipliers', signature: { method: 'PIN' } } });
    expect(JSON.stringify(state.entries[0])).not.toContain('1234');
    expect(state.events).toMatchObject([{ name: 'rules.version_confirmed', payload: { versionId: 'ot1', scope: 'overtime.multipliers', confirmedById: 'acc' } }]);
  });

  it('twice is the same: the second answers with the first and writes nothing', async () => {
    await confirm('acc', 'ot1');
    const again = await confirm('acc', 'ot1');
    expect(again.replay).toBe(true);
    expect(state.rows[0]?.confirmations).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
  });

  it('only the holder of the scope’s capability: the Director cannot confirm pay rates, the Accountant cannot confirm the holiday list', async () => {
    await expect(confirm('dir', 'ot1')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_CONFIRM_NOT_ALLOWED' });
    await expect(confirm('hr', 'ot1')).rejects.toMatchObject({ statusCode: 403, code: 'RULE_CONFIRM_NOT_ALLOWED' });
    await expect(confirm('bm1', 'ot1')).rejects.toMatchObject({ statusCode: 403 });
    await expect(confirm('w1', 'ot1')).rejects.toMatchObject({ statusCode: 403 });
    seed({ id: 'h1', group: 'HOLIDAYS', version: 1, values: { enabled: false, payMultiplier: null, holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] } });
    await expect(confirm('acc', 'h1', { scope: 'holidays.dates' })).rejects.toMatchObject({ code: 'RULE_CONFIRM_NOT_ALLOWED' });
    await expect(confirm('dir', 'h1', { scope: 'holidays.dates' })).resolves.toMatchObject({ replay: false });
    expect(state.rows.find((r) => r.id === 'ot1')?.confirmations).toHaveLength(0);
  });

  it('a scope the version does not need, or one that does not exist, is refused', async () => {
    seed({ id: 'unset', group: 'OVERTIME', version: 2, effectiveFrom: day('2026-12-01'), values: RULE_DEFAULTS.OVERTIME }); // multipliers back to unset: nothing to confirm
    await expect(confirm('acc', 'unset')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_CONFIRM_NOT_REQUIRED' });
    await expect(confirm('acc', 'ot1', { scope: 'statutory' })).rejects.toMatchObject({ code: 'RULE_CONFIRM_NOT_ALLOWED' }); // a scope of another tab
    await expect(confirm('acc', 'ot1', { scope: 'made.up' })).rejects.toMatchObject({ code: 'RULE_CONFIRM_NOT_ALLOWED' });
    seed({ id: 'plain', group: 'OVERTIME', version: 1, siteId: 's1', values: { serviceTailMinutes: 30 } }); // a site's own rule never needs one
    await expect(confirm('acc', 'plain')).rejects.toMatchObject({ code: 'RULE_CONFIRM_NOT_REQUIRED' });
  });

  it('a withdrawn version cannot be confirmed', async () => {
    state.rows[0]!.withdrawal = { id: 'w', ruleVersionId: 'ot1', withdrawnById: 'dir', withdrawnByRole: 'DIRECTOR', withdrawnAt: new Date(), reason: 'x' };
    await expect(confirm('acc', 'ot1')).rejects.toMatchObject({ statusCode: 409, code: 'RULE_VERSION_WITHDRAWN' });
  });

  it('an unknown version, or one of another company, is a 404', async () => {
    await expect(confirm('acc', 'nope')).rejects.toMatchObject({ statusCode: 404 });
    seed({ id: 'foreign', companyId: 'c2', group: 'OVERTIME', version: 1, values: overtime });
    await expect(confirm('acc', 'foreign')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the PIN is checked: wrong, and nothing is confirmed', async () => {
    await expect(confirm('acc', 'ot1', { pin: '0000' })).rejects.toMatchObject({ statusCode: 403, code: 'PIN_INVALID' });
    expect(state.rows[0]?.confirmations).toHaveLength(0);
    expect(state.entries).toHaveLength(0);
  });
});
