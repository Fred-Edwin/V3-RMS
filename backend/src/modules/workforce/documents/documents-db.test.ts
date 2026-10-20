/** The documents door, visibility and the public verify check against a real database. Runs only on a `_lane` database. */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('documents door and verify', { timeout: 30_000 }, () => {
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const door = await import('../_shared/documents/register-document');
    const verify = await import('../verify/verify-service');
    const limits = await import('../_shared/limits/rate-limit');
    return { prisma, ...door, ...verify, ...limits };
  };
  const base = (companyId: string, over: Record<string, unknown> = {}) => ({
    companyId, siteId: null, kind: 'PS' as const, number: `PS-${Math.floor(1000 + Math.random() * 8999)}`, about: 'September 2026', signedBy: { id: 'u', name: 'Anne', role: 'ACCOUNTANT' },
    signedAt: new Date(), hash: 'a1b2c3d4e5'.padEnd(64, 'f'), openHref: '/x', ...over,
  });
  afterAll(async () => (await load()).prisma.$disconnect());

  it('registers once, ignores a repeat, refuses a different hash, and version 2 replaces version 1', async () => {
    const { prisma, registerDocument } = await load();
    const input = base(randomUUID());
    const reg = (i: typeof input) => prisma.$transaction((tx) => registerDocument(tx, i));
    expect((await reg(input)).created).toBe(true);
    expect((await reg(input)).created).toBe(false);
    await expect(reg({ ...input, hash: 'e'.repeat(64) })).rejects.toMatchObject({ code: 'DOCUMENT_ALREADY_REGISTERED' });
    await reg({ ...input, version: 2, hash: 'd'.repeat(64) } as never);
    const rows = await prisma.workforceDocument.findMany({ where: { companyId: input.companyId }, orderBy: { version: 'asc' } });
    expect(rows.map((r) => [r.version, r.status])).toEqual([[1, 'REPLACED'], [2, 'CURRENT']]);
  });

  it('refuses a malformed number, a bad hash and an amount in the period', async () => {
    const { prisma, registerDocument } = await load();
    const c = randomUUID();
    const reg = (i: Record<string, unknown>) => prisma.$transaction((tx) => registerDocument(tx, base(c, i) as never));
    await expect(reg({ number: 'XX-1' })).rejects.toMatchObject({ code: 'DOCUMENT_NUMBER_INVALID' });
    await expect(reg({ hash: 'zz' })).rejects.toMatchObject({ code: 'DOCUMENT_HASH_INVALID' });
    await expect(reg({ about: 'Net KES 91,234.00' })).rejects.toMatchObject({ code: 'DOCUMENT_TEXT_HAS_AMOUNT' });
  });

  it('the public check: genuine, replaced, withdrawn, and one answer for unknown and wrong hash', async () => {
    const { prisma, registerDocument, withdrawDocument, checkDocument, resetRateLimits } = await load();
    resetRateLimits();
    const c = randomUUID();
    const input = base(c, { number: `PS-${Math.floor(1000 + Math.random() * 8999)}` });
    const who = { address: `10.0.${Math.floor(Math.random() * 250)}.1`, deviceLabel: null };
    await prisma.$transaction((tx) => registerDocument(tx, input));
    await prisma.$transaction((tx) => registerDocument(tx, { ...input, version: 2, hash: 'b9b9b9b9b9'.padEnd(64, '1') } as never));
    expect((await checkDocument('ps', input.number, 'b9b9b9b9b9', who)).answer.outcome).toBe('GENUINE');
    expect((await checkDocument('ps', input.number, 'a1b2c3d4e5', who)).answer.outcome).toBe('REPLACED');
    const wrong = await checkDocument('ps', input.number, '0000000000', who);
    const unknown = await checkDocument('ps', 'PS-0000001', '0000000000', who);
    expect(wrong.answer.outcome).toBe('NOT_VERIFIED');
    expect({ ...wrong.answer, checkedAt: '' }).toEqual({ ...unknown.answer, checkedAt: '' });
    expect([wrong.recorded, unknown.recorded]).toEqual(['HASH_MISMATCH', 'UNKNOWN']);
    expect((await checkDocument('ps', 'nonsense', 'zz', who)).answer.outcome).toBe('MALFORMED');
    await prisma.$transaction((tx) => withdrawDocument(tx, { companyId: c, number: input.number, byRole: 'ACCOUNTANT', at: new Date() }));
    expect((await checkDocument('ps', input.number, 'b9b9b9b9b9', who)).answer.outcome).toBe('WITHDRAWN');
  });

  it('the 31st check in a minute from one address is rate limited', async () => {
    const { checkDocument, resetRateLimits } = await load();
    resetRateLimits();
    const who = { address: `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, deviceLabel: null }; // Redis may hold an older run's count
    const outcomes: string[] = [];
    for (let i = 0; i < 31; i += 1) outcomes.push((await checkDocument('ps', 'PS-0000002', '0000000000', who)).answer.outcome);
    expect(outcomes.filter((o) => o === 'RATE_LIMITED')).toHaveLength(1);
  });
});
