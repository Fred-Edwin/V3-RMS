/**
 * Integration proofs against a real database: the append-only triggers, the chain-head guard, a gap-free chain under
 * two concurrent writers, and that a failed change rolls back with its entry.
 *
 * Runs only when DATABASE_URL points at a lane database (name contains "_lane"); skipped everywhere else, so `pnpm test`
 * stays green on any machine. It writes rows under a throwaway company id and cannot clean them up (the log is
 * append-only by design), so it never touches a production-like database.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('audit log in the database', () => {
  // Imported lazily so the skipped run never opens a connection.
  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const { runAudited } = await import('./audit-writer');
    const { auditRepository } = await import('./audit-repository');
    const { verifyAuditChain } = await import('./audit-hash');
    return { prisma, runAudited, auditRepository, verifyAuditChain };
  };

  const entryFor = (companyId: string, n: number) => ({
    companyId,
    siteId: null,
    actor: { id: 'test-user', role: 'DIRECTOR', name: 'Test' },
    action: 'rules.version_created',
    category: 'RULES_OPERATING' as const,
    subjectType: 'RuleVersion',
    subjectId: `v${n}`,
    after: { n },
    reason: 'integration test',
  });

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.$disconnect();
  });

  it('writes a linked chain, and the database refuses UPDATE, DELETE and TRUNCATE of entries', async () => {
    const { prisma, runAudited, auditRepository, verifyAuditChain } = await load();
    const companyId = `test-${randomUUID()}`;
    for (let n = 1; n <= 3; n += 1) await runAudited(async () => ({ result: n, entries: [entryFor(companyId, n)] }));

    const entries = await auditRepository.listEntries(companyId, 0n, 10);
    expect(entries.map((e) => e.seq)).toEqual([1n, 2n, 3n]);
    expect(verifyAuditChain(entries)).toMatchObject({ ok: true, checked: 3 });

    await expect(prisma.$executeRaw`UPDATE workforce_audit_entries SET reason = 'x' WHERE company_id = ${companyId}`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRaw`DELETE FROM workforce_audit_entries WHERE company_id = ${companyId}`).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE workforce_audit_entries')).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE workforce_audit_chain_heads')).rejects.toThrow(/not allowed/);
    expect(await auditRepository.listEntries(companyId, 0n, 10)).toHaveLength(3);
  });

  it('the chain head can only move to last_seq + 1 and is never deleted', async () => {
    const { prisma, runAudited } = await load();
    const companyId = `test-${randomUUID()}`;
    await runAudited(async () => ({ result: 1, entries: [entryFor(companyId, 1)] }));
    await expect(prisma.$executeRaw`UPDATE workforce_audit_chain_heads SET last_seq = 9 WHERE company_id = ${companyId}`).rejects.toThrow(/may only move/);
    await expect(prisma.$executeRaw`UPDATE workforce_audit_chain_heads SET last_seq = 0 WHERE company_id = ${companyId}`).rejects.toThrow(/may only move/);
    await expect(prisma.$executeRaw`DELETE FROM workforce_audit_chain_heads WHERE company_id = ${companyId}`).rejects.toThrow(/not allowed/);
  });

  it('two concurrent writers produce a gap-free, verifiable chain', async () => {
    const { runAudited, auditRepository, verifyAuditChain } = await load();
    const companyId = `test-${randomUUID()}`;
    await Promise.all(Array.from({ length: 10 }, (_, i) => runAudited(async () => ({ result: i, entries: [entryFor(companyId, i)] }))));
    const entries = await auditRepository.listEntries(companyId, 0n, 50);
    expect(entries.map((e) => Number(e.seq))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(verifyAuditChain(entries)).toMatchObject({ ok: true, checked: 10 });
  });

  it('a change whose entry fails is rolled back with it', async () => {
    const { prisma, runAudited } = await load();
    const companyId = `test-${randomUUID()}`;
    await expect(
      runAudited(async (tx) => {
        await tx.ruleVersion.create({
          data: { companyId, group: 'LATENESS', version: 1, effectiveFrom: new Date('2026-10-06'), values: {}, reason: 'rollback test', createdById: 'x', createdByRole: 'DIRECTOR' },
        });
        return { result: 1, entries: [{ ...entryFor(companyId, 1), action: 'not.registered' }] };
      }),
    ).rejects.toMatchObject({ code: 'AUDIT_ACTION_UNREGISTERED' });
    expect(await prisma.ruleVersion.count({ where: { companyId } })).toBe(0);
    expect(await prisma.auditEntry.count({ where: { companyId } })).toBe(0);
  });
});
