import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RULE_DEFAULTS } from '../rules-defaults';
import type { LockedRuleGroup } from '../rules.types';
import { as, day, reset, seed } from '../testing/rules-fake';

vi.mock('../resolve/rules-repository', async (importOriginal) => ({ ...(await importOriginal<typeof import('../resolve/rules-repository')>()), rulesRepository: (await import('../testing/rules-fake')).fakeRulesRepository }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));

import { getRulesPage, type RulesPage } from './page-service';

const NOW = new Date('2026-10-06T08:00:00Z');
const page = async (actor: string, group: string, siteId: string | null = null): Promise<RulesPage> => (await getRulesPage(as(actor), group, siteId, NOW)) as RulesPage;
const lateness = (over: Record<string, unknown> = {}) => ({ ...RULE_DEFAULTS.LATENESS, ...over });
const overtime = (ordinaryDay: string | null) => ({ ...RULE_DEFAULTS.OVERTIME, multipliers: { ordinaryDay, restDay: null } });
const confirmed = (rowId: string, scope: string) => ({ id: `c-${rowId}`, ruleVersionId: rowId, scope, confirmedById: 'acc', confirmerRole: 'ACCOUNTANT', confirmedAt: new Date('2026-09-02T09:00:00Z'), note: null });

beforeEach(() => reset());

describe('a tab with nothing set', () => {
  it('shows the starting values as version 0 and every row for the Director', async () => {
    const lateness = await page('dir', 'LATENESS');
    expect(lateness).toMatchObject({ group: 'LATENESS', siteId: null, version: 0, isDefault: true, effectiveFrom: null, scheduled: null, expectedVersion: 0, pendingConfirmations: [] });
    expect(lateness.values).toEqual(RULE_DEFAULTS.LATENESS);
    expect(Object.keys(lateness.rows)).toEqual(['graceMinutes', 'afterGrace', 'deductionCap', 'excuseWindow', 'makeUpSameDay']);
    for (const row of Object.values(lateness.rows)) expect(row).toMatchObject({ kind: 'EDITABLE', canChange: true, lockedReason: null, ownRule: false });
  });

  it('system-set rows say Fixed and have no padlock', async () => {
    const attendance = await page('dir', 'ATTENDANCE');
    expect(attendance.rows['rounding']).toMatchObject({ kind: 'FIXED', canChange: false, lockedReason: null });
    const casual = await page('dir', 'CASUAL_WORK');
    for (const id of ['whoRecords', 'whoApproves', 'latenessReducesPayout']) expect(casual.rows[id]).toMatchObject({ kind: 'FIXED', canChange: false });
    expect((await page('dir', 'WEEK_AND_BREAKS')).rows['unpaidBreak']).toMatchObject({ kind: 'FIXED' });
    expect((await page('dir', 'PROBATION')).rows['signedContract']).toMatchObject({ kind: 'FIXED' });
  });
});

describe('the padlock answers who can change a row', () => {
  it('a Branch Manager: their own site’s rows are active, the company rows are locked and name the Director', async () => {
    const bm = await page('bm1', 'LATENESS');
    expect(bm).toMatchObject({ siteId: 's1', siteName: 'Nyeri Town' });
    expect(bm.rows['graceMinutes']).toMatchObject({ canChange: true });
    expect(bm.rows['deductionCap']).toMatchObject({ canChange: false, kind: 'EDITABLE', lockedReason: { whoCan: [{ role: 'DIRECTOR' }] } });
    const overtime = await page('bm1', 'OVERTIME');
    expect(overtime.rows['serviceTail']).toMatchObject({ canChange: true });
    expect(overtime.rows['multiplier']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'DIRECTOR' }] } });
    expect((await page('bm1', 'ATTENDANCE')).rows['clockInOpens']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'DIRECTOR' }] } });
  });

  it('HR, looking at a site: lateness is locked and names the Director and that site’s manager', async () => {
    const hr = await page('hr', 'LATENESS', 's1');
    expect(hr.rows['graceMinutes']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'DIRECTOR' }, { role: 'MANAGER', siteName: 'Nyeri Town' }] } });
    const company = await page('hr', 'LATENESS');
    expect(company.rows['graceMinutes']).toMatchObject({ lockedReason: { whoCan: [{ role: 'DIRECTOR' }] } });
  });

  it('for the Central Store the manager named is the Store Manager', async () => {
    const hr = await page('hr', 'OVERTIME', 'sc');
    expect(hr.rows['serviceTail']?.lockedReason?.whoCan).toEqual([{ role: 'DIRECTOR' }, { role: 'STORE_MANAGER', siteName: 'Central Store' }]);
  });

  it('leave: HR changes the types and not the minimum cover (which names the branch manager, the Director and the System Admin)', async () => {
    const hr = await page('hr', 'LEAVE', 's1');
    expect(hr.rows['leaveTypes']).toMatchObject({ canChange: true });
    expect(hr.rows['minimumCover']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'DIRECTOR' }, { role: 'MANAGER', siteName: 'Nyeri Town' }, { role: 'SYSTEM_ADMIN' }] } });
    const bm = await page('bm1', 'LEAVE');
    expect(bm.rows['minimumCover']).toMatchObject({ canChange: true });
    expect(bm.rows['leaveTypes']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'HR_MANAGER' }] } });
    expect((await page('adm', 'LEAVE', 's2')).rows['minimumCover']).toMatchObject({ canChange: true });
  });

  it('holidays: the Director has the list, the Accountant the rate, each is locked for the other', async () => {
    const dir = await page('dir', 'HOLIDAYS');
    expect(dir.rows['holidays']).toMatchObject({ canChange: true });
    expect(dir.rows['payRate']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'ACCOUNTANT' }] } });
    const acc = await page('acc', 'HOLIDAYS');
    expect(acc.rows['payRate']).toMatchObject({ canChange: true });
    expect(acc.rows['holidays']).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'DIRECTOR' }] } });
  });

  it('nobody but the Director changes casual rates, probation, conduct, attendance or the week', async () => {
    for (const [group, row] of [['CASUAL_WORK', 'rates'], ['PROBATION', 'defaultMonths'], ['CONDUCT', 'levels'], ['ATTENDANCE', 'undoWindow'], ['WEEK_AND_BREAKS', 'weekStartsOn']] as const) {
      expect((await page('dir', group)).rows[row]?.canChange, `dir ${group}`).toBe(true);
      for (const actor of ['hr', 'acc', 'bm1', 'adm']) expect((await page(actor, group)).rows[row]?.canChange, `${actor} ${group}`).toBe(false);
    }
  });
});

describe('who may open the tab, and which site', () => {
  it('a waiter is refused; an unknown tab is a 404; another company’s site is a 404', async () => {
    await expect(page('w1', 'LATENESS')).rejects.toMatchObject({ statusCode: 403 });
    await expect(page('dir', 'NOPE')).rejects.toMatchObject({ statusCode: 404 });
    await expect(page('dir', 'LATENESS', 'sx')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a Branch Manager naming another site gets a 404; naming their own is fine', async () => {
    await expect(page('bm1', 'LATENESS', 's2')).rejects.toMatchObject({ statusCode: 404 });
    await expect(page('bm1', 'LATENESS', 's1')).resolves.toMatchObject({ siteId: 's1' });
  });

  it('Statutory: a card with nothing in it for a Branch Manager, the tab for the Accountant, Director, HR and System Admin', async () => {
    expect(await getRulesPage(as('bm1'), 'STATUTORY', null, NOW)).toEqual({ group: 'STATUTORY', locked: true } satisfies LockedRuleGroup);
    expect((await page('acc', 'STATUTORY')).rows['tables']).toMatchObject({ canChange: true });
    for (const actor of ['dir', 'hr', 'adm']) expect((await page(actor, 'STATUTORY')).rows['tables'], actor).toMatchObject({ canChange: false, lockedReason: { whoCan: [{ role: 'ACCOUNTANT' }] } });
  });
});

describe('own rules of a site', () => {
  beforeEach(() => {
    seed({ group: 'LATENESS', version: 1, values: lateness({ graceMinutes: 5 }) });
    seed({ group: 'LATENESS', siteId: 's2', version: 1, effectiveFrom: day('2026-09-10'), values: { graceMinutes: 10 } });
  });

  it('a site that follows the company rule has no own rows; a site with one shows Own rule on that row only', async () => {
    const town = await page('dir', 'LATENESS', 's1');
    expect(town).toMatchObject({ ownFields: [], siteVersion: null, expectedSiteVersion: 0 });
    const highway = await page('dir', 'LATENESS', 's2');
    expect(highway).toMatchObject({ ownFields: ['graceMinutes'], siteVersion: 1, expectedSiteVersion: 1, values: { graceMinutes: 10 }, companyValues: { graceMinutes: 5 } });
    expect(highway.rows['graceMinutes']?.ownRule).toBe(true);
    expect(highway.rows['excuseWindow']?.ownRule).toBe(false);
  });

  it('lists the sites that do their own, with a summary; a Branch Manager sees only their own', async () => {
    expect((await page('dir', 'LATENESS')).sitesWithOwnRule).toEqual([{ siteId: 's2', siteName: 'Nyeri Highway', summary: 'Grace period 5 min → 10 min' }]);
    expect((await page('bm1', 'LATENESS')).sitesWithOwnRule).toEqual([]);
    expect((await page('bm2', 'LATENESS')).sitesWithOwnRule).toHaveLength(1);
  });

  it('the site select shows every site to a company holder and only their own to a branch manager', async () => {
    expect((await page('dir', 'LATENESS')).sites.map((s) => s.siteId)).toEqual(['s0', 's1', 's2', 'sc']);
    expect((await page('bm1', 'LATENESS')).sites.map((s) => s.siteId)).toEqual(['s1']);
  });
});

describe('versions coming and confirmations waiting', () => {
  it('a scheduled version is shown once, in words, and the page says which number to send back', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-09-01'), values: lateness({ graceMinutes: 5 }) });
    seed({ id: 'next', group: 'LATENESS', version: 2, effectiveFrom: day('2026-11-02'), values: lateness({ graceMinutes: 10 }) });
    const lateness2 = await page('dir', 'LATENESS');
    expect(lateness2).toMatchObject({ version: 1, expectedVersion: 2, scheduled: { id: 'next', version: 2, effectiveFrom: '2026-11-02', changedSummary: 'Grace period 5 min → 10 min' } });
  });

  it('a first scheduled version is compared with the starting values, so its summary names only what changed', async () => {
    seed({ id: 'first', group: 'LATENESS', version: 1, effectiveFrom: day('2026-11-02'), values: lateness({ graceMinutes: 10 }) });
    const first = await page('dir', 'LATENESS');
    expect(first).toMatchObject({ version: 0, isDefault: true, scheduled: { id: 'first', changedSummary: 'Grace period 5 min → 10 min' } });
  });

  it('a withdrawn scheduled version is not shown, but its number is still counted', async () => {
    seed({ group: 'LATENESS', version: 1, effectiveFrom: day('2026-09-01'), values: lateness() });
    seed({ id: 'gone', group: 'LATENESS', version: 2, effectiveFrom: day('2026-11-02'), values: lateness({ graceMinutes: 10 }), withdrawal: { id: 'w', ruleVersionId: 'gone', withdrawnById: 'dir', withdrawnByRole: 'DIRECTOR', withdrawnAt: new Date(), reason: 'x' } });
    expect(await page('dir', 'LATENESS')).toMatchObject({ scheduled: null, expectedVersion: 2 });
  });

  it('a new multiplier waits for the Accountant; the old confirmed one is shown with who confirmed it', async () => {
    const first = seed({ id: 'ot1', group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: overtime('1.5') });
    first.confirmations.push(confirmed('ot1', 'overtime.multipliers'));
    seed({ id: 'ot2', group: 'OVERTIME', version: 2, effectiveFrom: day('2026-10-01'), values: overtime('1.75') });
    const ot = await page('dir', 'OVERTIME');
    expect((ot.values as unknown as { multipliers: unknown }).multipliers).toEqual({ ordinaryDay: '1.5', restDay: null }); // the old one stays in use
    expect(ot.rows['multiplier']).toMatchObject({ waitingForConfirmation: true, confirmedBy: { name: 'Ann Accountant', role: 'ACCOUNTANT' } });
    expect(ot.pendingConfirmations).toEqual([{ scope: 'overtime.multipliers', versionId: 'ot2', version: 2, effectiveFrom: '2026-10-01', inForce: true, whoCan: [{ role: 'ACCOUNTANT' }] }]);
  });

  it('a scheduled version that needs a confirmation is listed too, not yet in force', async () => {
    seed({ id: 'ot3', group: 'OVERTIME', version: 1, effectiveFrom: day('2026-11-02'), values: overtime('1.75') });
    const ot = await page('acc', 'OVERTIME');
    expect(ot.pendingConfirmations).toMatchObject([{ versionId: 'ot3', inForce: false, effectiveFrom: '2026-11-02' }]);
  });

  it('once confirmed nothing waits', async () => {
    const row = seed({ id: 'ot1', group: 'OVERTIME', version: 1, effectiveFrom: day('2026-09-01'), values: overtime('1.5') });
    row.confirmations.push(confirmed('ot1', 'overtime.multipliers'));
    const ot = await page('dir', 'OVERTIME');
    expect(ot.pendingConfirmations).toEqual([]);
    expect(ot.rows['multiplier']).toMatchObject({ waitingForConfirmation: false });
  });
});
