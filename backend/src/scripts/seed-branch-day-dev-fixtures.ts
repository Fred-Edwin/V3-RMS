/**
 * seed-branch-day-dev-fixtures.ts
 *
 * Local dev-only fixtures for the Branch day rebuild (Block 4), so the live screens can be compared against the Paper artboards in the
 * same state.
 *
 * What it does to the Nyeri Town branch (override with --branch="…"):
 *   - Gives every department stock: one fixture DISPATCH_IN (with a cost) per item the department holds, so Used today and the KES values
 *     are real. Previous fixture rows are removed first.
 *   - Resets the Branch Manager's PIN to 1234 (so the gate can sign).
 *   - Removes today's and yesterday's day (their ledger entries, corrections and sheets included) and writes yesterday's as CLOSED
 *     "21:40 by the Branch Manager": a day closed under the old flow (closing figures only, no Used today).
 *   - Moves the branch's dispatches out of the way: every one is CONFIRMED except one that is re-pointed at `--block=<department name>`
 *     (default Barista; `--block=none` confirms them all), which is the "delivery not confirmed" blocker. Dev dispatch fixtures are
 *     rewritten; never runs in production.
 *   - Puts today in the state given by `--state=`, driving the real service functions (so every rule runs):
 *       none      the day does not exist yet (the Branch Manager's first read creates it)
 *       open      the day exists, nothing counted
 *       counting  Kitchen partly typed (5 of its items, not signed)
 *       ready     every department counted and signed on behalf by the Branch Manager (forces --block=none)
 *       closed    ready, then signed and closed
 *
 * Idempotent; every date is computed from "now". ONLY runs when NODE_ENV is not "production". Run after seed-stock-waste-dev-fixtures.ts.
 *
 * Usage:
 *   npx tsx src/scripts/seed-branch-day-dev-fixtures.ts [--state=none|open|counting|ready|closed] [--block="Barista"|none]
 */

import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { branchDayService } from '../modules/inventory/branch-day/branch-day-service';
import { referenceCounterRepository } from '../modules/inventory/_shared/reference-counter';
import { hashPin } from '../utils/password';
import { getTodayDateOnly } from '../utils/date-only';
import { allowLedgerEditsInThisTransaction } from './ledger-dev-bypass';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-branch-day-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const FIXTURE_NOTE = 'Branch day dev fixture';
const PIN = '1234';

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const state = arg('state') ?? 'open';
const branchName = arg('branch') ?? 'Nyeri Town';
let block = arg('block') ?? 'Barista';
if (!['none', 'open', 'counting', 'ready', 'closed'].includes(state)) {
  console.error(`Unknown --state=${state}`);
  process.exit(1);
}
if (state === 'ready' || state === 'closed') block = 'none';

const D = (v: string | number) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const org = await prisma.site.findFirst({ where: { name: branchName, isHub: false } });
  if (!org) throw new Error(`Branch "${branchName}" not found`);
  const manager = await prisma.user.findFirst({ where: { siteId: org.id, role: 'MANAGER', isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!manager) throw new Error(`No manager for ${org.name}`);

  await prisma.user.update({ where: { id: manager.id }, data: { pinHash: await hashPin(PIN) } });
  const departments = await prisma.department.findMany({ where: { siteId: org.id, status: 'ACTIVE' }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const locations = await prisma.location.findMany({ where: { siteId: org.id, type: 'BRANCH_DEPARTMENT', departmentId: { not: null } } });

  // 1. Remove today's and yesterday's day, their ledger entries and any earlier fixture stock.
  const today = getTodayDateOnly();
  const yesterday = new Date(today.getTime() - DAY_MS);
  await prisma.$transaction(async (tx) => {
    await allowLedgerEditsInThisTransaction(tx);
    const days = await tx.branchDay.findMany({ where: { siteId: org.id, businessDate: { in: [today, yesterday] } }, select: { id: true } });
    const dayIds = days.map((d) => d.id);
    const lineIds = (await tx.branchDayLine.findMany({ where: { department: { branchDayId: { in: dayIds } } }, select: { id: true } })).map((l) => l.id);
    const openingLineIds = (await tx.departmentOpeningLine.findMany({ where: { opening: { branchDayId: { in: dayIds } } }, select: { id: true } })).map((l) => l.id);
    await tx.branchDayCorrection.deleteMany({ where: { branchDayId: { in: dayIds } } });
    await tx.inventoryTransaction.updateMany({ where: { OR: [{ branchDayLineId: { in: lineIds } }, { openingLineId: { in: openingLineIds } }] }, data: { reversesTransactionId: null } });
    await tx.inventoryTransaction.deleteMany({ where: { OR: [{ branchDayLineId: { in: lineIds } }, { openingLineId: { in: openingLineIds } }] } });
    await tx.branchDay.deleteMany({ where: { id: { in: dayIds } } });
    await tx.inventoryTransaction.deleteMany({ where: { siteId: org.id, reason: FIXTURE_NOTE } });
  });

  // 2. Stock in every department, with a cost, so Used today carries a KES value.
  let stocked = 0;
  for (const loc of locations) {
    const items = await prisma.inventoryItem.findMany({ where: { deletedAt: null, departments: { some: { departmentId: loc.departmentId ?? '' } } }, orderBy: { name: 'asc' } });
    let i = 0;
    for (const item of items) {
      const cost = item.currentCost.greaterThan(0) ? item.currentCost : D(80 + (i % 5) * 40);
      await prisma.inventoryTransaction.create({
        data: { siteId: org.id, locationId: loc.id, inventoryItemId: item.id, type: 'DISPATCH_IN', quantity: D(6 + ((i * 7) % 15)), unitCost: cost, reason: FIXTURE_NOTE, userId: manager.id },
      });
      i += 1;
      stocked += 1;
    }
  }

  // 3. Yesterday: a day closed under the old flow at 21:40 (Nairobi) by the manager: Closed in History, no Used today.
  const closedAt = new Date(yesterday.getTime() + 18 * 60 * 60 * 1000 + 40 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    const reference = org.code ? `DAY-${org.code}-${String(await referenceCounterRepository.nextNumber(tx, org.id, 'DAY')).padStart(4, '0')}` : await referenceCounterRepository.nextReference(tx, org.id, 'DAY');
    await tx.branchDay.create({
      data: {
        siteId: org.id,
        businessDate: yesterday,
        status: 'CLOSED',
        reference,
        closedById: manager.id,
        closedAt,
        closingValue: D(0),
        departments: {
          create: locations.map((l) => ({ departmentId: l.departmentId, departmentTag: l.departmentTag, locationId: l.id, status: 'COUNTED' as const, countedById: manager.id, countedAt: closedAt })),
        },
      },
    });
  });

  // 3b. Dispatches: confirm the branch's in-transit ones, then (unless --block=none) put one back on the way to the blocked department.
  const dispatches = await prisma.dispatch.findMany({ where: { toSiteId: org.id }, orderBy: { signedAt: 'asc' } });
  await prisma.dispatch.updateMany({ where: { toSiteId: org.id, status: 'ON_THE_WAY' }, data: { status: 'CONFIRMED', countedById: manager.id, countedAt: new Date() } });
  const blocked = block.toLowerCase() === 'none' ? null : departments.find((d) => d.name.toLowerCase() === block.toLowerCase());
  if (blocked && dispatches[0]) {
    await prisma.dispatch.update({ where: { id: dispatches[0].id }, data: { status: 'ON_THE_WAY', countedById: null, countedAt: null, departmentId: blocked.id } });
  }

  // 4. Today, in the requested state: through the real service so every rule runs.
  if (state !== 'none') {
    const actor = { id: manager.id, role: 'MANAGER' as const, siteId: org.id, isDepartmentHead: false };
    const today_ = await branchDayService.today(actor, {});
    const day = today_.day;
    if (state !== 'open' && day) {
      for (const dept of departments) {
        const view = await branchDayService.getCount(actor, { departmentId: dept.id });
        const location = locations.find((l) => l.departmentId === dept.id);
        if (!location) continue;
        const partial = state === 'counting';
        if (partial && dept.name !== 'Kitchen') continue;
        const positions = await prisma.inventoryTransaction.groupBy({ by: ['inventoryItemId'], where: { siteId: org.id, locationId: location.id }, _sum: { quantity: true } });
        const onHand = new Map(positions.map((p) => [p.inventoryItemId, p._sum.quantity ?? D(0)]));
        const targets = partial ? view.lines.slice(0, 5) : view.lines;
        // Each department's first item runs one short, so Used today has a figure to read.
        const lines = targets.map((line, index) => ({ itemId: line.itemId, countedQty: Prisma.Decimal.max((onHand.get(line.itemId) ?? D(0)).minus(index === 0 ? 1 : 0), 0).toString() }));
        if (lines.length === 0) continue;
        await branchDayService.saveCount(actor, { departmentId: dept.id, lines });
        if (!partial) await branchDayService.signCount(actor, { departmentId: dept.id, pin: PIN, idempotencyKey: randomUUID() });
      }
      if (state === 'closed') await branchDayService.closeDay(actor, day.head.id, { pin: PIN, idempotencyKey: randomUUID() });
    }
  }

  console.log(`Branch day fixtures ready: ${org.name}, state=${state}, block=${block}, ${stocked} stock rows. Manager: ${manager.email} (PIN ${PIN}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
