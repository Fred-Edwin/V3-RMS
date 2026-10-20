/**
 * A stub issuer calling the documents door the way Leave (LVE) and Conduct (WRN) will: inside its own transaction, after it signs.
 * Real database; runs only on a `_lane` database.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('a stub issuer uses the documents door', { timeout: 30_000 }, () => {
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const door = await import('../_shared/documents/register-document');
    const verify = await import('../verify/verify-service');
    const limits = await import('../_shared/limits/rate-limit');
    return { prisma, ...door, ...verify, ...limits };
  };
  afterAll(async () => (await load()).prisma.$disconnect());
  const signer = { id: null, name: 'Stub Manager', role: 'BRANCH_MANAGER' };
  const hash = (c: string): string => c.repeat(64).slice(0, 64);
  const slip = (companyId: string, number: string, over: Record<string, unknown> = {}) => ({
    companyId, siteId: null, kind: 'LVE' as const, number, about: 'Mon 19 Oct', signedBy: signer, signedAt: new Date(), hash: hash('c'), openHref: '/app/leave/1', ...over,
  });

  it('the index row and the issuer\'s own row commit together or not at all', async () => {
    const { prisma, registerDocument } = await load();
    const companyId = randomUUID();
    const number = `LVE-${Math.floor(1000 + Math.random() * 8999)}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await registerDocument(tx, slip(companyId, number));
        throw new Error('the issuer failed after registering');
      }),
    ).rejects.toThrow('the issuer failed');
    expect(await prisma.workforceDocument.count({ where: { companyId, number } })).toBe(0);
    await prisma.$transaction((tx) => registerDocument(tx, slip(companyId, number)));
    expect(await prisma.workforceDocument.count({ where: { companyId, number } })).toBe(1);
  });

  it('a signed slip verifies at once, a corrected notice replaces the first, a withdrawn one reads withdrawn', async () => {
    const { prisma, registerDocument, withdrawDocument, checkDocument, resetRateLimits } = await load();
    resetRateLimits();
    const companyId = randomUUID();
    const who = { address: `10.7.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, deviceLabel: null };
    const n = Math.floor(1000 + Math.random() * 8999);
    await prisma.$transaction((tx) => registerDocument(tx, slip(companyId, `LVE-${n}`)));
    expect((await checkDocument('lve', `LVE-${n}`, hash('c').slice(0, 10), who)).answer.outcome).toBe('GENUINE');
    const warning = (version: number, c: string) => slip(companyId, `WRN-${n}`, { kind: 'WRN', version, hash: hash(c), signedBy: { id: null, name: 'Stub HR', role: 'HR_MANAGER' } });
    await prisma.$transaction((tx) => registerDocument(tx, warning(1, 'a') as never));
    await prisma.$transaction((tx) => registerDocument(tx, warning(2, 'b') as never));
    expect((await checkDocument('wrn', `WRN-${n}`, hash('a').slice(0, 10), who)).answer.outcome).toBe('REPLACED');
    expect((await checkDocument('wrn', `WRN-${n}`, hash('b').slice(0, 10), who)).answer.outcome).toBe('GENUINE');
    await prisma.$transaction((tx) => withdrawDocument(tx, { companyId, number: `WRN-${n}`, byRole: 'HR_MANAGER', at: new Date() }));
    const gone = await checkDocument('wrn', `WRN-${n}`, hash('b').slice(0, 10), who);
    expect(gone.answer.outcome).toBe('WITHDRAWN');
    expect(gone.answer.withdrawnByRole).toBe('HR_MANAGER');
    expect(JSON.stringify(gone.answer)).not.toMatch(/Stub/);
  });

  it('a second registration with another hash is refused so a printed QR keeps one meaning', async () => {
    const { prisma, registerDocument } = await load();
    const companyId = randomUUID();
    const number = `LVE-${Math.floor(1000 + Math.random() * 8999)}`;
    await prisma.$transaction((tx) => registerDocument(tx, slip(companyId, number)));
    await expect(prisma.$transaction((tx) => registerDocument(tx, slip(companyId, number, { hash: hash('d') })))).rejects.toMatchObject({ code: 'DOCUMENT_ALREADY_REGISTERED' });
  });
});
