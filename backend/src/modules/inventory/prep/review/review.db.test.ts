/**
 * Needs a look and Mark reviewed against a REAL database (no mocks). Opt-in:
 *   cd backend && RUN_DB_TESTS=1 pnpm exec vitest run src/modules/inventory/prep/review/review.db.test.ts
 * It adds a few flagged runs of its own, checks the badge count equals the `needs_look` rows the queue should hold
 * (RECORDED only, this site only), that Mark reviewed clears the flag, and removes what it made. `prep_runs` is not append-only.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../../../config/database';
import { reviewService } from './review-service';

const enabled = process.env['RUN_DB_TESTS'] === '1';

describe.skipIf(!enabled)('review against the real database', () => {
  let actor: { id: string; role: 'STORE_MANAGER'; siteId: string };
  let locationId: string;
  let outputItemId: string;
  const made: string[] = [];

  const makeRun = async (over: { needsLook?: boolean; status?: 'RECORDED' | 'CANCELLED' | 'CORRECTED'; siteId?: string }) => {
    const id = randomUUID();
    await prisma.prepRun.create({
      data: {
        id,
        siteId: over.siteId ?? actor.siteId,
        reference: `TEST-${id.slice(0, 8)}`,
        idempotencyKey: id,
        outputItemId,
        actualYield: 10,
        outputUnitCost: 1,
        totalInputCost: 10,
        locationId,
        createdById: actor.id,
        needsLook: over.needsLook ?? true,
        status: over.status ?? 'RECORDED',
      },
    });
    made.push(id);
    return id;
  };

  beforeAll(async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER' } });
    actor = { id: user.id, role: 'STORE_MANAGER', siteId: user.siteId as string };
    locationId = (await prisma.location.findFirstOrThrow({ where: { siteId: actor.siteId, type: 'CENTRAL_STORE' } })).id;
    outputItemId = (await prisma.inventoryItem.findFirstOrThrow({ where: { siteId: actor.siteId, type: 'PREPPED', deletedAt: null } })).id;
  });

  afterAll(async () => {
    await prisma.prepRun.deleteMany({ where: { id: { in: made } } });
    await prisma.$disconnect();
  });

  it('counts only RECORDED flagged runs of this site, and the count equals the queue', async () => {
    const before = await reviewService.count(actor);
    await makeRun({});
    await makeRun({});
    await makeRun({ status: 'CANCELLED' }); // flagged, but cancelled: not in the queue
    await makeRun({ needsLook: false }); // not flagged
    const after = await reviewService.count(actor);
    expect(after.count).toBe(before.count + 2);

    const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM prep_runs WHERE organization_id = ${actor.siteId} AND needs_look = true AND status = 'RECORDED'`;
    expect(Number(rows[0]?.n)).toBe(after.count);
    const queue = await reviewService.needsLook(actor, { page: 1, perPage: 100 });
    expect(queue.count).toBe(after.count);
  });

  it('Mark reviewed clears the flag, stamps who and when, and the count drops by one', async () => {
    const id = await makeRun({});
    const before = await reviewService.count(actor);
    const run = await reviewService.review(actor, id);
    expect(run.needsLook).toBe(false);
    expect(run.reviewedBy?.id).toBe(actor.id);
    expect((await reviewService.count(actor)).count).toBe(before.count - 1);

    const again = await reviewService.review(actor, id); // idempotent
    expect(again.reviewedAt).toBe(run.reviewedAt);
    expect((await reviewService.count(actor)).count).toBe(before.count - 1);
  });

  it('refuses to review a cancelled run', async () => {
    const id = await makeRun({ status: 'CANCELLED' });
    await expect(reviewService.review(actor, id)).rejects.toMatchObject({ code: 'RUN_NOT_OPEN' });
  });
});
