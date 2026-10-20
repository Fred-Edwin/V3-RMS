/** Database proof for the PIN-pause store: the pause is stored, one person's checks are serialised, nobody is locked. Lane database only. */
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('PIN tries in the database', () => {
  const users: string[] = [];
  const load = async () => {
    const { prisma } = await import('../../../../config/database');
    const { pinTriesRepository } = await import('./pin-tries-repository');
    return { prisma, store: pinTriesRepository };
  };
  const user = (): string => {
    const id = randomUUID();
    users.push(id);
    return id;
  };
  const T0 = new Date('2026-10-20T08:00:00Z');

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.workforcePinTry.deleteMany({ where: { userId: { in: users } } });
    await prisma.$disconnect();
  });

  it('answers the 3rd wrong try with an alert once, pauses from the 5th, and a later try still works', async () => {
    const { store } = await load();
    const id = user();
    const wrong = async (t: number) => store.attempt(id, 'SIGNER', new Date(T0.getTime() + t), async () => false);
    const results = [await wrong(0), await wrong(1), await wrong(2), await wrong(3), await wrong(4)];
    expect(results.map((r) => r.kind)).toEqual(['WRONG', 'WRONG', 'WRONG', 'WRONG', 'WRONG']);
    expect(results.filter((r) => r.kind === 'WRONG' && r.alert)).toHaveLength(1);
    expect(await store.attempt(id, 'SIGNER', new Date(T0.getTime() + 100), async () => true)).toEqual({ kind: 'SLOW', wait: 2 });
    expect(await store.attempt(id, 'SIGNER', new Date(T0.getTime() + 3_000), async () => true)).toEqual({ kind: 'RIGHT' });
    // a right try ends the count
    expect(await store.attempt(id, 'SIGNER', new Date(T0.getTime() + 3_100), async () => false)).toMatchObject({ kind: 'WRONG', count: 1 });
  });

  it('counts two simultaneous guesses one after the other', async () => {
    const { store } = await load();
    const id = user();
    const all = await Promise.all([1, 2, 3, 4, 5, 6].map(() => store.attempt(id, 'SIGNER', T0, async () => false)));
    expect(all.filter((r) => r.kind === 'WRONG')).toHaveLength(5);
    expect(all.filter((r) => r.kind === 'SLOW')).toHaveLength(1);
  });

  it('keeps purposes and people apart', async () => {
    const { store } = await load();
    const a = user();
    const b = user();
    for (let i = 0; i < 5; i += 1) await store.attempt(a, 'SIGNER', T0, async () => false);
    expect((await store.attempt(a, 'CONDUCT_SIGN', T0, async () => true)).kind).toBe('RIGHT');
    expect((await store.attempt(b, 'SIGNER', T0, async () => true)).kind).toBe('RIGHT');
  });
});
