/**
 * seed-stock-waste-dev-fixtures.ts
 *
 * Local dev-only fixtures for Milestone Six Session 1 (stock position &
 * waste), so the live screens can be compared against the approved Paper
 * artboards in the same state (session-1-plan.md "Seed data for the gate"):
 *
 *   1. Names: store.manager → "Joseph Mwangi", store.attendant → "Sarah
 *      Achieng"; the Nyeri Town Kitchen head (from seed-dispatch-dev-fixtures)
 *      stays the department head.
 *   2. The seven hub items with the Paper values (Milk 128 L / restock 80 /
 *      cost 65 …, Tomatoes −4 kg), plus Croissants / Cream / Bread for the
 *      waste card and a Kitchen "Grilled chicken portion"; filler items until
 *      the hub catalog has 142 live items ("Page 1 of 18" at 8 per page).
 *   3. Waste over the last 7 days totalling KES 2,140 (Milk, Tomatoes,
 *      Croissants, Cream, Bread), each a real WasteLog + negative WASTE row.
 *   4. Coffee beans ledger: opening 12 → receive +25 (a real paid GRN from
 *      Samrat Suppliers Ltd) → dispatch −6 to Nyeri Town · Barista (a real
 *      Dispatch) → waste −2 → adjustment −17 → 12 kg. Dated 8–12 days ago so
 *      they don't change the 7-day waste total; view with "30 days".
 *   5. Nyeri Town Kitchen, Grilled chicken portion: dispatch in +14,
 *      adjustment −5 → 9 pcs at KES 145.
 *   6. So the hub's attention table shows the Paper rows: Central Store
 *      restock levels on items outside that set are cleared, and any of
 *      those items sitting negative at the Central Store is topped back up
 *      to zero with a RECEIVE.
 *
 * Idempotent: items/levels are upserted every run; the ledger history (3–5)
 * is written once, guarded by the fixture requisition note. Run after
 * seed-dev.ts, seed-inventory-catalog.ts and seed-dispatch-dev-fixtures.ts.
 *
 * ONLY runs when NODE_ENV is not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-stock-waste-dev-fixtures.ts
 */

import 'dotenv/config';
import { Prisma, type DepartmentTag, type InventoryItemType, type WasteReason } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { createSeedSupplier } from './seed-supplier-helper';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-stock-waste-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const FIXTURE_NOTE = 'M6 S1 dev fixture';
const TARGET_LIVE_ITEMS = 142;

type ItemSpec = {
  name: string;
  type: InventoryItemType;
  unit: string;
  category: string;
  cost: string;
  restock?: string;
  tags: DepartmentTag[];
};

const HUB_ITEMS: (ItemSpec & { target: string })[] = [
  { name: 'Milk', type: 'STOCKED', unit: 'L', category: 'Dairy', cost: '65', restock: '80', target: '128', tags: ['BARISTA', 'KITCHEN'] },
  { name: 'Cooking oil', type: 'STOCKED', unit: 'L', category: 'Dry goods', cost: '320', restock: '40', target: '46', tags: ['KITCHEN'] },
  { name: 'Coffee beans', type: 'STOCKED', unit: 'kg', category: 'Dry goods', cost: '1180', restock: '25', target: '12', tags: ['BARISTA'] },
  { name: 'Chicken stock', type: 'PREPPED', unit: 'L', category: 'Prepped', cost: '240', restock: '15', target: '18', tags: ['KITCHEN'] },
  { name: 'Rice', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Dry goods', cost: '145', restock: '120', target: '210', tags: [] },
  { name: 'Tomatoes', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Produce', cost: '90', restock: '30', target: '-4', tags: [] },
  { name: 'Flour', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Dry goods', cost: '78', restock: '50', target: '64', tags: [] },
  // Waste-card items — no restock level, so they stay out of the attention table.
  { name: 'Croissants', type: 'STOCKED', unit: 'pcs', category: 'Bakery', cost: '90', target: '20', tags: ['PASTRY'] },
  { name: 'Cream', type: 'STOCKED', unit: 'L', category: 'Dairy', cost: '180', target: '6', tags: ['BARISTA'] },
  { name: 'Bread', type: 'STOCKED', unit: 'pcs', category: 'Bakery', cost: '78.3333', target: '30', tags: ['KITCHEN'] },
];

const CHICKEN: ItemSpec = { name: 'Grilled chicken portion', type: 'PREPPED', unit: 'pcs', category: 'Prepped', cost: '145', tags: ['KITCHEN'] };

/** Waste over the last 7 days — KES 390 + 270 + 360 + 180 + 940 = 2,140. */
const WASTE: { item: string; qty: string; reason: WasteReason; daysAgo: number; note?: string }[] = [
  { item: 'Milk', qty: '6', reason: 'SPOILAGE', daysAgo: 1, note: 'Left out of the cold room overnight' },
  { item: 'Tomatoes', qty: '3', reason: 'SPOILAGE', daysAgo: 2 },
  { item: 'Croissants', qty: '4', reason: 'EXPIRY', daysAgo: 3 },
  { item: 'Cream', qty: '1', reason: 'DAMAGE_IN_STORE', daysAgo: 4 },
  { item: 'Bread', qty: '12', reason: 'PREP_ERROR', daysAgo: 5 },
];

const FILLER_BASES = [
  'Sugar', 'Salt', 'Black pepper', 'Paprika', 'Cinnamon', 'Oats', 'Honey', 'Strawberry jam', 'Peanut butter', 'Ketchup',
  'Mayonnaise', 'Mustard', 'Vinegar', 'Baking powder', 'Dry yeast', 'Cocoa powder', 'Vanilla essence', 'Penne pasta',
  'Spaghetti', 'Lentils', 'Kidney beans', 'Maize flour', 'Tea leaves', 'Drinking chocolate', 'Icing sugar',
];
const FILLER_PACKS = ['250 g', '500 g', '1 kg', '2 kg'];

const daysAgo = (n: number, hour = 9): Date => {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour - 3, 0, 0, 0); // hour in Africa/Nairobi (UTC+3)
  return d;
};

const run = async (): Promise<void> => {
  const hub = await prisma.site.findFirst({ where: { isHub: true } });
  const centralStore = await prisma.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  const storeManager = await prisma.user.findUnique({ where: { email: 'store.manager@wendo.test' } });
  const attendant = await prisma.user.findUnique({ where: { email: 'store.attendant@wendo.test' } });
  const town = await prisma.site.findFirst({ where: { name: 'Nyeri Town' } });
  if (!hub || !centralStore || !storeManager || !attendant || !town) {
    console.log('SKIP  hub / Central Store / store users / Nyeri Town missing — run seed-dev.ts first');
    return;
  }
  const kitchenHead = await prisma.user.findFirst({
    where: { siteId: town.id, isDepartmentHead: true, departmentTag: 'KITCHEN' },
  });
  const townKitchen = await prisma.location.findFirst({
    where: { siteId: town.id, type: 'BRANCH_DEPARTMENT', departmentTag: 'KITCHEN' },
  });
  const townBarista = await prisma.location.findFirst({
    where: { siteId: town.id, type: 'BRANCH_DEPARTMENT', departmentTag: 'BARISTA' },
  });
  if (!kitchenHead || !townKitchen || !townBarista) {
    console.log('SKIP  Nyeri Town Kitchen head / department locations missing — run seed-dispatch-dev-fixtures.ts + provision-branch-departments.ts first');
    return;
  }

  // --- 1. Names -----------------------------------------------------------------
  await prisma.user.update({ where: { id: storeManager.id }, data: { name: 'Joseph Mwangi' } });
  await prisma.user.update({ where: { id: attendant.id }, data: { name: 'Sarah Achieng' } });
  console.log('OK    store users renamed (Joseph Mwangi, Sarah Achieng)');

  // --- 2. Categories + items ------------------------------------------------------
  const categoryIds = new Map<string, string>();
  for (const name of ['Dairy', 'Dry goods', 'Produce', 'Bakery', 'Prepped']) {
    const existing = await prisma.category.findFirst({ where: { siteId: hub.id, name, deletedAt: null } });
    const category = existing ?? (await prisma.category.create({ data: { siteId: hub.id, name } }));
    categoryIds.set(name, category.id);
  }

  const upsertItem = async (spec: ItemSpec) => {
    const data = {
      type: spec.type,
      usageUnit: spec.unit,
      buyUnit: spec.unit,
      categoryId: categoryIds.get(spec.category) ?? null,
      currentCost: new Prisma.Decimal(spec.cost),
      departmentTags: spec.tags,
    };
    const existing = await prisma.inventoryItem.findFirst({ where: { siteId: hub.id, name: spec.name, deletedAt: null } });
    return existing
      ? prisma.inventoryItem.update({ where: { id: existing.id }, data })
      : prisma.inventoryItem.create({ data: { siteId: hub.id, name: spec.name, ...data } });
  };

  const itemIds = new Map<string, string>();
  for (const spec of [...HUB_ITEMS, CHICKEN]) {
    const item = await upsertItem(spec);
    itemIds.set(spec.name, item.id);
  }
  for (const spec of HUB_ITEMS) {
    if (!spec.restock) continue;
    await prisma.restockLevel.upsert({
      where: { locationId_inventoryItemId: { locationId: centralStore.id, inventoryItemId: itemIds.get(spec.name)! } },
      update: { level: new Prisma.Decimal(spec.restock), setById: storeManager.id },
      create: {
        siteId: hub.id,
        locationId: centralStore.id,
        inventoryItemId: itemIds.get(spec.name)!,
        level: new Prisma.Decimal(spec.restock),
        setById: storeManager.id,
      },
    });
  }

  let live = await prisma.inventoryItem.count({ where: { siteId: hub.id, deletedAt: null } });
  fill: for (const pack of FILLER_PACKS) {
    for (const base of FILLER_BASES) {
      if (live >= TARGET_LIVE_ITEMS) break fill;
      const name = `${base} ${pack}`;
      const exists = await prisma.inventoryItem.findFirst({ where: { siteId: hub.id, name } });
      if (exists) continue;
      await prisma.inventoryItem.create({
        data: {
          siteId: hub.id,
          name,
          type: 'RAW_INGREDIENT',
          usageUnit: 'pcs',
          buyUnit: 'pcs',
          categoryId: categoryIds.get('Dry goods') ?? null,
          currentCost: new Prisma.Decimal(40 + ((name.length * 37) % 460)),
          departmentTags: [],
        },
      });
      live += 1;
    }
  }
  console.log(`OK    catalog: ${live} live hub items`);

  // --- 6. Attention table = the Paper set --------------------------------------------
  const paperIds = HUB_ITEMS.map((s) => itemIds.get(s.name)!);
  const cleared = await prisma.restockLevel.deleteMany({
    where: { siteId: hub.id, locationId: centralStore.id, inventoryItemId: { notIn: paperIds } },
  });
  console.log(`OK    cleared ${cleared.count} Central Store restock levels outside the Paper set`);

  const negatives = await prisma.inventoryTransaction.groupBy({
    by: ['inventoryItemId'],
    where: { siteId: hub.id, locationId: centralStore.id, inventoryItemId: { notIn: [...itemIds.values()] } },
    _sum: { quantity: true },
  });
  for (const row of negatives) {
    const sum = row._sum.quantity ?? new Prisma.Decimal(0);
    if (sum.greaterThanOrEqualTo(0)) continue;
    await prisma.inventoryTransaction.create({
      data: {
        siteId: hub.id,
        locationId: centralStore.id,
        inventoryItemId: row.inventoryItemId,
        type: 'RECEIVE',
        quantity: sum.negated(),
        unitCost: new Prisma.Decimal(0),
        reason: `${FIXTURE_NOTE} — top-up to zero`,
        userId: storeManager.id,
      },
    });
  }

  // --- 3–5. Ledger history (once) -----------------------------------------------------
  const already = await prisma.requisition.findFirst({ where: { siteId: town.id, note: FIXTURE_NOTE } });
  if (already) {
    console.log('SKIP  ledger history already written (fixture requisition exists)');
    return;
  }

  await prisma.$transaction(async (tx) => {
    const tx_ = (data: Prisma.InventoryTransactionUncheckedCreateInput) => tx.inventoryTransaction.create({ data });
    const onHand = async (locationOrgId: string, locationId: string, itemId: string) =>
      (
        await tx.inventoryTransaction.aggregate({
          where: { siteId: locationOrgId, locationId, inventoryItemId: itemId },
          _sum: { quantity: true },
        })
      )._sum.quantity ?? new Prisma.Decimal(0);

    // Waste (3)
    const plannedWaste = new Map<string, Prisma.Decimal>();
    for (const w of WASTE) plannedWaste.set(w.item, (plannedWaste.get(w.item) ?? new Prisma.Decimal(0)).plus(w.qty));

    // Coffee beans' own history (4) moves −25+6+2+17 = 0 net after the opening balance.
    const coffeeId = itemIds.get('Coffee beans')!;

    // Opening balances so each item lands on its Paper figure.
    for (const spec of HUB_ITEMS) {
      const id = itemIds.get(spec.name)!;
      const current = await onHand(hub.id, centralStore.id, id);
      const planned = (plannedWaste.get(spec.name) ?? new Prisma.Decimal(0)).negated(); // coffee's history nets to 0
      const opening = new Prisma.Decimal(spec.target).minus(current).minus(planned);
      if (opening.isZero()) continue;
      if (opening.greaterThan(0)) {
        await tx_({
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: id, type: 'RECEIVE',
          quantity: opening, unitCost: new Prisma.Decimal(spec.cost), reason: `${FIXTURE_NOTE} — opening balance`,
          userId: storeManager.id, createdAt: daysAgo(20),
        });
      } else {
        // Tomatoes: receive, then a count correction below zero.
        await tx_({
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: id, type: 'RECEIVE',
          quantity: new Prisma.Decimal(10), unitCost: new Prisma.Decimal(spec.cost), reason: `${FIXTURE_NOTE} — opening balance`,
          userId: storeManager.id, createdAt: daysAgo(20),
        });
        await tx_({
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: id, type: 'ADJUSTMENT',
          quantity: opening.minus(10), unitCost: new Prisma.Decimal(spec.cost), reason: 'Count correction',
          userId: storeManager.id, createdAt: daysAgo(6),
        });
      }
    }

    for (const w of WASTE) {
      const spec = HUB_ITEMS.find((s) => s.name === w.item)!;
      const at = daysAgo(w.daysAgo, 8);
      const log = await tx.wasteLog.create({
        data: {
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: itemIds.get(w.item)!,
          quantity: new Prisma.Decimal(w.qty), reason: w.reason, note: w.note ?? null,
          unitCost: new Prisma.Decimal(spec.cost), loggedById: attendant.id, createdAt: at,
        },
      });
      await tx_({
        siteId: hub.id, locationId: centralStore.id, inventoryItemId: log.inventoryItemId, type: 'WASTE',
        quantity: log.quantity.negated(), unitCost: log.unitCost, reason: w.reason, wasteLogId: log.id,
        userId: attendant.id, createdAt: at,
      });
    }

    // (4) Coffee beans — a real GRN so the counterparty is the supplier.
    const supplier =
      (await tx.supplier.findFirst({ where: { siteId: hub.id, name: 'Samrat Suppliers Ltd', deletedAt: null } })) ??
      (await createSeedSupplier(tx, { siteId: hub.id, name: 'Samrat Suppliers Ltd', defaultPaymentTerms: 'PAY_NOW' }));
    const grnCounter = await tx.referenceCounter.upsert({
      where: { siteId_prefix: { siteId: hub.id, prefix: 'GRN' } },
      update: { lastNumber: { increment: 1 } },
      create: { siteId: hub.id, prefix: 'GRN', lastNumber: 1 },
    });
    const receivedAt = daysAgo(12);
    const grn = await tx.goodsReceipt.create({
      data: {
        siteId: hub.id, reference: `GRN-${String(grnCounter.lastNumber).padStart(4, '0')}`,
        supplierId: supplier.id, paymentTerms: 'PAY_NOW', status: 'RECEIVED_PAID', receiptTotal: new Prisma.Decimal(29500),
        locationId: centralStore.id, signedById: storeManager.id, signedAt: receivedAt, createdById: storeManager.id,
        createdAt: receivedAt,
        lines: {
          create: {
            inventoryItemId: coffeeId, quantityBuyUnit: new Prisma.Decimal(25), quantityUsageUnit: new Prisma.Decimal(25),
            unitPrice: new Prisma.Decimal(1180), lineTotal: new Prisma.Decimal(29500), lineOrder: 0,
          },
        },
      },
      include: { lines: true },
    });
    await tx_({
      siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, type: 'RECEIVE',
      quantity: new Prisma.Decimal(25), unitCost: new Prisma.Decimal(1180), goodsReceiptLineId: grn.lines[0]!.id,
      userId: storeManager.id, createdAt: receivedAt,
    });

    const requisition = await tx.requisition.create({
      data: {
        siteId: town.id, type: 'AD_HOC', note: FIXTURE_NOTE, status: 'APPROVED', openedById: kitchenHead.id,
        openedAt: daysAgo(12, 7), approvedAt: daysAgo(12, 8),
      },
    });
    const dispatchWithLine = async (
      departmentTag: DepartmentTag, label: string, itemId: string, qty: string, cost: string, at: Date,
      destination: string,
    ) => {
      const dispatch = await tx.dispatch.create({
        data: {
          siteId: hub.id, toSiteId: town.id, requisitionId: requisition.id, departmentTag,
          sequenceLabel: label, status: 'CONFIRMED', dispatchedById: storeManager.id, dispatchedAt: at,
          confirmedById: kitchenHead.id, confirmedAt: at,
          lines: {
            create: {
              inventoryItemId: itemId, requestedQty: new Prisma.Decimal(qty), dispatchedQty: new Prisma.Decimal(qty),
              confirmedQty: new Prisma.Decimal(qty), costAtDispatch: new Prisma.Decimal(cost),
            },
          },
        },
        include: { lines: true },
      });
      const lineId = dispatch.lines[0]!.id;
      await tx_({
        siteId: hub.id, locationId: centralStore.id, inventoryItemId: itemId, type: 'DISPATCH_OUT',
        quantity: new Prisma.Decimal(qty).negated(), unitCost: new Prisma.Decimal(cost), dispatchLineId: lineId,
        userId: storeManager.id, createdAt: at,
      });
      await tx_({
        siteId: town.id, locationId: destination, inventoryItemId: itemId, type: 'DISPATCH_IN',
        quantity: new Prisma.Decimal(qty), unitCost: new Prisma.Decimal(cost), dispatchLineId: lineId,
        userId: kitchenHead.id, createdAt: at,
      });
    };

    await dispatchWithLine('BARISTA', 'Dispatch 1 · Nyeri Town · fixture', coffeeId, '6', '1180', daysAgo(11), townBarista.id);

    const coffeeWaste = await tx.wasteLog.create({
      data: {
        siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, quantity: new Prisma.Decimal(2),
        reason: 'SPOILAGE', unitCost: new Prisma.Decimal(1180), loggedById: attendant.id, createdAt: daysAgo(10),
      },
    });
    await tx_({
      siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, type: 'WASTE',
      quantity: new Prisma.Decimal(-2), unitCost: new Prisma.Decimal(1180), reason: 'SPOILAGE', wasteLogId: coffeeWaste.id,
      userId: attendant.id, createdAt: daysAgo(10),
    });
    await tx_({
      siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, type: 'ADJUSTMENT',
      quantity: new Prisma.Decimal(-17), unitCost: new Prisma.Decimal(1180), reason: 'Daily count · verified by J. Mwangi',
      userId: storeManager.id, createdAt: daysAgo(8),
    });

    // (5) Nyeri Town Kitchen — Grilled chicken portion: in +14, count −5 → 9 pcs.
    const chickenId = itemIds.get(CHICKEN.name)!;
    await tx_({
      siteId: hub.id, locationId: centralStore.id, inventoryItemId: chickenId, type: 'RECEIVE',
      quantity: new Prisma.Decimal(14), unitCost: new Prisma.Decimal(145), reason: `${FIXTURE_NOTE} — opening balance`,
      userId: storeManager.id, createdAt: daysAgo(3),
    });
    await dispatchWithLine('KITCHEN', 'Dispatch 2 · Nyeri Town · fixture', chickenId, '14', '145', daysAgo(2), townKitchen.id);
    await tx_({
      siteId: town.id, locationId: townKitchen.id, inventoryItemId: chickenId, type: 'ADJUSTMENT',
      quantity: new Prisma.Decimal(-5), unitCost: new Prisma.Decimal(145), reason: 'End-of-day count',
      userId: kitchenHead.id, createdAt: daysAgo(1, 22),
    });
  }, { timeout: 60_000 });

  console.log('OK    ledger history written (waste ×5 = KES 2,140; coffee beans; Nyeri Town Kitchen chicken)');
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
