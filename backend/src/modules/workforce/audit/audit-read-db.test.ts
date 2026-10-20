/**
 * Integration proofs for the audit read side on a real database: the filters and exact counts over 5,000 generated entries, that the
 * list and count queries can use an index, once-per-ten-minutes log views, the chain check on a real and a broken chain, and the
 * index backfill. Runs only on a `_lane` database (see audit-db.test.ts). Rows go under a throwaway company id; the append-only log
 * cannot be cleaned up, so this never runs anywhere else.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('audit read side in the database', () => {
  const companyId = randomUUID();
  const s1 = randomUUID();
  const s2 = randomUUID();
  const CATEGORIES = ['TIME', 'LEAVE', 'PEOPLE', 'PAYSLIP_ACCESS', 'SECURITY'] as const;
  const N = 5_000;
  const base = new Date('2026-10-19T09:00:00.000Z').getTime();
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const { auditReadRepository } = await import('./audit-read-repository');
    return { prisma, repo: auditReadRepository };
  };

  const rowOf = (i: number) => ({
    companyId, siteId: i % 3 === 0 ? null : i % 3 === 1 ? s1 : s2, seq: BigInt(i), occurredAt: new Date(base - i * 60_000), actorId: i % 2 === 0 ? 'a1' : 'a2', actorRole: 'HR_MANAGER', actorName: `Actor ${i % 2}`,
    channel: 'APP' as const, action: 'people.updated', category: CATEGORIES[i % CATEGORIES.length]!, subjectType: 'Employee', subjectId: `s${i}`, subjectUserId: null, reason: null, deviceLabel: null, placeLabel: null,
    prevHash: `p${i}`, hash: `h${i}`,
  });

  beforeAll(async () => {
    const { prisma } = await load();
    const rows = Array.from({ length: N }, (_, k) => k + 1);
    await prisma.auditEntry.createMany({ data: rows.map(rowOf) });
    const entries = await prisma.auditEntry.findMany({ where: { companyId }, select: { id: true, seq: true } });
    const idOf = new Map(entries.map((e) => [Number(e.seq), e.id]));
    await prisma.workforceAuditEntryIndex.createMany({
      data: rows.map((i) => {
        const r = rowOf(i);
        return { entryId: idOf.get(i)!, companyId, siteId: r.siteId, seq: r.seq, occurredAt: r.occurredAt, area: i % 10 === 0 ? 'ACCESS' : 'WORKFORCE', flagged: i % 50 === 0, title: i % 7 === 0 ? 'Oat milk rule changed' : `Entry ${i}`, searchText: i % 7 === 0 ? 'oat milk rule changed' : `entry ${i}`, category: r.category, actorId: r.actorId, subjectUserId: null };
      }),
    });
  }, 120_000);

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.$disconnect();
  });

  const expectedCount = (pred: (i: number) => boolean) => Array.from({ length: N }, (_, k) => k + 1).filter(pred).length;

  it('counts and pages exactly, newest first, by category and site (a unit-scope reader sees only their site)', async () => {
    const { repo } = await load();
    const f = { companyId, categories: ['TIME', 'LEAVE'] as const, siteId: s1 };
    const total = await repo.countCapped(f);
    expect(total).toBe(expectedCount((i) => i % 3 === 1 && ['TIME', 'LEAVE'].includes(CATEGORIES[i % 5]!)));
    const page = await repo.page(f, 'newest', 0, 50);
    expect(page).toHaveLength(50);
    expect(page.every((r, k) => k === 0 || r.occurredAt <= page[k - 1]!.occurredAt)).toBe(true);
    const oldest = await repo.page(f, 'oldest', 0, 5);
    expect(oldest[0]!.occurredAt <= page[0]!.occurredAt).toBe(true);
  });

  it('a category the reader may not read never appears in a count (the filter is in the query)', async () => {
    const { repo } = await load();
    expect(await repo.countCapped({ companyId, categories: [] })).toBe(0);
    expect(await repo.countCapped({ companyId, categories: ['PAYSLIP_ACCESS'] })).toBe(expectedCount((i) => CATEGORIES[i % 5] === 'PAYSLIP_ACCESS'));
    expect(await repo.countCapped({ companyId: randomUUID(), categories: [...CATEGORIES] })).toBe(0);
  });

  it('filters by flagged, actor, area, date range and search (with % and _ read as plain letters)', async () => {
    const { repo } = await load();
    const all = [...CATEGORIES];
    expect(await repo.countCapped({ companyId, categories: all, flagged: true })).toBe(N / 50);
    expect(await repo.countCapped({ companyId, categories: all, actorId: 'a1' })).toBe(N / 2);
    expect(await repo.countCapped({ companyId, categories: all, area: 'ACCESS' })).toBe(N / 10);
    expect(await repo.countCapped({ companyId, categories: all, q: 'oat milk' })).toBe(expectedCount((i) => i % 7 === 0));
    expect(await repo.countCapped({ companyId, categories: all, q: '%' })).toBe(0);
    expect(await repo.countCapped({ companyId, categories: all, from: new Date(base - 60 * 60_000), before: new Date(base) })).toBe(60);
  });

  it('the list and count queries can be answered from an index, not a scan of the table', async () => {
    const { prisma, repo } = await load();
    await prisma.$executeRawUnsafe('ANALYZE workforce_audit_entry_index');
    const f = { companyId, categories: ['TIME', 'LEAVE'] as const, from: new Date(base - 86_400_000), before: new Date(base + 1) };
    expect(await repo.explain(f, 'page')).toMatch(/Index/);
    expect(await repo.explain(f, 'count')).toMatch(/Index/);
    expect(await repo.explain({ companyId, categories: ['TIME'], q: 'oat' }, 'count')).toMatch(/Index/);
  });

  it('a reader is recorded as viewing once in ten minutes, even when two pages load at once', async () => {
    const { prisma, repo } = await load();
    const userId = randomUUID();
    const claim = (at: Date) => prisma.$transaction((tx) => repo.claimViewMark(tx, userId, at, 600_000));
    const t = new Date('2026-10-19T10:00:00.000Z');
    const [a, b] = await Promise.all([claim(t), claim(t)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claim(new Date(t.getTime() + 5 * 60_000))).toBe(false);
    expect(await claim(new Date(t.getTime() + 11 * 60_000))).toBe(true);
  });

  it('the chain check passes on a real chain, checks a slice, and names the first bad entry on a broken one', async () => {
    const { runAudited } = await import('../_shared/audit/audit-writer');
    const { verifyRange } = await import('./chain-service');
    const cid = randomUUID();
    const entry = (n: number) => ({ companyId: cid, siteId: null, actor: { id: 'u', role: 'DIRECTOR', name: 'T' }, action: 'rules.version_created', category: 'RULES_OPERATING' as const, subjectType: 'R', subjectId: `${n}`, after: { n } });
    for (let n = 1; n <= 6; n += 1) await runAudited(async () => ({ result: n, entries: [entry(n)] }));
    expect(await verifyRange(cid, 1n, 6n)).toMatchObject({ ok: true, checked: 6 });
    expect(await verifyRange(cid, 3n, 5n)).toMatchObject({ ok: true, checked: 3 });
    // The generated company's rows have made-up hashes: the first entry already fails.
    expect(await verifyRange(companyId, 1n, 20n)).toMatchObject({ ok: false, atSeq: 1n });
    expect(await verifyRange(cid, 9n, 12n)).toMatchObject({ ok: false });
  });

  it('the backfill gives entries older than the index their index rows, once', async () => {
    const { prisma } = await load();
    const { backfillAuditIndex } = await import('./index-backfill');
    const cid = randomUUID();
    await prisma.auditEntry.createMany({ data: [1, 2, 3].map((i) => ({ ...rowOf(i), companyId: cid, action: 'payslip.opened', category: 'PAYSLIP_ACCESS' as const, after: { month: '2026-09', unconfirmed: true } })) });
    expect(await backfillAuditIndex(cid)).toBe(3);
    expect(await backfillAuditIndex(cid)).toBe(0);
    const index = await prisma.workforceAuditEntryIndex.findMany({ where: { companyId: cid }, orderBy: { seq: 'asc' } });
    expect(index.map((r) => [r.seq, r.category, r.flagged, r.title])).toEqual([1n, 2n, 3n].map((s) => [s, 'PAYSLIP_ACCESS', true, 'Payslip opened']));
  });
});
