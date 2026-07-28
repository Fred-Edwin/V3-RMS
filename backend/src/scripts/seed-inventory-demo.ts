/**
 * seed-inventory-demo.ts
 *
 * Demo data for Session 6's Attendant screens (Stock on Hand, Purchase
 * Orders) — realistic Wendo Central Store catalog items, a couple of
 * suppliers, receiving history (so on-hand qty/currentCost are real,
 * ledger-derived numbers, including at least one low-stock item), and
 * purchase orders across a few statuses (DRAFT/SENT/PARTIALLY_RECEIVED/
 * CLOSED) so the PO list isn't empty.
 *
 * ONLY runs when NODE_ENV is not "production". Safe to re-run — idempotent
 * on items/suppliers (upsert by name), always adds a fresh batch of POs so
 * you can see the list grow if run more than once.
 *
 * Usage:
 *   npx tsx src/scripts/seed-inventory-demo.ts
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { inventoryTransactionService } from '../services/inventory-transaction-service';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-inventory-demo must not run in production. Exiting.');
  process.exit(1);
}

type ItemSpec = {
  name: string;
  type: 'RAW' | 'PREPPED' | 'PASS_THROUGH';
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: ('KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING')[];
  /** How much to receive in this seed run, in buy units, and at what buy-unit price. */
  receiveQty: string;
  receivePrice: string;
  /** If true, the receive qty is deliberately small relative to reorderLevel (low stock). */
};

const ITEMS: ItemSpec[] = [
  { name: 'Arabica Coffee Beans', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '15', departmentTags: ['BARISTA'], receiveQty: '48.7', receivePrice: '1240' },
  { name: 'Fresh Milk', type: 'RAW', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '20', departmentTags: ['BARISTA'], receiveQty: '18', receivePrice: '210' },
  { name: 'Vanilla Syrup', type: 'PREPPED', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '5', departmentTags: ['BARISTA'], receiveQty: '1.2', receivePrice: '680' },
  { name: 'Greek Yogurt', type: 'PREPPED', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '6', departmentTags: ['KITCHEN', 'PASTRY'], receiveQty: '4.3', receivePrice: '350' },
  { name: 'Disposable Cups 12oz', type: 'PASS_THROUGH', buyUnit: 'pack', usageUnit: 'pcs', conversionFactor: '50', reorderLevel: '300', receiveQty: '5', receivePrice: '700', departmentTags: ['BARISTA', 'SERVICE'] },
  { name: 'Brown Sugar', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '8', departmentTags: ['KITCHEN', 'BARISTA'], receiveQty: '12.6', receivePrice: '180' },
  { name: 'Chicken Breast', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '10', departmentTags: ['KITCHEN'], receiveQty: '22', receivePrice: '480' },
  { name: 'Flour', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '20', departmentTags: ['KITCHEN', 'PASTRY'], receiveQty: '35', receivePrice: '120' },
  { name: 'Bottled Water 500ml', type: 'PASS_THROUGH', buyUnit: 'crate', usageUnit: 'pcs', conversionFactor: '24', reorderLevel: '96', departmentTags: ['SERVICE'], receiveQty: '3', receivePrice: '480' },
  { name: 'Cleaning Detergent', type: 'PASS_THROUGH', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '10', departmentTags: ['HOUSEKEEPING'], receiveQty: '4', receivePrice: '350' },
];

const SUPPLIERS = [
  { name: 'Kilimanjaro Coffee Co.', contactName: 'James Mwangi', phone: '0722100200', email: 'orders@kilimanjarocoffee.co.ke' },
  { name: 'Kenya Fresh Dairy', contactName: 'Grace Wanjiru', phone: '0733400500', email: 'sales@kenyafreshdairy.co.ke' },
];

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const run = async (): Promise<void> => {
  // Some pre-existing STORE_MANAGER/STORE_ATTENDANT fixture users in this DB
  // have a null organizationId (from earlier test setup) — filter those out
  // explicitly rather than picking whichever row `findFirst` happens to hit.
  const storeManager = await prisma.user.findFirst({
    where: { role: 'STORE_MANAGER', organizationId: { not: null } },
    select: { id: true, organizationId: true },
  });
  if (!storeManager || !storeManager.organizationId) {
    throw new Error('No STORE_MANAGER user with an organizationId found. Run seed-dev.ts first.');
  }
  const organizationId = storeManager.organizationId;

  const location = await prisma.location.findFirst({
    where: { organizationId, type: 'CENTRAL_STORE' },
  });
  if (!location) {
    throw new Error('No CENTRAL_STORE location found. Run seed-dev.ts first.');
  }

  console.log(`Seeding inventory demo data for org ${organizationId}, location ${location.id}\n`);

  // --- Suppliers ---
  const supplierByName = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { organizationId, name: s.name } });
    const supplier = existing ?? (await prisma.supplier.create({
      data: { organizationId, name: s.name, contactName: s.contactName, phone: s.phone, email: s.email },
    }));
    supplierByName.set(s.name, supplier.id);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Supplier: ${s.name}`);
  }

  // --- Items + receive transactions (populates on-hand qty + currentCost) ---
  const itemIdByName = new Map<string, string>();
  for (const spec of ITEMS) {
    const existing = await prisma.inventoryItem.findFirst({ where: { organizationId, name: spec.name } });
    const item = existing ?? (await prisma.inventoryItem.create({
      data: {
        organizationId,
        name: spec.name,
        type: spec.type,
        buyUnit: spec.buyUnit,
        usageUnit: spec.usageUnit,
        conversionFactor: d(spec.conversionFactor),
        reorderLevel: d(spec.reorderLevel),
        departmentTags: spec.departmentTags,
      },
    }));
    itemIdByName.set(spec.name, item.id);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Item: ${spec.name}`);

    if (!existing) {
      await inventoryTransactionService.recordReceive({
        organizationId,
        locationId: location.id,
        userId: storeManager.id,
        inventoryItemId: item.id,
        buyQty: d(spec.receiveQty),
        unitPrice: d(spec.receivePrice),
      });
    }
  }

  // --- Purchase orders across a few statuses ---
  const kilimanjaroId = supplierByName.get('Kilimanjaro Coffee Co.')!;
  const dairyId = supplierByName.get('Kenya Fresh Dairy')!;
  const beansId = itemIdByName.get('Arabica Coffee Beans')!;
  const milkId = itemIdByName.get('Fresh Milk')!;
  const sugarId = itemIdByName.get('Brown Sugar')!;
  const cupsId = itemIdByName.get('Disposable Cups 12oz')!;

  const poNumber = () => {
    const now = new Date();
    const y = String(now.getFullYear()).slice(2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `PO-${y}${m}${dd}-${suffix}`;
  };

  const posToCreate: {
    supplierId: string;
    status: 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'CLOSED';
    lines: { inventoryItemId: string; orderedQty: string; unitPrice: string; receivedQty?: string; invoicePrice?: string }[];
  }[] = [
    {
      supplierId: kilimanjaroId,
      status: 'DRAFT',
      lines: [
        { inventoryItemId: beansId, orderedQty: '10', unitPrice: '1240' },
        { inventoryItemId: milkId, orderedQty: '20', unitPrice: '210' },
        { inventoryItemId: sugarId, orderedQty: '2', unitPrice: '680' },
      ],
    },
    {
      supplierId: dairyId,
      status: 'SENT',
      lines: [{ inventoryItemId: milkId, orderedQty: '25', unitPrice: '210' }],
    },
    {
      supplierId: kilimanjaroId,
      status: 'PARTIALLY_RECEIVED',
      lines: [
        { inventoryItemId: cupsId, orderedQty: '8', unitPrice: '700', receivedQty: '5', invoicePrice: '700' },
      ],
    },
    {
      supplierId: kilimanjaroId,
      status: 'CLOSED',
      lines: [{ inventoryItemId: beansId, orderedQty: '15', unitPrice: '1240', receivedQty: '15', invoicePrice: '1250' }],
    },
  ];

  for (const spec of posToCreate) {
    const po = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: spec.supplierId,
        locationId: location.id,
        poNumber: poNumber(),
        status: spec.status,
        createdById: storeManager.id,
        sentAt: spec.status !== 'DRAFT' ? new Date() : null,
        closedAt: spec.status === 'CLOSED' ? new Date() : null,
        lines: {
          create: spec.lines.map((l) => ({
            organizationId,
            inventoryItemId: l.inventoryItemId,
            orderedQty: d(l.orderedQty),
            unitPrice: d(l.unitPrice),
            receivedQty: l.receivedQty ? d(l.receivedQty) : d(0),
            invoicePrice: l.invoicePrice ? d(l.invoicePrice) : null,
            receivedAt: l.receivedQty ? new Date() : null,
          })),
        },
      },
    });
    console.log(`OK    Purchase Order ${po.poNumber} — ${spec.status}`);
  }

  console.log('\nDone.');
};

run()
  .catch((error: unknown) => {
    console.error('seed-inventory-demo failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
