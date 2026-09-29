/**
 * seed-branch-day-dev-fixtures.ts
 *
 * Local dev-only fixtures for Milestone Six Session 3 (branch day close), so
 * the live screens can be compared against the Paper artboards in the same
 * state (session-3-plan.md "Seed for the gate").
 *
 * What it does to the Nyeri Town branch (override with --branch="…"):
 *   - Gives every department stock: one fixture DISPATCH_IN (with a cost) per
 *     department-tagged item, so expected quantities and KES gap values are
 *     real. Previous fixture rows are removed first.
 *   - Resets the Branch Manager's PIN to 1234 (so the gate can sign).
 *   - Removes today's BranchDay (its close adjustments included) and writes
 *     yesterday's as CLOSED "21:40 by the Branch Manager" (the KPI card).
 *   - Moves the branch's in-transit dispatches out of the way: every one is
 *     CONFIRMED except one that is re-pointed at `--block=<TAG>` (default
 *     BARISTA; `--block=none` confirms them all) — the "Barista · blocked"
 *     state. Dev dispatch fixtures are rewritten; never runs in production.
 *   - Puts today in the state given by `--state=`, driving the real service
 *     functions (so every rule runs):
 *       none      — no day yet (Today's day creates it on first open)
 *       open      — day exists, nothing counted
 *       counting  — Kitchen partly counted (5 of its items), gaps with reasons
 *       ready     — every department counted (forces --block=none)
 *       closed    — ready, then signed and closed
 *
 * Idempotent; every date is computed from "now". ONLY runs when NODE_ENV is
 * not "production". Run after seed-stock-waste-dev-fixtures.ts.
 *
 * Usage:
 *   npx tsx src/scripts/seed-branch-day-dev-fixtures.ts [--state=none|open|counting|ready|closed] [--block=BARISTA|none]
 */

import 'dotenv/config';
import { Prisma, type DepartmentTag } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { branchDayService } from '../modules/branch-day/branch-day-service';
import { hashPin } from '../utils/password';
import { getTodayDateOnly } from '../utils/date-only';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-branch-day-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const FIXTURE_NOTE = 'M6 S3 dev fixture';
const PIN = '1234';
const TAGS: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const state = arg('state') ?? 'open';
const branchName = arg('branch') ?? 'Nyeri Town';
let block = (arg('block') ?? 'BARISTA').toUpperCase();
if (!['none', 'open', 'counting', 'ready', 'closed'].includes(state)) {
  console.error(`Unknown --state=${state}`);
  process.exit(1);
}
if (state === 'ready' || state === 'closed') block = 'NONE';
if (block !== 'NONE' && !TAGS.includes(block as DepartmentTag)) {
  console.error(`Unknown --block=${block}`);
  process.exit(1);
}

const D = (v: string | number) => new Prisma.Decimal(v);
const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const org = await prisma.organization.findFirst({ where: { name: branchName, isHub: false } });
  if (!org) throw new Error(`Branch "${branchName}" not found`);
  const manager = await prisma.user.findFirst({
    where: { organizationId: org.id, role: 'MANAGER', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!manager) throw new Error(`No manager for ${org.name}`);
  const hub = await prisma.organization.findFirst({ where: { isHub: true } });
  if (!hub) throw new Error('No hub organization');

  await prisma.user.update({ where: { id: manager.id }, data: { pinHash: await hashPin(PIN) } });
  const locations = await prisma.location.findMany({ where: { organizationId: org.id, type: 'BRANCH_DEPARTMENT' } });

  // 1. Remove today's day, its adjustments and any earlier fixture stock.
  const today = getTodayDateOnly();
  const yesterday = new Date(today.getTime() - DAY_MS);
  await prisma.$transaction(async (tx) => {
    const days = await tx.branchDay.findMany({ where: { organizationId: org.id }, select: { id: true } });
    const lineIds = (
      await tx.branchDayLine.findMany({ where: { department: { branchDayId: { in: days.map((d) => d.id) } } }, select: { id: true } })
    ).map((l) => l.id);
    // Reversal rows point at the rows they reverse — clear those links first.
    await tx.inventoryTransaction.updateMany({ where: { branchDayLineId: { in: lineIds } }, data: { reversesTransactionId: null } });
    await tx.inventoryTransaction.deleteMany({ where: { branchDayLineId: { in: lineIds } } });
    await tx.branchDay.deleteMany({ where: { organizationId: org.id, businessDate: { in: [today, yesterday] } } });
    await tx.inventoryTransaction.deleteMany({ where: { organizationId: org.id, reason: FIXTURE_NOTE } });
  });

  // 2. Stock in every department, with a cost, so gaps carry a KES value.
  let stocked = 0;
  for (const loc of locations) {
    if (!loc.departmentTag) continue;
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId: hub.id, deletedAt: null, departmentTags: { has: loc.departmentTag } },
      orderBy: { name: 'asc' },
    });
    let i = 0;
    for (const item of items) {
      const cost = item.currentCost.greaterThan(0) ? item.currentCost : D(80 + (i % 5) * 40);
      const quantity = D(6 + ((i * 7) % 15));
      await prisma.inventoryTransaction.create({
        data: {
          organizationId: org.id,
          locationId: loc.id,
          inventoryItemId: item.id,
          type: 'DISPATCH_IN',
          quantity,
          unitCost: cost,
          reason: FIXTURE_NOTE,
          userId: manager.id,
        },
      });
      i += 1;
      stocked += 1;
    }
  }

  // 3. Yesterday: closed 21:40 (Nairobi) by the manager — the "Yesterday · Closed" KPI card.
  const closedAt = new Date(yesterday.getTime() + 18 * 60 * 60 * 1000 + 40 * 60 * 1000); // 21:40 EAT = 18:40 UTC
  await prisma.$transaction(async (tx) => {
    const ref = await tx.referenceCounter.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: 'DAY' } },
      update: { lastNumber: { increment: 1 } },
      create: { organizationId: org.id, prefix: 'DAY', lastNumber: 1 },
      select: { lastNumber: true },
    });
    await tx.branchDay.create({
      data: {
        organizationId: org.id,
        businessDate: yesterday,
        status: 'CLOSED',
        reference: `DAY-${String(ref.lastNumber).padStart(4, '0')}`,
        closedById: manager.id,
        closedAt,
        departments: {
          create: locations.filter((l) => l.departmentTag).map((l) => ({ departmentTag: l.departmentTag!, locationId: l.id, status: 'COUNTED' as const })),
        },
      },
    });
  });

  // 3b. Dispatches: confirm the branch's in-transit ones, keep one blocking `block`.
  const inTransit = await prisma.dispatch.findMany({ where: { toOrganizationId: org.id, status: 'IN_TRANSIT' }, orderBy: { dispatchedAt: 'asc' } });
  await prisma.dispatch.updateMany({
    where: { id: { in: inTransit.map((d) => d.id) } },
    data: { status: 'CONFIRMED', confirmedById: manager.id, confirmedAt: new Date() },
  });
  if (block !== 'NONE' && inTransit[0]) {
    await prisma.dispatch.update({
      where: { id: inTransit[0].id },
      data: { status: 'IN_TRANSIT', confirmedById: null, confirmedAt: null, departmentTag: block as DepartmentTag },
    });
  }

  // 4. Today, in the requested state — through the real service so every rule runs.
  if (state !== 'none') {
    const actor = { id: manager.id, role: 'MANAGER' as const, organizationId: org.id, isDepartmentHead: false } as never;
    const dayView = await branchDayService.getToday(actor);
    if (state !== 'open') {
      let gapsWritten = 0;
      for (const tag of TAGS) {
        const detail = await branchDayService.getDepartment(actor, dayView.id, tag);
        if (detail.summary.status === 'BLOCKED') continue;
        const targets = state === 'counting' ? (tag === 'KITCHEN' ? detail.lines.slice(0, 5) : []) : detail.lines;
        const lines = targets.map((line, index) => {
          const expected = D(line.expectedQty);
          const cost = D(line.unitCost);
          // The first item of Kitchen and Barista carries a gap over the KES 1,000 threshold; one Pastry gap stays below it.
          let gap = D(0);
          if (index === 0 && (tag === 'KITCHEN' || tag === 'BARISTA') && cost.greaterThan(0)) gap = D(Math.min(expected.toNumber(), Math.ceil(1100 / cost.toNumber())));
          else if (index === 0 && tag === 'PASTRY') gap = D(1);
          const counted = Prisma.Decimal.max(expected.minus(gap), 0);
          const needsReason = gap.times(cost).greaterThanOrEqualTo(1000);
          if (needsReason) gapsWritten += 1;
          return {
            inventoryItemId: line.inventoryItemId,
            countedQty: counted.toString(),
            ...(needsReason ? { reason: (gapsWritten % 2 ? 'UNLOGGED_WASTE' : 'WALK_IN_COMP') as 'UNLOGGED_WASTE' | 'WALK_IN_COMP' } : {}),
          };
        });
        if (lines.length > 0) await branchDayService.saveLines(actor, dayView.id, tag, { lines });
      }
      if (state === 'closed') await branchDayService.close(actor, dayView.id, { pin: PIN });
    }
  }

  console.log(`Branch day fixtures ready — ${org.name}, state=${state}, block=${block}, ${stocked} stock rows. Manager: ${manager.email} (PIN ${PIN}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
