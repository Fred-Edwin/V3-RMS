/**
 * seed-branch-day-history-dev-fixtures.ts
 *
 * Local dev-only fixtures for Milestone Six Session 4 (day close history +
 * next-morning opening), so the live screens can be compared against the
 * Paper artboards in the same state.
 *
 * Run AFTER seed-branch-day-dev-fixtures.ts (it stocks the departments and
 * writes yesterday's close). What it adds to the Nyeri Town branch:
 *   - Three earlier CLOSED days (today−2, −3, −4) with saved counts, reasons
 *     and gaps — the third is "reopened once" with a reopen audit entry. They
 *     are history only: no ledger rows (a real close would have posted them).
 *   - Today's Kitchen opening: `--opening=pending` (default) removes any
 *     accepted opening, leaving the pre-fill for the Department Head to review;
 *     `--opening=accepted` accepts it through the real service (recounting the
 *     first item two lower, so one overnight variance posts).
 *
 * Idempotent; every date is computed from "now". ONLY runs when NODE_ENV is
 * not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-branch-day-history-dev-fixtures.ts [--opening=pending|accepted]
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { branchDayService } from '../modules/branch-day/branch-day-service';
import { getTodayDateOnly } from '../utils/date-only';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-branch-day-history-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const openingState = arg('opening') ?? 'pending';
if (!['pending', 'accepted'].includes(openingState)) {
  console.error(`Unknown --opening=${openingState}`);
  process.exit(1);
}

const D = (v: string | number) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;
const REASONS = ['UNLOGGED_WASTE', 'WALK_IN_COMP', 'CONSUMPTION'] as const;

async function main(): Promise<void> {
  const org = await prisma.organization.findFirst({ where: { name: 'Nyeri Town', isHub: false } });
  if (!org) throw new Error('Branch "Nyeri Town" not found');
  const hub = await prisma.organization.findFirst({ where: { isHub: true } });
  if (!hub) throw new Error('No hub organization');
  const manager = await prisma.user.findFirst({ where: { organizationId: org.id, role: 'MANAGER', isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!manager) throw new Error('No manager for Nyeri Town');
  const head = await prisma.user.findFirst({ where: { organizationId: org.id, isDepartmentHead: true, departmentTag: 'KITCHEN', isActive: true } });
  if (!head) throw new Error('No Kitchen department head for Nyeri Town');

  const locations = await prisma.location.findMany({ where: { organizationId: org.id, type: 'BRANCH_DEPARTMENT' } });
  const kitchen = locations.find((l) => l.departmentTag === 'KITCHEN');
  if (!kitchen) throw new Error('No Kitchen location');
  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: hub.id, deletedAt: null, departmentTags: { has: 'KITCHEN' } },
    orderBy: { name: 'asc' },
    take: 8,
  });
  if (items.length === 0) throw new Error('No Kitchen items — run the branch day fixtures first');

  const today = getTodayDateOnly();

  // 1. Earlier fixture days, rebuilt from scratch.
  const offsets = [2, 3, 4];
  await prisma.branchDay.deleteMany({ where: { organizationId: org.id, businessDate: { in: offsets.map((n) => new Date(today.getTime() - n * DAY_MS)) } } });
  for (const [i, back] of offsets.entries()) {
    const date = new Date(today.getTime() - back * DAY_MS);
    const closedAt = new Date(date.getTime() + 18 * 60 * 60 * 1000 + (40 - i * 7) * 60 * 1000);
    const counter = await prisma.referenceCounter.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: 'DAY' } },
      update: { lastNumber: { increment: 1 } },
      create: { organizationId: org.id, prefix: 'DAY', lastNumber: 1 },
      select: { lastNumber: true },
    });
    const day = await prisma.branchDay.create({
      data: {
        organizationId: org.id,
        businessDate: date,
        status: 'CLOSED',
        reference: `DAY-${String(counter.lastNumber).padStart(4, '0')}`,
        closedById: manager.id,
        closedAt,
        reopenCount: i === 1 ? 1 : 0,
        departments: {
          create: locations
            .filter((l) => l.departmentTag)
            .map((l) => ({ departmentTag: l.departmentTag!, locationId: l.id, status: 'COUNTED' as const, countedById: manager.id, countedAt: new Date(closedAt.getTime() - 60 * 60 * 1000) })),
        },
      },
      include: { departments: true },
    });
    const kitchenDept = day.departments.find((d) => d.departmentTag === 'KITCHEN')!;
    await prisma.branchDayLine.createMany({
      data: items.map((item, index) => {
        const expected = D(8 + index * 2);
        const cost = item.currentCost.greaterThan(0) ? item.currentCost : D(120);
        // One line per day carries a reasoned gap over the threshold; the rest reconcile or drift a little.
        const gap = index === i ? D(Math.ceil(1200 / cost.toNumber())) : index === i + 3 ? D(1) : D(0);
        const reasonRequired = gap.times(cost).greaterThanOrEqualTo(1000);
        return {
          branchDayDepartmentId: kitchenDept.id,
          inventoryItemId: item.id,
          expectedQty: expected,
          countedQty: Prisma.Decimal.max(expected.minus(gap), 0),
          unitCost: cost,
          reasonRequired,
          reason: reasonRequired ? REASONS[i % REASONS.length]! : null,
        };
      }),
    });
    if (i === 1) {
      await prisma.branchDayReopen.create({
        data: { branchDayId: day.id, reopenedById: manager.id, reopenedAt: new Date(closedAt.getTime() + 25 * 60 * 1000), reason: 'Pastry count entered against the wrong tray — recounting.' },
      });
    }
  }

  // 2. Today's Kitchen opening.
  const todayDay = await prisma.branchDay.findFirst({ where: { organizationId: org.id, businessDate: today }, select: { id: true } });
  if (todayDay) {
    const existing = await prisma.departmentOpening.findFirst({ where: { branchDayId: todayDay.id, departmentTag: 'KITCHEN' }, include: { lines: true } });
    if (existing) {
      const lineIds = existing.lines.map((l) => l.id);
      await prisma.inventoryTransaction.updateMany({ where: { openingLineId: { in: lineIds } }, data: { reversesTransactionId: null } });
      await prisma.inventoryTransaction.deleteMany({ where: { openingLineId: { in: lineIds } } });
      await prisma.departmentOpening.delete({ where: { id: existing.id } });
    }
  }
  if (openingState === 'accepted') {
    const actor = { id: head.id, role: head.role, organizationId: org.id, isDepartmentHead: true, departmentTag: 'KITCHEN' as const } as never;
    const view = await branchDayService.getOpening(actor);
    const first = view.lines[0];
    if (!first) throw new Error('Kitchen has no opening lines');
    const recount = Prisma.Decimal.max(D(first.prefilledQty).minus(2), 0);
    const result = await branchDayService.acceptOpening(actor, { lines: [{ inventoryItemId: first.inventoryItemId, acceptedQty: recount.toString() }] });
    console.log(`Opening accepted — ${result.varianceLineCount} overnight variance(s), ${result.adjustmentCount} adjustment(s).`);
  }

  console.log(`History fixtures ready — Nyeri Town: 3 earlier closed days, opening=${openingState}. Manager ${manager.email}, Kitchen head ${head.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
