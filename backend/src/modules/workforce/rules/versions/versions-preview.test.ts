import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed, state } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('./versions-repository', async () => ({ versionsRepository: (await import('../testing/rules-fake')).fakeVersionsRepository }));
vi.mock('../../_shared/audit/audit-writer', async () => ({ runAudited: (await import('../testing/rules-fake')).fakeRunAudited }));
vi.mock('../../_shared/pin/signer-pin-repository', async () => ({ signerPinRepository: { hashOf: (await import('../testing/rules-fake')).fakePinHash } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { previewVersion } from './versions-preview';
import type { ChangeBody } from './versions-validators';

const NOW = new Date('2026-10-06T08:00:00Z');
const body = (over: Partial<ChangeBody> = {}): ChangeBody => ({ siteId: null, effectiveFrom: '2026-11-01', values: { graceMinutes: 10 }, ...over });
const preview = (actor: string, group = 'LATENESS', over: Partial<ChangeBody> = {}) => previewVersion(as(actor), group, body(over), NOW);

beforeEach(() => reset());

describe('a change that can be saved', () => {
  it('says what it would change, who is told, what number it becomes and the suggested day, and writes nothing', async () => {
    const result = await preview('dir');
    expect(result).toMatchObject({
      canSave: true,
      errors: [],
      changedFields: ['graceMinutes'],
      becomes: { version: 1, from: '2026-11-01' },
      toldWithoutFigures: false,
      approvedMonthsAffected: false,
      earliestEffectiveFrom: '2026-10-06',
      defaultEffectiveFrom: '2026-11-01',
      expectedVersion: 0,
      needsConfirmation: [],
      confirmsWithYourPin: [],
    });
    expect(result.impact.at(-1)).toEqual({ label: 'Months already approved', value: 'Not changed' });
    expect(result.told).toEqual(expect.arrayContaining([{ role: 'BRANCH_MANAGER', count: 3 }, { role: 'HR_MANAGER', count: 1 }, { role: 'ACCOUNTANT', count: 1 }]));
    expect(state.rows).toHaveLength(0);
    expect(state.entries).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });

  it('suggests today for an operating rule and the first of next month for pay', async () => {
    expect((await preview('dir', 'ATTENDANCE', { values: { undoWindowSeconds: 60 } })).defaultEffectiveFrom).toBe('2026-10-06');
    expect((await preview('dir', 'LATENESS', { values: { deductionCapPercentOfPay: 2 } })).defaultEffectiveFrom).toBe('2026-11-01');
  });

  it('a pay row is told without figures, and its multiplier waits for the Accountant, named by role', async () => {
    const result = await preview('dir', 'OVERTIME', { values: { multipliers: { ordinaryDay: '1.5', restDay: '2.0' } } });
    expect(result.toldWithoutFigures).toBe(true);
    expect(result.needsConfirmation).toEqual([{ scope: 'overtime.multipliers', whoCan: [{ role: 'ACCOUNTANT' }] }]);
  });

  it('says when this very save confirms because the signer holds the right', async () => {
    const statutory = { tables: [{ code: 'NSSF', name: 'NSSF', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null }] };
    const result = await preview('acc', 'STATUTORY', { effectiveFrom: '2026-10-01', values: statutory });
    expect(result).toMatchObject({ canSave: true, confirmsWithYourPin: ['statutory'], needsConfirmation: [], earliestEffectiveFrom: '2026-10-01' });
  });

  it('a version already scheduled moves the earliest day forward and the expected version up', async () => {
    seed({ group: 'LATENESS', version: 4, effectiveFrom: day('2026-12-01'), values: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 9 } });
    const result = await preview('dir', 'LATENESS', { effectiveFrom: '2026-12-01', values: { graceMinutes: 12 } });
    expect(result).toMatchObject({ canSave: true, earliestEffectiveFrom: '2026-12-01', expectedVersion: 4, becomes: { version: 5, from: '2026-12-01' } });
  });

  it('a branch manager’s own-site preview tells the site and the Director', async () => {
    const result = await preview('bm1', 'LATENESS', { siteId: 's1', values: { graceMinutes: 3 } });
    expect(result.canSave).toBe(true);
    expect(result.told.map((t) => t.role).sort()).toEqual(['ACCOUNTANT', 'DIRECTOR', 'HR_MANAGER']);
  });
});

describe('a change that cannot be saved yet', () => {
  it('lists the reason in plain words, on the field or the date, and still gives the day window', async () => {
    const backdated = await preview('dir', 'LATENESS', { effectiveFrom: '2026-10-01' });
    expect(backdated).toMatchObject({ canSave: false, becomes: null, earliestEffectiveFrom: '2026-10-06', defaultEffectiveFrom: '2026-11-01' });
    expect(backdated.errors).toEqual([{ code: 'RULE_BACKDATED', message: 'A rule cannot start in the past', field: 'effectiveFrom', details: undefined }]);
  });

  it('an out-of-range value is an error on its field', async () => {
    const result = await preview('dir', 'LATENESS', { values: { graceMinutes: 99 } });
    expect(result.canSave).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: 'RULE_INVALID_VALUE', field: expect.any(String) });
  });

  it('"nothing to change yet" is RULE_NO_CHANGE', async () => {
    const result = await preview('dir', 'LATENESS', { values: { graceMinutes: 5 } });
    expect(result.errors[0]).toMatchObject({ code: 'RULE_NO_CHANGE', message: 'Nothing differs from the rule already in force' });
  });

  it('a clash names the version and whether it can be withdrawn; a stale view says which is newest', async () => {
    seed({ group: 'LATENESS', version: 3, effectiveFrom: day('2026-11-02'), values: { ...RULE_DEFAULTS.LATENESS, graceMinutes: 9 } });
    const clash = await preview('dir', 'LATENESS', { effectiveFrom: '2026-11-01' });
    expect(clash.errors[0]).toMatchObject({ code: 'RULE_FUTURE_VERSION_EXISTS', field: 'effectiveFrom', details: { version: 3, withdrawable: true } });
    const stale = await preview('dir', 'LATENESS', { effectiveFrom: '2026-11-02', expectedVersion: 2 });
    expect(stale.errors[0]).toMatchObject({ code: 'RULE_STALE', details: { latestVersion: 3 } });
    expect(stale.expectedVersion).toBe(3);
  });
});

describe('who may ask', () => {
  it('a person who may not change the tab gets 403, not an error list; another company’s site is a 404', async () => {
    await expect(preview('hr', 'LATENESS')).rejects.toMatchObject({ statusCode: 403 });
    await expect(preview('w1', 'LATENESS')).rejects.toMatchObject({ statusCode: 403 });
    await expect(preview('dir', 'LATENESS', { siteId: 'sx' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
