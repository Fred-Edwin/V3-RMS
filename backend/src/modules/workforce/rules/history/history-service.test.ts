import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RULE_DEFAULTS } from '../rules-defaults';
import { as, day, reset, seed } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { listHistory, type HistoryPage } from './history-service';
import { summariseChange } from './history-summary';

const NOW = new Date('2026-10-06T08:00:00Z');
const lateness = (over: Record<string, unknown>) => ({ ...RULE_DEFAULTS.LATENESS, ...over });
const history = async (actor: string, group: string, query: { siteId?: string | null; page?: number; pageSize?: number } = {}): Promise<HistoryPage> =>
  (await listHistory(as(actor), group, { siteId: query.siteId ?? null, page: query.page ?? 1, pageSize: query.pageSize ?? 25 }, NOW)) as HistoryPage;

beforeEach(() => {
  reset();
  seed({ id: 'v1', group: 'LATENESS', version: 1, effectiveFrom: day('2026-06-01'), values: lateness({}) });
  seed({ id: 'v2', group: 'LATENESS', version: 2, effectiveFrom: day('2026-09-01'), values: lateness({ graceMinutes: 5, policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 }) });
  seed({ id: 'v3', group: 'LATENESS', version: 3, effectiveFrom: day('2026-11-02'), values: lateness({ graceMinutes: 10, policy: 'AFTER_N_LATES', afterLatesPerMonth: 3 }) });
});

describe('the history of a tab', () => {
  it('lists newest first with status, who changed what in words, and who is told', async () => {
    const page = await history('dir', 'LATENESS');
    expect(page.items.map((i) => [i.version, i.status])).toEqual([[3, 'SCHEDULED'], [2, 'IN_FORCE'], [1, 'REPLACED']]);
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 25 });
    expect(page.items[0]).toMatchObject({ changedFields: ['graceMinutes'], changedSummary: 'Grace period 5 min → 10 min', createdBy: { name: 'Dina Director', role: 'DIRECTOR' } });
    expect(page.items[1]?.changedSummary).toBe('What happens after the grace period record only → deduct after a number of late days; Late days before a deduction none → 3 late days');
    expect(page.items[0]?.told).toEqual([{ role: 'BRANCH_MANAGER' }, { role: 'HR_MANAGER' }, { role: 'ACCOUNTANT' }]);
  });

  it('pages: the second page of two, with the earlier row still compared with its predecessor', async () => {
    const second = await history('dir', 'LATENESS', { page: 2, pageSize: 2 });
    expect(second.items.map((i) => i.version)).toEqual([1]);
    expect(second.total).toBe(3);
    const first = await history('dir', 'LATENESS', { page: 1, pageSize: 2 });
    expect(first.items.map((i) => i.version)).toEqual([3, 2]);
    expect(first.items[1]?.changedFields).toEqual(['policy', 'afterLatesPerMonth']); // version 1 is on the next page but is still the one it is compared with
  });

  it('a withdrawn version stays listed as Withdrawn with who and why; the one before it is in force', async () => {
    seed({ id: 'v4', group: 'LATENESS', version: 4, effectiveFrom: day('2026-12-01'), values: lateness({ graceMinutes: 20 }), withdrawal: { id: 'w', ruleVersionId: 'v4', withdrawnById: 'dir', withdrawnByRole: 'DIRECTOR', withdrawnAt: new Date('2026-10-05T00:00:00Z'), reason: 'Wrong day' } });
    const page = await history('dir', 'LATENESS');
    expect(page.items[0]).toMatchObject({ version: 4, status: 'WITHDRAWN', withdrawn: { reason: 'Wrong day', by: { name: 'Dina Director', role: 'DIRECTOR' } } });
    expect(page.items.find((i) => i.version === 2)?.status).toBe('IN_FORCE');
  });

  it('offers the withdrawal of the scheduled version to someone who may change the tab, and to nobody else', async () => {
    expect((await history('dir', 'LATENESS')).canWithdraw).toEqual({ versionId: 'v3', version: 3 });
    expect((await history('hr', 'LATENESS')).canWithdraw).toBeNull();
    expect((await history('bm1', 'LATENESS')).canWithdraw).toBeNull(); // the scheduled version is the company's
  });

  it('with several scheduled versions, the withdrawal offered is the newest one', async () => {
    seed({ id: 'v4', group: 'LATENESS', version: 4, effectiveFrom: day('2026-12-01'), values: lateness({ graceMinutes: 20 }) });
    expect((await history('dir', 'LATENESS')).canWithdraw).toEqual({ versionId: 'v4', version: 4 });
  });

  it('an empty tab has no versions: only the starting values', async () => {
    const page = await history('dir', 'ATTENDANCE');
    expect(page).toMatchObject({ items: [], total: 0, canWithdraw: null });
  });
});

describe('a site’s own history and the Site select', () => {
  beforeEach(() => {
    seed({ id: 's1a', group: 'LATENESS', siteId: 's1', version: 1, effectiveFrom: day('2026-09-15'), values: { graceMinutes: 3 } });
    seed({ id: 's2a', group: 'LATENESS', siteId: 's2', version: 1, effectiveFrom: day('2026-09-15'), values: { graceMinutes: 8 } });
  });

  it('a Director sees the company rule and every site with an own rule', async () => {
    const page = await history('dir', 'LATENESS');
    expect(page.sites).toEqual([{ siteId: null, siteName: 'Company rule' }, { siteId: 's1', siteName: 'Nyeri Town' }, { siteId: 's2', siteName: 'Nyeri Highway' }]);
    const site = await history('dir', 'LATENESS', { siteId: 's1' });
    expect(site.items).toMatchObject([{ version: 1, siteId: 's1', changedFields: ['graceMinutes'], changedSummary: 'Grace period none → 3 min' }]);
  });

  it('a Branch Manager sees the company rule and their own site, never another’s (404)', async () => {
    const page = await history('bm1', 'LATENESS');
    expect(page.sites).toEqual([{ siteId: null, siteName: 'Company rule' }, { siteId: 's1', siteName: 'Nyeri Town' }]);
    await expect(history('bm1', 'LATENESS', { siteId: 's2' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(history('bm1', 'LATENESS', { siteId: 'sx' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a tab with no site rules has no site history', async () => {
    await expect(history('dir', 'ATTENDANCE', { siteId: 's1' })).rejects.toMatchObject({ statusCode: 404 });
    expect((await history('dir', 'ATTENDANCE')).sites).toEqual([{ siteId: null, siteName: 'Company rule' }]);
  });
});

describe('who may read history', () => {
  it('a waiter is refused, an unknown tab is a 404', async () => {
    await expect(history('w1', 'LATENESS')).rejects.toMatchObject({ statusCode: 403 });
    await expect(history('dir', 'NOPE')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('Statutory is locked for a Branch Manager and open for the Accountant, Director and HR', async () => {
    expect(await listHistory(as('bm1'), 'STATUTORY', { siteId: null, page: 1, pageSize: 25 }, NOW)).toEqual({ group: 'STATUTORY', locked: true });
    expect(await listHistory(as('adm'), 'STATUTORY', { siteId: null, page: 1, pageSize: 25 }, NOW)).toMatchObject({ items: [] });
    for (const actor of ['acc', 'dir', 'hr']) expect(await listHistory(as(actor), 'STATUTORY', { siteId: null, page: 1, pageSize: 25 }, NOW)).toMatchObject({ total: 0 });
  });
});

describe('the "what changed" words', () => {
  const caps = (value: number | null) => ({ deductionCapPercentOfPay: value });

  it('pay figures are shown only to roles that read pay', () => {
    expect(summariseChange('LATENESS', ['deductionCapPercentOfPay'], caps(null), caps(2), true)).toBe('Deduction cap no cap → 2 %');
    expect(summariseChange('LATENESS', ['deductionCapPercentOfPay'], caps(null), caps(2), false)).toBe('Deduction cap changed');
    expect(summariseChange('OVERTIME', ['multipliers'], { multipliers: { ordinaryDay: '1.5', restDay: null } }, { multipliers: { ordinaryDay: '1.75', restDay: null } }, false)).toBe('Pay multiplier changed');
  });

  it('days, hours, weekdays and switches read as people say them', () => {
    expect(summariseChange('LATENESS', ['excuseWindowHours', 'makeUpSameDay'], { excuseWindowHours: 48, makeUpSameDay: false }, { excuseWindowHours: 72, makeUpSameDay: true }, true)).toBe(
      'Time to excuse a late arrival 2 days → 3 days; Make up the time the same day off → on',
    );
    expect(summariseChange('OVERTIME', ['weeklyCapMinutes'], { weeklyCapMinutes: null }, { weeklyCapMinutes: 720 }, true)).toBe('Weekly cap for one person no cap → 12 h');
    expect(summariseChange('WEEK_AND_BREAKS', ['weekStartsOn'], { weekStartsOn: 1 }, { weekStartsOn: 7 }, true)).toBe('The week starts on Monday → Sunday');
  });

  it('statutory: a table’s rate with the old one; holidays: how many added', () => {
    const nssf = (rate: string) => [{ code: 'NSSF', name: 'NSSF', bands: [{ ratePercent: rate, flatAmount: null }] }];
    expect(summariseChange('STATUTORY', ['tables'], { tables: nssf('5') }, { tables: nssf('6') }, true)).toBe('NSSF 6% (was 5%)');
    expect(summariseChange('STATUTORY', ['tables'], { tables: nssf('5') }, { tables: nssf('6') }, false)).toBe('NSSF changed');
    expect(summariseChange('HOLIDAYS', ['holidays'], { holidays: [] }, { holidays: [{ date: '2026-12-25', name: 'Christmas Day' }] }, true)).toBe('Public holidays: 1 added');
  });
});
