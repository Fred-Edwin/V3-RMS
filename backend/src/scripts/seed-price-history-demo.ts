/**
 * seed-price-history-demo.ts
 *
 * SYNTHETIC, dev-only demo data — NOT real client history. Adds a few extra
 * dated RECEIVE ledger entries (via `inventoryTransactionService.recordReceive`,
 * the same path `seed-inventory-demo.ts` uses for its real Samrat/Summer
 * data) to a handful of existing items, purely so Price History sparklines
 * have enough points (3+) to draw a real trend shape for screenshots/demo
 * walkthroughs. `seed-inventory-demo.ts`'s own data is transcribed from real
 * client invoices and deliberately NOT touched or extended here — this is a
 * separate script so the two are never confused or accidentally merged.
 *
 * Backdates entries a few days apart (not "now") so they show as a real
 * timeline, not a burst of same-instant receipts. Idempotent per item: skips
 * an item if it already has 3+ RECEIVE transactions, so re-running is safe
 * and won't keep inflating history on every run.
 *
 * ONLY runs when NODE_ENV is not "production" — this is fabricated data and
 * must never touch a real deployment.
 *
 * Usage:
 *   npx tsx src/scripts/seed-price-history-demo.ts
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { inventoryTransactionService } from '../services/inventory-transaction-service';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-price-history-demo must not run in production. Exiting.');
  process.exit(1);
}

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/**
 * A gentle synthetic price walk per item — plausible small fluctuations, not
 * a real invoice. `daysAgo` values are spread out so the sparkline shows an
 * actual shape instead of a same-day cluster. Buy-unit prices (matches the
 * unit `recordReceive`'s `unitPrice` param expects).
 */
const DEMO_PRICE_WALKS: Record<string, { daysAgo: number; buyQty: string; unitPrice: string }[]> = {
  'Fresh Milk': [
    { daysAgo: 45, buyQty: '25', unitPrice: '72' },
    { daysAgo: 30, buyQty: '28', unitPrice: '74' },
    { daysAgo: 15, buyQty: '30', unitPrice: '75' },
  ],
  'Chicken Breast': [
    { daysAgo: 40, buyQty: '18', unitPrice: '460' },
    { daysAgo: 25, buyQty: '20', unitPrice: '475' },
    { daysAgo: 10, buyQty: '20', unitPrice: '480' },
  ],
  'Fresh Eggs (Tray of 30)': [
    { daysAgo: 35, buyQty: '3', unitPrice: '420' },
    { daysAgo: 20, buyQty: '4', unitPrice: '440' },
    { daysAgo: 5, buyQty: '4', unitPrice: '450' },
  ],
  'Kabras Sugar': [
    { daysAgo: 38, buyQty: '40', unitPrice: '148' },
    { daysAgo: 24, buyQty: '45', unitPrice: '152' },
  ],
};

const run = async (): Promise<void> => {
  const storeManager = await prisma.user.findFirst({
    where: { role: 'STORE_MANAGER', organizationId: { not: null } },
    select: { id: true, organizationId: true },
  });
  if (!storeManager || !storeManager.organizationId) {
    throw new Error('No STORE_MANAGER user with an organizationId found. Run seed-dev.ts first.');
  }
  const organizationId = storeManager.organizationId;

  const location = await prisma.location.findFirst({ where: { organizationId, type: 'CENTRAL_STORE' } });
  if (!location) {
    throw new Error('No CENTRAL_STORE location found. Run seed-dev.ts first.');
  }

  console.log(`Seeding SYNTHETIC price-history demo data for org ${organizationId} — not real client data\n`);

  for (const [itemName, walk] of Object.entries(DEMO_PRICE_WALKS)) {
    const item = await prisma.inventoryItem.findFirst({ where: { organizationId, name: itemName } });
    if (!item) {
      console.log(`SKIP  ${itemName} — item not found (run seed-inventory-demo.ts first)`);
      continue;
    }

    const receiveCount = await prisma.inventoryTransaction.count({
      where: { organizationId, inventoryItemId: item.id, type: 'RECEIVE' },
    });
    if (receiveCount >= 3) {
      console.log(`SKIP  ${itemName} — already has ${receiveCount} receive events`);
      continue;
    }

    for (const event of walk) {
      const tx = await inventoryTransactionService.recordReceive({
        organizationId,
        locationId: location.id,
        userId: storeManager.id,
        inventoryItemId: item.id,
        buyQty: d(event.buyQty),
        unitPrice: d(event.unitPrice),
      });
      // Backdate createdAt directly — recordReceive always stamps "now",
      // and there's no public API for a dated receive, so this is the one
      // place a raw update is warranted (dev-only script, not production code).
      await prisma.inventoryTransaction.update({
        where: { id: tx.id },
        data: { createdAt: new Date(Date.now() - event.daysAgo * 24 * 60 * 60 * 1000) },
      });
    }
    console.log(`OK    ${itemName} — added ${walk.length} synthetic dated price points`);
  }

  console.log('\nDone.');
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
