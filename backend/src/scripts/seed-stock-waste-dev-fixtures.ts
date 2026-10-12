/**
 * seed-stock-waste-dev-fixtures.ts
 *
 * Local dev-only fixtures for the Stock and Waste rebuild (Overview, All items, Stock ledger, Stock card, Waste), so the live
 * screens can be walked in a state close to the approved Paper artboards. Additive: it never clears restock levels or touches
 * other seeds' rows.
 *
 *   1. Hub items with the Paper values (Milk 128 L / restock 80, Tomatoes -4 kg, Coffee beans 12 kg / restock 25 ...) and their
 *      Central Store restock levels.
 *   2. A ledger across the last 30 days: an opening balance per item 29 days ago, receipts (Coffee beans through a real order
 *      and GRN), a dispatch (a real Dispatch), Prep produce and consume, count adjustments numbered ADJ-nnnn, and waste.
 *   3. Waste in batches (WasteBatch + WasteLog + a negative WASTE ledger row each): two entries by the Attendant today (so the
 *      banner and the same-day reverse can be tried), older ones by the Attendant and the Manager, one entry the Attendant
 *      reversed the same day it was logged, and one the Manager reversed days later. A reversal is a positive WASTE ledger row
 *      pointing at the original with `reverses_transaction_id`.
 *   4. One negative item (Tomatoes).
 *
 * Idempotent: items and levels are upserted every run; the history is written once, guarded by the waste batch key
 * `dev-fixture-stock-waste-today`. Run after seed-dev.ts, seed-inventory-catalog.ts and seed-dispatch-dev-fixtures.ts.
 * Seed scripts write the ledger directly (the guard test does not check src/scripts); the app never does.
 *
 * ONLY runs when NODE_ENV is not "production".
 *
 * Usage:
 *   npx tsx src/scripts/seed-stock-waste-dev-fixtures.ts
 */

import 'dotenv/config';
import { Prisma, type InventoryItemType, type InventoryTransactionType, type WasteReason, type WasteReversalReason } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { referenceCounterRepository } from '../modules/inventory/_shared/reference-counter';
import { createSeedSupplier } from './seed-supplier-helper';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-stock-waste-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const FIXTURE_NOTE = 'Stock and waste dev fixture';
const TODAY_KEY = 'dev-fixture-stock-waste-today';

type ItemSpec = { name: string; type: InventoryItemType; unit: string; category: string; cost: string; restock?: string; target: string };

const HUB_ITEMS: ItemSpec[] = [
  { name: 'Milk', type: 'STOCKED', unit: 'L', category: 'Dairy', cost: '65', restock: '80', target: '128' },
  { name: 'Cooking oil', type: 'STOCKED', unit: 'L', category: 'Dry goods', cost: '320', restock: '40', target: '46' },
  { name: 'Coffee beans', type: 'STOCKED', unit: 'kg', category: 'Dry goods', cost: '1180', restock: '25', target: '12' },
  { name: 'Chicken stock', type: 'PREPPED', unit: 'L', category: 'Prepped', cost: '240', restock: '15', target: '18' },
  { name: 'Rice', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Dry goods', cost: '145', restock: '120', target: '210' },
  { name: 'Tomatoes', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Produce', cost: '90', restock: '30', target: '-4' },
  { name: 'Flour', type: 'RAW_INGREDIENT', unit: 'kg', category: 'Dry goods', cost: '78', restock: '50', target: '64' },
  { name: 'Croissants', type: 'STOCKED', unit: 'pcs', category: 'Bakery', cost: '90', target: '20' },
  { name: 'Cream', type: 'STOCKED', unit: 'L', category: 'Dairy', cost: '180', target: '6' },
  { name: 'Bread', type: 'STOCKED', unit: 'pcs', category: 'Bakery', cost: '78.3333', target: '30' },
];

/** A moment `n` days ago at `hour` Nairobi time (UTC+3). */
const daysAgo = (n: number, hour = 9): Date => {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour - 3, 0, 0, 0);
  return d;
};

type Move = { item: string; type: InventoryTransactionType; qty: string; at: Date; reason?: string };

const run = async (): Promise<void> => {
  const hub = await prisma.site.findFirst({ where: { isHub: true } });
  const centralStore = await prisma.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  const manager = await prisma.user.findUnique({ where: { email: 'store.manager@wendo.test' } });
  const attendant = await prisma.user.findUnique({ where: { email: 'store.attendant@wendo.test' } });
  const town = await prisma.site.findFirst({ where: { name: 'Nyeri Town' } });
  if (!hub || !centralStore || !manager || !attendant || !town) {
    console.log('SKIP  hub / Central Store / store users / Nyeri Town missing: run seed-dev.ts first');
    return;
  }
  const kitchenHead = await prisma.user.findFirst({ where: { siteId: town.id, isDepartmentHead: true, departmentTag: 'KITCHEN' } });
  const townBarista = await prisma.location.findFirst({ where: { siteId: town.id, type: 'BRANCH_DEPARTMENT', departmentTag: 'BARISTA' } });
  if (!kitchenHead || !townBarista) {
    console.log('SKIP  Nyeri Town department head / Barista location missing: run seed-dispatch-dev-fixtures.ts first');
    return;
  }

  // --- 1. Items and levels (every run) ----------------------------------------------
  const categoryIds = new Map<string, string>();
  for (const name of ['Dairy', 'Dry goods', 'Produce', 'Bakery', 'Prepped']) {
    const existing = await prisma.category.findFirst({ where: { siteId: hub.id, name, deletedAt: null } });
    categoryIds.set(name, (existing ?? (await prisma.category.create({ data: { siteId: hub.id, name } }))).id);
  }
  const itemIds = new Map<string, string>();
  for (const spec of HUB_ITEMS) {
    const data = {
      type: spec.type,
      usageUnit: spec.unit,
      buyUnit: spec.unit,
      categoryId: categoryIds.get(spec.category) ?? null,
      currentCost: new Prisma.Decimal(spec.cost),
      // A raw ingredient never carries a department tag (database check); other types keep the tags they have.
      ...(spec.type === 'RAW_INGREDIENT' ? { departmentTags: [] } : {}),
    };
    const existing = await prisma.inventoryItem.findFirst({ where: { siteId: hub.id, name: spec.name, deletedAt: null } });
    const item = existing
      ? await prisma.inventoryItem.update({ where: { id: existing.id }, data })
      : await prisma.inventoryItem.create({ data: { siteId: hub.id, name: spec.name, departmentTags: [], ...data } });
    itemIds.set(spec.name, item.id);
    if (spec.restock) {
      await prisma.restockLevel.upsert({
        where: { locationId_inventoryItemId: { locationId: centralStore.id, inventoryItemId: item.id } },
        update: { level: new Prisma.Decimal(spec.restock), setById: manager.id },
        create: { siteId: hub.id, locationId: centralStore.id, inventoryItemId: item.id, level: new Prisma.Decimal(spec.restock), setById: manager.id },
      });
    }
  }
  console.log(`OK    ${HUB_ITEMS.length} hub items and their restock levels`);

  const done = await prisma.wasteBatch.findFirst({ where: { siteId: hub.id, idempotencyKey: TODAY_KEY } });
  if (done) {
    console.log('SKIP  ledger and waste history already written (fixture waste batch exists)');
    return;
  }

  // --- 2 to 4. The history, once --------------------------------------------------------
  await prisma.$transaction(
    async (tx) => {
      const id = (name: string): string => itemIds.get(name)!;
      const cost = (name: string): Prisma.Decimal => new Prisma.Decimal(HUB_ITEMS.find((s) => s.name === name)!.cost);
      const post = (data: Prisma.InventoryTransactionUncheckedCreateInput) => tx.inventoryTransaction.create({ data });
      const onHand = async (itemId: string): Promise<Prisma.Decimal> =>
        (await tx.inventoryTransaction.aggregate({ where: { siteId: hub.id, locationId: centralStore.id, inventoryItemId: itemId }, _sum: { quantity: true } }))._sum.quantity ??
        new Prisma.Decimal(0);

      // Movements that are not waste: receipts, Prep, count adjustments. Each lands in the ledger as written below.
      const moves: Move[] = [
        { item: 'Milk', type: 'RECEIVE', qty: '60', at: daysAgo(14), reason: `${FIXTURE_NOTE}: delivery` },
        { item: 'Milk', type: 'ADJUSTMENT', qty: '-4', at: daysAgo(5), reason: 'Count correction' },
        { item: 'Rice', type: 'RECEIVE', qty: '100', at: daysAgo(18), reason: `${FIXTURE_NOTE}: delivery` },
        { item: 'Rice', type: 'PREP_CONSUME', qty: '-15', at: daysAgo(7), reason: 'Prep: Chicken stock' },
        { item: 'Flour', type: 'RECEIVE', qty: '40', at: daysAgo(10), reason: `${FIXTURE_NOTE}: delivery` },
        { item: 'Flour', type: 'ADJUSTMENT', qty: '2', at: daysAgo(3), reason: 'Count correction' },
        { item: 'Chicken stock', type: 'PREP_PRODUCE', qty: '12', at: daysAgo(7), reason: 'Prep: Chicken stock' },
        { item: 'Tomatoes', type: 'RECEIVE', qty: '20', at: daysAgo(12), reason: `${FIXTURE_NOTE}: delivery` },
        { item: 'Tomatoes', type: 'ADJUSTMENT', qty: '-12', at: daysAgo(6), reason: 'Count correction' },
        { item: 'Cooking oil', type: 'ADJUSTMENT', qty: '-3', at: daysAgo(4), reason: 'Count correction' },
      ];

      // Waste, in batches: [batch key, who, when, entries[], reversal?].
      type WasteEntrySpec = { item: string; qty: string; reason: WasteReason; note?: string; reverse?: { by: 'attendant' | 'manager'; at: Date; reason: WasteReversalReason; note?: string } };
      const batches: { key: string; by: 'attendant' | 'manager'; at: Date; entries: WasteEntrySpec[] }[] = [
        {
          key: TODAY_KEY,
          by: 'attendant',
          at: daysAgo(0, 8),
          entries: [
            { item: 'Milk', qty: '6', reason: 'SPOILAGE', note: 'Left out of the cold room overnight' },
            { item: 'Croissants', qty: '4', reason: 'EXPIRY', note: 'Left out of the cold room overnight' },
          ],
        },
        { key: 'dev-fixture-stock-waste-manager', by: 'manager', at: daysAgo(1, 15), entries: [{ item: 'Cream', qty: '1', reason: 'DAMAGE_IN_STORE' }] },
        {
          key: 'dev-fixture-stock-waste-reversed-same-day',
          by: 'attendant',
          at: daysAgo(3, 10),
          entries: [{ item: 'Bread', qty: '12', reason: 'PREP_ERROR', reverse: { by: 'attendant', at: daysAgo(3, 10), reason: 'WRONG_QUANTITY' } }],
        },
        {
          key: 'dev-fixture-stock-waste-reversed-later',
          by: 'attendant',
          at: daysAgo(6, 11),
          entries: [{ item: 'Tomatoes', qty: '3', reason: 'SPOILAGE', reverse: { by: 'manager', at: daysAgo(4, 9), reason: 'OTHER', note: 'Logged against the wrong delivery' } }],
        },
        { key: 'dev-fixture-stock-waste-older', by: 'manager', at: daysAgo(9, 14), entries: [{ item: 'Coffee beans', qty: '2', reason: 'SPOILAGE' }] },
      ];

      // Opening balance 29 days ago so each item lands on its Paper figure after everything planned.
      const planned = new Map<string, Prisma.Decimal>();
      const add = (name: string, delta: Prisma.Decimal.Value) => planned.set(name, (planned.get(name) ?? new Prisma.Decimal(0)).plus(delta));
      for (const m of moves) add(m.item, m.qty);
      for (const b of batches) {
        for (const e of b.entries) if (!e.reverse) add(e.item, new Prisma.Decimal(e.qty).negated());
      }
      add('Coffee beans', 25 - 6); // the real GRN (+25) and the dispatch (-6) below
      for (const spec of HUB_ITEMS) {
        const opening = new Prisma.Decimal(spec.target).minus(await onHand(id(spec.name))).minus(planned.get(spec.name) ?? 0);
        if (opening.isZero()) continue;
        const type = opening.greaterThan(0) ? 'RECEIVE' : 'ADJUSTMENT';
        const reference = type === 'ADJUSTMENT' ? await referenceCounterRepository.nextReference(tx, hub.id, 'ADJ') : null;
        await post({
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: id(spec.name), type, quantity: opening, unitCost: cost(spec.name),
          reason: `${FIXTURE_NOTE}: opening balance`, reference, userId: manager.id, createdAt: daysAgo(29),
        });
      }

      for (const m of moves) {
        await post({
          siteId: hub.id, locationId: centralStore.id, inventoryItemId: id(m.item), type: m.type, quantity: new Prisma.Decimal(m.qty), unitCost: cost(m.item),
          reason: m.reason ?? null, reference: m.type === 'ADJUSTMENT' ? await referenceCounterRepository.nextReference(tx, hub.id, 'ADJ') : null,
          userId: manager.id, createdAt: m.at,
        });
      }

      // Coffee beans: a real order and GRN, then a real dispatch to Nyeri Town Barista.
      const coffeeId = id('Coffee beans');
      const supplier =
        (await tx.supplier.findFirst({ where: { siteId: hub.id, name: 'Samrat Suppliers Ltd', deletedAt: null } })) ??
        (await createSeedSupplier(tx, { siteId: hub.id, name: 'Samrat Suppliers Ltd', defaultPaymentTerms: 'PAY_NOW' }));
      const receivedAt = daysAgo(12);
      const order = await tx.purchaseOrder.create({
        data: {
          siteId: hub.id, reference: await referenceCounterRepository.nextReference(tx, hub.id, 'LPO'), supplierId: supplier.id, status: 'DELIVERED',
          raisedById: manager.id, approvedById: manager.id, approvedAt: receivedAt, sentAt: receivedAt, sentVia: 'MANUAL', sentById: manager.id, createdAt: receivedAt,
          lines: {
            create: {
              inventoryItemId: coffeeId, lineOrder: 0, buyUnit: 'kg', packSize: new Prisma.Decimal(1), orderedQty: new Prisma.Decimal(25),
              unitPrice: new Prisma.Decimal(1180), receivedQty: new Prisma.Decimal(25), confirmedPrice: new Prisma.Decimal(1180), result: 'AS_ORDERED',
            },
          },
        },
        include: { lines: true },
      });
      const delivery = await tx.purchaseDelivery.create({
        data: {
          siteId: hub.id, orderId: order.id, reference: await referenceCounterRepository.nextReference(tx, hub.id, 'GRN'), locationId: centralStore.id,
          deliveryNoteNo: 'DN-DEV-0001', receivedById: manager.id, receivedAt, deliveredTotal: new Prisma.Decimal(29500), notSuppliedTotal: new Prisma.Decimal(0),
          lines: {
            create: {
              orderLineId: order.lines[0]!.id, inventoryItemId: coffeeId, quantityBuyUnit: new Prisma.Decimal(25), quantityUsageUnit: new Prisma.Decimal(25),
              unitPrice: new Prisma.Decimal(1180), lineOrder: 0,
            },
          },
        },
        include: { lines: true },
      });
      await post({
        siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, type: 'RECEIVE', quantity: new Prisma.Decimal(25), unitCost: new Prisma.Decimal(1180),
        purchaseDeliveryLineId: delivery.lines[0]!.id, userId: manager.id, createdAt: receivedAt,
      });

      const requisition = await tx.requisition.create({
        data: { siteId: town.id, type: 'EXTRA', reference: `REQ-FIX-${Date.now().toString().slice(-6)}`, note: FIXTURE_NOTE, status: 'APPROVED', openedById: kitchenHead.id, openedAt: daysAgo(11, 7), approvedAt: daysAgo(11, 8) },
      });
      const dispatchAt = daysAgo(11);
      const baristaDepartment = await tx.department.findFirstOrThrow({ where: { siteId: town.id, key: 'BARISTA' }, select: { id: true } });
      const dispatch = await tx.dispatch.create({
        data: {
          siteId: hub.id, toSiteId: town.id, requisitionId: requisition.id, departmentId: baristaDepartment.id, reference: `DSP-FIX-${Date.now().toString().slice(-6)}`,
          status: 'CONFIRMED', packedById: manager.id, packedAt: dispatchAt, signedById: manager.id, signedAt: dispatchAt, countedById: kitchenHead.id, countedAt: dispatchAt,
          lines: {
            create: {
              inventoryItemId: coffeeId, requestedQty: new Prisma.Decimal(6), sentQty: new Prisma.Decimal(6), countedQty: new Prisma.Decimal(6), packedTick: true,
              unitCostAtDispatch: new Prisma.Decimal(1180),
            },
          },
        },
        include: { lines: true },
      });
      await post({
        siteId: hub.id, locationId: centralStore.id, inventoryItemId: coffeeId, type: 'DISPATCH_OUT', quantity: new Prisma.Decimal(-6), unitCost: new Prisma.Decimal(1180),
        dispatchLineId: dispatch.lines[0]!.id, userId: manager.id, createdAt: dispatchAt,
      });
      await post({
        siteId: town.id, locationId: townBarista.id, inventoryItemId: coffeeId, type: 'DISPATCH_IN', quantity: new Prisma.Decimal(6), unitCost: new Prisma.Decimal(1180),
        dispatchLineId: dispatch.lines[0]!.id, userId: kitchenHead.id, createdAt: dispatchAt,
      });

      // Waste: the batch, each log, its negative ledger row, and a reversing row where the entry was reversed.
      let entries = 0;
      for (const b of batches) {
        const who = b.by === 'attendant' ? attendant : manager;
        const batch = await tx.wasteBatch.create({ data: { siteId: hub.id, userId: who.id, idempotencyKey: b.key, createdAt: b.at } });
        for (const e of b.entries) {
          const unitCost = cost(e.item);
          const log = await tx.wasteLog.create({
            data: {
              siteId: hub.id, locationId: centralStore.id, inventoryItemId: id(e.item), quantity: new Prisma.Decimal(e.qty), reason: e.reason, note: e.note ?? null,
              unitCost, loggedById: who.id, batchId: batch.id, createdAt: b.at,
              ...(e.reverse
                ? {
                    reversedAt: e.reverse.at,
                    reversedById: (e.reverse.by === 'attendant' ? attendant : manager).id,
                    reversalReason: e.reverse.reason,
                    reversalNote: e.reverse.note ?? null,
                  }
                : {}),
            },
          });
          const original = await post({
            siteId: hub.id, locationId: centralStore.id, inventoryItemId: log.inventoryItemId, type: 'WASTE', quantity: log.quantity.negated(), unitCost,
            reason: e.reason, wasteLogId: log.id, userId: who.id, createdAt: b.at,
          });
          if (e.reverse) {
            await post({
              siteId: hub.id, locationId: centralStore.id, inventoryItemId: log.inventoryItemId, type: 'WASTE', quantity: log.quantity, unitCost,
              reason: `Reversed: ${e.reverse.reason}`, wasteLogId: log.id, reversesTransactionId: original.id,
              userId: (e.reverse.by === 'attendant' ? attendant : manager).id, createdAt: e.reverse.at,
            });
          }
          entries += 1;
        }
      }
      console.log(`OK    ledger history written: ${moves.length + 4} movements, ${entries} waste entries in ${batches.length} batches`);
    },
    { timeout: 60_000 },
  );
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
