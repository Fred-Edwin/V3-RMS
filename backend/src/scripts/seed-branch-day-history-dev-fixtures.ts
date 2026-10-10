/**
 * seed-branch-day-history-dev-fixtures.ts
 *
 * Local dev-only fixtures for the Branch day History and the opening check (Block 4), so the live screens can be compared against the
 * Paper artboards in the same state.
 *
 * Run AFTER seed-branch-day-dev-fixtures.ts (it stocks the departments). What it adds to the Nyeri Town branch:
 *   - Three earlier CLOSED days (today−2, −3, −4) with the Kitchen's figures frozen as a real close freezes them (opening, received,
 *     waste, closing, Used today, unit cost) and the day's totals. The second carries one correction, so History shows "Corrected".
 *     They are history only: no usage entries (a real close would have posted them) and no day sheet; close a day through the
 *     service to get those.
 *   - Today's Kitchen opening: `--opening=pending` (default) removes any checked opening, leaving last night's figures for the head to
 *     check; `--opening=accepted` has the Kitchen head record it through the real service (recounting the first item two lower, so one
 *     overnight variance posts).
 *
 * Idempotent; every date is computed from "now". ONLY runs when NODE_ENV is not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-branch-day-history-dev-fixtures.ts [--opening=pending|accepted]
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
  console.error('ERROR: seed-branch-day-history-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const PIN = '1234';
const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const openingState = arg('opening') ?? 'pending';
if (!['pending', 'accepted'].includes(openingState)) {
  console.error(`Unknown --opening=${openingState}`);
  process.exit(1);
}

const D = (v: string | number) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;
const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

async function main(): Promise<void> {
  const org = await prisma.site.findFirst({ where: { name: 'Nyeri Town', isHub: false } });
  if (!org) throw new Error('Branch "Nyeri Town" not found');
  const manager = await prisma.user.findFirst({ where: { siteId: org.id, role: 'MANAGER', isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!manager) throw new Error('No manager for Nyeri Town');
  const kitchen = await prisma.department.findFirst({ where: { siteId: org.id, name: 'Kitchen', status: 'ACTIVE' } });
  if (!kitchen) throw new Error('No Kitchen department for Nyeri Town');
  const head = await prisma.user.findFirst({ where: { siteId: org.id, departmentId: kitchen.id, isDepartmentHead: true, isActive: true } });
  if (!head) throw new Error('No Kitchen department head for Nyeri Town');
  const locations = await prisma.location.findMany({ where: { siteId: org.id, type: 'BRANCH_DEPARTMENT', departmentId: { not: null } } });
  const kitchenLocation = locations.find((l) => l.departmentId === kitchen.id);
  if (!kitchenLocation) throw new Error('No Kitchen location');
  const items = await prisma.inventoryItem.findMany({ where: { deletedAt: null, departments: { some: { departmentId: kitchen.id } } }, orderBy: { name: 'asc' }, take: 8 });
  if (items.length === 0) throw new Error('No Kitchen items: run the branch day fixtures first');

  const today = getTodayDateOnly();

  // 1. Earlier fixture days, rebuilt from scratch.
  const offsets = [2, 3, 4];
  const dates = offsets.map((n) => new Date(today.getTime() - n * DAY_MS));
  await prisma.$transaction(async (tx) => {
    await allowLedgerEditsInThisTransaction(tx);
    const old = await tx.branchDay.findMany({ where: { siteId: org.id, businessDate: { in: dates } }, select: { id: true } });
    const ids = old.map((d) => d.id);
    const lineIds = (await tx.branchDayLine.findMany({ where: { department: { branchDayId: { in: ids } } }, select: { id: true } })).map((l) => l.id);
    await tx.branchDayCorrection.deleteMany({ where: { branchDayId: { in: ids } } });
    await tx.inventoryTransaction.updateMany({ where: { branchDayLineId: { in: lineIds } }, data: { reversesTransactionId: null } });
    await tx.inventoryTransaction.deleteMany({ where: { branchDayLineId: { in: lineIds } } });
    await tx.branchDay.deleteMany({ where: { id: { in: ids } } });
  });

  for (const [i, date] of dates.entries()) {
    const closedAt = new Date(date.getTime() + 18 * 60 * 60 * 1000 + (40 - i * 7) * 60 * 1000);
    const lines = items.map((item, index) => {
      const cost = item.currentCost.greaterThan(0) ? item.currentCost : D(120);
      const opening = D(8 + index * 2);
      const received = index % 3 === 0 ? D(4) : D(0);
      const waste = index === i ? D(1) : D(0);
      const used = D(1 + ((index + i) % 4));
      const closing = opening.plus(received).minus(waste).minus(used);
      return { item, cost, opening, received, waste, used, closing };
    });
    const usedValue = lines.reduce((s, l) => s.plus(money(l.used.times(l.cost))), D(0));
    const closingValue = lines.reduce((s, l) => s.plus(money(l.closing.times(l.cost))), D(0));
    const reference = await prisma.$transaction(async (tx) =>
      org.code ? `DAY-${org.code}-${String(await referenceCounterRepository.nextNumber(tx, org.id, 'DAY')).padStart(4, '0')}` : referenceCounterRepository.nextReference(tx, org.id, 'DAY'),
    );
    const day = await prisma.branchDay.create({
      data: {
        siteId: org.id,
        businessDate: date,
        status: 'CLOSED',
        reference,
        closedById: manager.id,
        closedAt,
        usedValue,
        closingValue,
        closeIdempotencyKey: randomUUID(),
        departments: {
          create: locations.map((l) => ({
            departmentId: l.departmentId,
            departmentTag: l.departmentTag,
            locationId: l.id,
            status: 'COUNTED' as const,
            countedById: manager.id,
            countedAt: new Date(closedAt.getTime() - 60 * 60 * 1000),
            onBehalf: true,
          })),
        },
      },
      include: { departments: true },
    });
    const kitchenRow = day.departments.find((d) => d.departmentId === kitchen.id);
    if (!kitchenRow) continue;
    await prisma.branchDayLine.createMany({
      data: lines.map((l) => ({
        branchDayDepartmentId: kitchenRow.id,
        inventoryItemId: l.item.id,
        countedQty: l.closing,
        unitCost: l.cost,
        openingQty: l.opening,
        receivedQty: l.received,
        wasteQty: l.waste,
        usedQty: l.used,
      })),
    });
    if (i === 1) {
      // One correction, so this day reads "Corrected": the first item's closing figure one higher, with its linked ledger entry.
      const line = await prisma.branchDayLine.findFirst({ where: { branchDayDepartmentId: kitchenRow.id, inventoryItemId: items[0]?.id }, select: { id: true, countedQty: true, usedQty: true, unitCost: true } });
      if (line?.countedQty && line.usedQty) {
        const entry = await prisma.inventoryTransaction.create({
          data: { siteId: org.id, locationId: kitchenLocation.id, inventoryItemId: items[0]?.id ?? '', type: 'ADJUSTMENT', quantity: D(1), unitCost: line.unitCost, reason: 'Count corrected: Counted wrongly', reference, userId: manager.id, branchDayLineId: line.id },
        });
        await prisma.branchDayCorrection.create({
          data: {
            branchDayId: day.id,
            branchDayLineId: line.id,
            fromClosingQty: line.countedQty,
            toClosingQty: line.countedQty.plus(1),
            fromUsedQty: line.usedQty,
            toUsedQty: line.usedQty.minus(1),
            reason: 'COUNTED_WRONGLY',
            correctedById: manager.id,
            correctedAt: new Date(closedAt.getTime() + 14 * 60 * 60 * 1000),
            transactionId: entry.id,
            sheetVersion: 1,
            idempotencyKey: randomUUID(),
          },
        });
        await prisma.branchDayLine.update({ where: { id: line.id }, data: { countedQty: line.countedQty.plus(1), usedQty: line.usedQty.minus(1) } });
      }
    }
  }

  // 2. Today's Kitchen opening.
  const todayDay = await prisma.branchDay.findFirst({ where: { siteId: org.id, businessDate: today }, select: { id: true } });
  if (todayDay) {
    const existing = await prisma.departmentOpening.findFirst({ where: { branchDayId: todayDay.id, departmentId: kitchen.id }, include: { lines: true } });
    if (existing) {
      const lineIds = existing.lines.map((l) => l.id);
      await prisma.$transaction(async (tx) => {
        await allowLedgerEditsInThisTransaction(tx);
        await tx.inventoryTransaction.updateMany({ where: { openingLineId: { in: lineIds } }, data: { reversesTransactionId: null } });
        await tx.inventoryTransaction.deleteMany({ where: { openingLineId: { in: lineIds } } });
        await tx.departmentOpening.delete({ where: { id: existing.id } });
      });
    }
  }
  if (openingState === 'accepted') {
    await prisma.user.update({ where: { id: head.id }, data: { pinHash: await hashPin(PIN) } });
    const actor = { id: head.id, role: head.role, siteId: org.id, isDepartmentHead: true };
    const view = await branchDayService.opening(actor, {});
    const first = view.lines[0];
    if (!first) throw new Error('Kitchen has no opening lines');
    const lines = view.lines.map((l, index) => ({ itemId: l.itemId, countedQty: index === 0 ? Prisma.Decimal.max(D(l.lastNightQty).minus(2), 0).toString() : l.lastNightQty }));
    const result = await branchDayService.recountOpening(actor, { lines, pin: PIN, idempotencyKey: randomUUID() });
    console.log(`Opening recorded: ${result.view.check.differences.length} difference(s) from last night.`);
  }

  console.log(`History fixtures ready: Nyeri Town, 3 earlier closed days, opening=${openingState}. Manager ${manager.email}, Kitchen head ${head.email} (PIN ${PIN}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
