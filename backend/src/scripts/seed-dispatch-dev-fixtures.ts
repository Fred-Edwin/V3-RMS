/**
 * seed-dispatch-dev-fixtures.ts
 *
 * Local dev-only fixtures Milestone Five Session B needs that no existing
 * seed script covers:
 *   1. PIN 1234 for store.manager@wendo.test (Session A's dev credential,
 *      re-set here since the DB was reset).
 *   2. Department-head flag + PIN 1234 on one CHEF per branch (Kitchen head)
 *      — the sign+PIN gate for confirm/confirm-on-behalf/resolve needs a
 *      real pinHash to compare against.
 *   3. PIN 1234 for each branch's MANAGER (confirm-on-behalf, Flow 10b).
 *   4. A RECEIVE transaction per catalog item at the Central Store so C1/C2's
 *      "ON HAND" column and the dispatch fulfil pre-fill have real stock to
 *      work with (seed-inventory-catalog.ts sets restock levels/pars but
 *      writes no ledger rows).
 *
 * Idempotent: PIN/department-head sets are unconditional (safe to re-run,
 * same target state each time); the RECEIVE write only happens if the item
 * has no existing on-hand stock at the Central Store yet.
 *
 * ONLY runs when NODE_ENV is not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-dispatch-dev-fixtures.ts
 */

import 'dotenv/config';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashPin } from '../utils/password';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-dispatch-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const DEV_PIN = '1234';

const run = async (): Promise<void> => {
  const pinHash = await hashPin(DEV_PIN);

  // --- 1. Store Manager PIN ---
  const storeManager = await prisma.user.findUnique({ where: { email: 'store.manager@wendo.test' } });
  if (storeManager) {
    await prisma.user.update({ where: { id: storeManager.id }, data: { pinHash } });
    console.log(`OK    PIN set for ${storeManager.email}`);
  } else {
    console.log('SKIP  store.manager@wendo.test not found — run seed-dev.ts first');
  }

  // --- 2/3. Per-branch Kitchen head + Manager PINs ---
  const branches = await prisma.organization.findMany({ where: { isHub: false, isActive: true } });
  for (const branch of branches) {
    const kitchenChef = await prisma.user.findFirst({
      where: { organizationId: branch.id, role: 'CHEF' },
      orderBy: { email: 'asc' },
    });
    if (kitchenChef) {
      await prisma.user.update({
        where: { id: kitchenChef.id },
        data: { isDepartmentHead: true, departmentTag: 'KITCHEN', pinHash },
      });
      console.log(`OK    ${kitchenChef.email} — Kitchen department head, PIN set (${branch.name})`);
    } else {
      console.log(`SKIP  no CHEF found for ${branch.name}`);
    }

    const manager = await prisma.user.findFirst({ where: { organizationId: branch.id, role: 'MANAGER' } });
    if (manager) {
      await prisma.user.update({ where: { id: manager.id }, data: { pinHash } });
      console.log(`OK    ${manager.email} — PIN set (${branch.name})`);
    } else {
      console.log(`SKIP  no MANAGER found for ${branch.name}`);
    }
  }

  // --- 4. Central Store initial stock (RECEIVE transactions) ---
  const centralStore = await prisma.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  if (!centralStore) {
    console.log('SKIP  No Central Store location found — run seed-dev.ts first');
  } else if (!storeManager) {
    console.log('SKIP  No store manager found to attribute RECEIVE transactions to');
  } else {
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId: centralStore.organizationId, deletedAt: null },
      select: { id: true, name: true, currentCost: true },
    });

    let received = 0;
    let skipped = 0;
    for (const item of items) {
      const existing = await prisma.inventoryTransaction.findFirst({
        where: { locationId: centralStore.id, inventoryItemId: item.id },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await prisma.inventoryTransaction.create({
        data: {
          organizationId: centralStore.organizationId,
          locationId: centralStore.id,
          inventoryItemId: item.id,
          type: 'RECEIVE',
          quantity: '50',
          unitCost: item.currentCost,
          userId: storeManager.id,
        },
      });
      received++;
    }
    console.log(`OK    Central Store stock: ${received} item(s) received (qty 50 each), ${skipped} already had stock`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
