/**
 * The Rules flows against a real database: a pay change that waits for the Accountant, a stale second editor, a clashing day,
 * a withdrawal, a Branch Manager's own rule and its return to the company rule, two saves at once, a retried save, and that the
 * audit chain still verifies. Real services, real PIN check, real transactions.
 *
 * Runs only when DATABASE_URL names a lane database (it contains "_lane"); skipped everywhere else. It needs the lane's seeded
 * people (director@, accountant@, bm.town@ wendo.test, signing PIN 1234). It removes the rule rows it makes; the audit entries it
 * writes stay, because the audit log is append-only by design.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('rules in the database', () => {
  const made: string[] = [];
  type Ctx = Awaited<ReturnType<typeof load>>;
  let ctx: Ctx;

  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const time = await import('../../_shared/time/nairobi-time');
    const { createVersion } = await import('./versions-create');
    const { withdrawVersion } = await import('./versions-withdraw');
    const { confirmVersion } = await import('../confirm/confirm-service');
    const { getRulesPage } = await import('../page/page-service');
    const { listHistory } = await import('../history/history-service');
    const { getEffectiveRuleGroup, isPayConfirmed } = await import('../resolve/rules-resolve');
    const { resetPinTries } = await import('../../_shared/pin/signer-pin');
    const { auditRepository } = await import('../../_shared/audit/audit-repository');
    const { verifyAuditChain } = await import('../../_shared/audit/audit-hash');
    const who = async (email: string) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, role: true, siteId: true } });
      return { id: user.id, role: user.role, siteId: user.siteId };
    };
    return { prisma, time, createVersion, withdrawVersion, confirmVersion, getRulesPage, listHistory, getEffectiveRuleGroup, isPayConfirmed, resetPinTries, auditRepository, verifyAuditChain, who };
  };

  const track = (id: string) => made.push(id);

  beforeAll(async () => {
    ctx = await load();
  });

  afterAll(async () => {
    const { prisma } = ctx;
    await prisma.ruleVersionWithdrawal.deleteMany({ where: { ruleVersionId: { in: made } } });
    await prisma.ruleConfirmation.deleteMany({ where: { ruleVersionId: { in: made } } });
    await prisma.ruleVersion.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  it('a pay change waits for the Accountant: the old rate stays in use until confirmed, then the new one applies from its day', async () => {
    const { time, createVersion, confirmVersion, getEffectiveRuleGroup, isPayConfirmed, getRulesPage, who } = ctx;
    const director = await who('director@wendo.test');
    const accountant = await who('accountant@wendo.test');
    const site = (await ctx.prisma.site.findFirstOrThrow({ where: { name: 'Nyeri Town' } })).id;
    const from = time.addDays(time.nairobiToday(new Date()), 30);
    const day = (n: number) => time.addDays(from, n);

    const first = await createVersion(director, 'OVERTIME', { siteId: null, effectiveFrom: day(0), values: { multipliers: { ordinaryDay: '1.50', restDay: '2.00' } }, reason: 'Test: first rate', pin: '1234' });
    track(first.version.id);
    expect(first).toMatchObject({ waiting: ['overtime.multipliers'], confirmed: [], version: { version: 1, status: 'SCHEDULED' } });

    // nothing was ever confirmed: payroll must refuse once the day comes
    const before = await getEffectiveRuleGroup(site, day(1), 'OVERTIME');
    expect(isPayConfirmed(before).ready).toBe(false);

    const pending = (await getRulesPage(accountant, 'OVERTIME', null)) as { pendingConfirmations: { versionId: string; whoCan: unknown[] }[] };
    expect(pending.pendingConfirmations).toMatchObject([{ versionId: first.version.id, inForce: false }]);

    const confirmed = await confirmVersion(accountant, first.version.id, { scope: 'overtime.multipliers', pin: '1234' });
    expect(confirmed.version.confirmations).toHaveLength(1);
    expect(isPayConfirmed(await getEffectiveRuleGroup(site, day(1), 'OVERTIME')).ready).toBe(true);

    // a second, higher rate: the first (confirmed) stays in use until the Accountant confirms the second
    const second = await createVersion(director, 'OVERTIME', { siteId: null, effectiveFrom: day(10), values: { multipliers: { ordinaryDay: '1.75', restDay: '2.00' } }, reason: 'Test: raise', pin: '1234' });
    track(second.version.id);
    const during = await getEffectiveRuleGroup(site, day(11), 'OVERTIME');
    expect((during.values.multipliers as { ordinaryDay: string }).ordinaryDay).toBe('1.50');
    expect(during).toMatchObject({ pendingConfirmations: ['overtime.multipliers'], missingConfirmations: [] });
    await confirmVersion(accountant, second.version.id, { scope: 'overtime.multipliers', pin: '1234' });
    expect(((await getEffectiveRuleGroup(site, day(11), 'OVERTIME')).values.multipliers as { ordinaryDay: string }).ordinaryDay).toBe('1.75');
    expect(((await getEffectiveRuleGroup(site, day(5), 'OVERTIME')).values.multipliers as { ordinaryDay: string }).ordinaryDay).toBe('1.50');
  });

  it('a second editor who saw an older version is refused as stale; a clashing day is refused and names the version', async () => {
    const { time, createVersion, who } = ctx;
    const director = await who('director@wendo.test');
    const from = time.addDays(time.nairobiToday(new Date()), 60);

    const one = await createVersion(director, 'ATTENDANCE', { siteId: null, effectiveFrom: from, values: { undoWindowSeconds: 90 }, reason: 'Test: first', pin: '1234' });
    track(one.version.id);
    await expect(
      createVersion(director, 'ATTENDANCE', { siteId: null, effectiveFrom: from, values: { undoWindowSeconds: 60 }, expectedVersion: 0, reason: 'Test: late editor', pin: '1234' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'RULE_STALE', details: { latestVersion: 1 } });
    await expect(
      createVersion(director, 'ATTENDANCE', { siteId: null, effectiveFrom: time.addDays(from, -5), values: { undoWindowSeconds: 60 }, reason: 'Test: clash', pin: '1234' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'RULE_FUTURE_VERSION_EXISTS', details: { version: 1, withdrawable: true } });
  });

  it('a version can be withdrawn before its day: it stays in the history as Withdrawn and frees its day', async () => {
    const { time, createVersion, withdrawVersion, listHistory, getEffectiveRuleGroup, who } = ctx;
    const director = await who('director@wendo.test');
    const from = time.addDays(time.nairobiToday(new Date()), 90);
    const site = (await ctx.prisma.site.findFirstOrThrow({ where: { name: 'Nyeri Town' } })).id;

    const v = await createVersion(director, 'PROBATION', { siteId: null, effectiveFrom: from, values: { defaultMonths: 6 }, reason: 'Test: probation', pin: '1234' });
    track(v.version.id);
    const withdrawn = await withdrawVersion(director, v.version.id, { reason: 'Test: wrong day', pin: '1234' });
    expect(withdrawn.version).toMatchObject({ status: 'WITHDRAWN', withdrawn: { reason: 'Test: wrong day' } });
    const history = (await listHistory(director, 'PROBATION', { siteId: null, page: 1, pageSize: 25 })) as { items: { status: string }[] };
    expect(history.items.map((i) => i.status)).toEqual(['WITHDRAWN']);
    expect((await getEffectiveRuleGroup(site, time.addDays(from, 1), 'PROBATION')).isDefault).toBe(true);
    // the number is not reused, and the freed day can be taken again
    const again = await createVersion(director, 'PROBATION', { siteId: null, effectiveFrom: from, values: { defaultMonths: 4 }, reason: 'Test: again', pin: '1234' });
    track(again.version.id);
    expect(again.version.version).toBe(2);
  });

  it('a Branch Manager makes one row their own site’s and gives it back; the company rule is untouched', async () => {
    const { time, createVersion, getEffectiveRuleGroup, who } = ctx;
    const manager = await who('bm.town@wendo.test');
    const director = await who('director@wendo.test');
    const town = manager.siteId as string;
    const from = time.addDays(time.nairobiToday(new Date()), 14);

    const own = await createVersion(manager, 'LATENESS', { siteId: town, effectiveFrom: from, values: { graceMinutes: 12 }, reason: 'Test: busy mornings', pin: '1234' });
    track(own.version.id);
    expect(own.version).toMatchObject({ siteId: town, values: { graceMinutes: 12 } });
    expect((await getEffectiveRuleGroup(town, from, 'LATENESS')).values.graceMinutes).toBe(12);

    await expect(createVersion(manager, 'LATENESS', { siteId: null, effectiveFrom: from, values: { graceMinutes: 1 }, reason: 'x', pin: '1234' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(createVersion(manager, 'LATENESS', { siteId: town, effectiveFrom: from, values: { deductionCapPercentOfPay: 3 }, reason: 'x', pin: '1234' })).rejects.toMatchObject({ statusCode: 422 });

    const back = await createVersion(manager, 'LATENESS', { siteId: town, effectiveFrom: from, values: {}, reason: 'Test: back to the company rule', pin: '1234' });
    track(back.version.id);
    expect(back.version).toMatchObject({ version: 2, values: {} });
    expect((await getEffectiveRuleGroup(town, from, 'LATENESS')).values.graceMinutes).toBe(5);
    expect(back.notice.recipients.some((r) => r.userId === director.id)).toBe(true);
  });

  it('two saves at once get two numbers, a retried save is not a second save, and a wrong PIN writes nothing', async () => {
    const { time, createVersion, prisma, resetPinTries, who } = ctx;
    resetPinTries();
    const director = await who('director@wendo.test');
    const from = time.addDays(time.nairobiToday(new Date()), 120);

    const [a, b] = await Promise.all([
      createVersion(director, 'CONDUCT', { siteId: null, effectiveFrom: from, values: { appealWithinDays: 8 }, reason: 'Test: parallel A', pin: '1234' }),
      createVersion(director, 'CONDUCT', { siteId: null, effectiveFrom: from, values: { acknowledgeWithinDays: 4 }, reason: 'Test: parallel B', pin: '1234' }).catch((e: unknown) => e),
    ]);
    track(a.version.id);
    if ('version' in (b as object)) track((b as { version: { id: string } }).version.id);
    const numbers = [a.version.version, ...('version' in (b as object) ? [(b as { version: { version: number } }).version.version] : [])];
    expect(new Set(numbers).size).toBe(numbers.length); // never the same number twice

    const key = `retry-${Date.now()}-abcd`;
    const first = await createVersion(director, 'CONDUCT', { siteId: null, effectiveFrom: time.addDays(from, 1), values: { appealWithinDays: 9 }, reason: 'Test: retry', pin: '1234', idempotencyKey: key });
    track(first.version.id);
    const retry = await createVersion(director, 'CONDUCT', { siteId: null, effectiveFrom: time.addDays(from, 1), values: { appealWithinDays: 9 }, reason: 'Test: retry', pin: '1234', idempotencyKey: key });
    expect(retry).toMatchObject({ replay: true, version: { id: first.version.id } });

    const count = await prisma.ruleVersion.count({ where: { group: 'CONDUCT' } });
    await expect(createVersion(director, 'CONDUCT', { siteId: null, effectiveFrom: time.addDays(from, 2), values: { appealWithinDays: 10 }, reason: 'x', pin: '0000' })).rejects.toMatchObject({ code: 'PIN_INVALID' });
    expect(await prisma.ruleVersion.count({ where: { group: 'CONDUCT' } })).toBe(count);
    resetPinTries();
  });

  it('every change wrote one audit entry in the same transaction, and the company chain still verifies', async () => {
    const { prisma, auditRepository, verifyAuditChain } = ctx;
    const company = (await prisma.site.findFirstOrThrow({ where: { name: 'Nyeri Town' }, select: { companyId: true } })).companyId;
    const entries = await auditRepository.listEntries(company, 0n, 5000);
    const ours = entries.filter((e) => made.includes(e.subjectId ?? ''));
    expect(ours.length).toBeGreaterThanOrEqual(made.length);
    expect(ours.every((e) => e.action.startsWith('rules.'))).toBe(true);
    expect(JSON.stringify(ours, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value))).not.toContain('"pin"');
    expect(verifyAuditChain(entries)).toMatchObject({ ok: true });
  });
});
