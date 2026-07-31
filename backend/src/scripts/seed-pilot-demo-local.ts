/**
 * seed-pilot-demo-local.ts
 *
 * Seeds the synthetic pilot-demo dataset (pilot-demo-data.ts — plan doc
 * `docs/context/INVENTORY-FEATURE/PILOT_DEMO_VIDEO_PLAN.md` §1/§3) into the
 * LOCAL database's existing hub-org Central Store, for pre-deploy Phase 1
 * testing. Unlike the future production seed-pilot-demo.ts (plan doc §2),
 * this does NOT create an isolated demo Organization — it targets the hub
 * org that was set up through the Admin UI, so the walkthrough runs against
 * the exact same org/location/users the UI test uses.
 *
 * Never runs in production (the production variant will be a separate script
 * with the inverted guard, per the plan doc — do not repurpose this one).
 *
 * Idempotent: suppliers/items are matched by name, documents by fixed
 * reference (PO-DEMO-*, *-INV-*); opening receives, the prior prep record,
 * the in-progress stock count, and the waste entry are only written when
 * their item/document was created by this run.
 *
 * Usage:  cd backend && npx tsx src/scripts/seed-pilot-demo-local.ts
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { inventoryTransactionService } from '../services/inventory-transaction-service';
import { prepRecordService } from '../services/prep-record-service';
import { stockCountService } from '../services/stock-count-service';
import { supplierInvoiceService } from '../services/supplier-invoice-service';
import { wasteLogService } from '../services/waste-log-service';
import {
  DEMO_DRAFT_PO,
  DEMO_INVOICES,
  DEMO_ITEMS,
  DEMO_PREP_RECIPE,
  DEMO_PRIOR_PREP,
  DEMO_SENT_PO,
  DEMO_STOCK_COUNT,
  DEMO_SUPPLIERS,
  DEMO_WASTE,
} from './pilot-demo-data';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-pilot-demo-local must not run in production. Exiting.');
  process.exit(1);
}

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const daysAgo = (n: number): Date => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const run = async (): Promise<void> => {
  const hubOrg = await prisma.organization.findFirst({ where: { isHub: true, isActive: true } });
  if (!hubOrg) {
    throw new Error('No hub organization found. Create the Central Store org and flag it as hub in Admin first.');
  }
  const organizationId = hubOrg.id;

  const location = await prisma.location.findFirst({
    where: { organizationId, type: 'CENTRAL_STORE' },
  });
  if (!location) {
    throw new Error('No CENTRAL_STORE location on the hub org. Click "Set up Central Store" in Admin first.');
  }

  const storeManager = await prisma.user.findFirst({
    where: { role: 'STORE_MANAGER', organizationId, isActive: true },
  });
  const storeAttendant = await prisma.user.findFirst({
    where: { role: 'STORE_ATTENDANT', organizationId, isActive: true },
  });
  if (!storeManager || !storeAttendant) {
    throw new Error('Hub org needs one active STORE_MANAGER and one active STORE_ATTENDANT. Create them first.');
  }

  const managerActor = { id: storeManager.id, role: 'STORE_MANAGER' as const, organizationId };
  const attendantActor = { id: storeAttendant.id, role: 'STORE_ATTENDANT' as const, organizationId };

  console.log(`Seeding pilot demo data → org "${hubOrg.name}" (${organizationId}), location ${location.id}\n`);

  // ── Suppliers ──
  const supplierByName = new Map<string, string>();
  for (const s of DEMO_SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { organizationId, name: s.name } });
    const supplier =
      existing ??
      (await prisma.supplier.create({
        data: { organizationId, name: s.name, contactName: s.contactName, phone: s.phone, email: s.email },
      }));
    supplierByName.set(s.name, supplier.id);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Supplier: ${s.name}`);
  }

  // ── Items + supplier links + opening-stock receives ──
  const itemIdByName = new Map<string, string>();
  for (const spec of DEMO_ITEMS) {
    const existing = await prisma.inventoryItem.findFirst({ where: { organizationId, name: spec.name } });
    const item =
      existing ??
      (await prisma.inventoryItem.create({
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
      const supplierId = supplierByName.get(spec.supplier);
      if (supplierId) {
        await prisma.supplierItem.upsert({
          where: { supplierId_inventoryItemId: { supplierId, inventoryItemId: item.id } },
          update: {},
          create: { organizationId, supplierId, inventoryItemId: item.id, isDefault: true },
        });
      }
      if (Number(spec.openingBuyQty) > 0) {
        await inventoryTransactionService.recordReceive({
          organizationId,
          locationId: location.id,
          userId: storeManager.id,
          inventoryItemId: item.id,
          buyQty: d(spec.openingBuyQty),
          unitPrice: d(spec.buyUnitPrice),
        });
      }
    }
  }

  // ── Prep Recipe (creates the PREPPED output item atomically) + prior run ──
  const existingSyrup = await prisma.inventoryItem.findFirst({
    where: { organizationId, name: DEMO_PREP_RECIPE.outputItemName },
  });
  if (!existingSyrup) {
    const recipe = await prepRecordService.createRecipe(managerActor, {
      outputItemName: DEMO_PREP_RECIPE.outputItemName,
      usageUnit: DEMO_PREP_RECIPE.usageUnit,
      expectedYield: DEMO_PREP_RECIPE.expectedYield,
      batchLabel: DEMO_PREP_RECIPE.name,
      inputs: [
        {
          inventoryItemId: itemIdByName.get(DEMO_PREP_RECIPE.inputItemName)!,
          quantity: DEMO_PREP_RECIPE.inputQuantity,
        },
      ],
    });
    console.log(`OK    Prep Recipe: ${recipe.name}`);

    const syrup = await prisma.inventoryItem.findFirst({
      where: { organizationId, name: DEMO_PREP_RECIPE.outputItemName },
    });
    if (syrup) {
      await inventoryTransactionService.recordPrep({
        organizationId,
        locationId: location.id,
        outputItemId: syrup.id,
        actualYield: d(DEMO_PRIOR_PREP.actualYield),
        inputs: [
          {
            inventoryItemId: itemIdByName.get(DEMO_PREP_RECIPE.inputItemName)!,
            quantity: d(DEMO_PRIOR_PREP.inputQuantity),
          },
        ],
        recordedById: storeAttendant.id,
      });
      console.log(`OK    Prior Prep Record (${DEMO_PRIOR_PREP.actualYield}L) — rolling-average history`);
    }
  } else {
    console.log(`SKIP  Prep Recipe / prior run (output item already exists)`);
  }

  // ── Walkthrough POs: one DRAFT (Attendant), one SENT (ready to receive) ──
  const ensurePo = async (
    poNumber: string,
    status: 'DRAFT' | 'SENT',
    supplierName: string,
    createdById: string,
    lines: { itemName: string; qty: string; unitPrice: string }[],
  ): Promise<void> => {
    const existing = await prisma.purchaseOrder.findFirst({ where: { organizationId, poNumber } });
    if (existing) {
      console.log(`SKIP  Purchase Order ${poNumber}`);
      return;
    }
    await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: supplierByName.get(supplierName)!,
        locationId: location.id,
        poNumber,
        status,
        createdById,
        sentAt: status === 'SENT' ? daysAgo(1) : null,
        lines: {
          create: lines.map((line) => ({
            organizationId,
            inventoryItemId: itemIdByName.get(line.itemName)!,
            orderedQty: d(line.qty),
            unitPrice: d(line.unitPrice),
          })),
        },
      },
    });
    console.log(`OK    Purchase Order ${poNumber} — ${status}`);
  };

  await ensurePo(DEMO_DRAFT_PO.poNumber, 'DRAFT', DEMO_DRAFT_PO.supplier, storeAttendant.id, DEMO_DRAFT_PO.lines);
  await ensurePo(DEMO_SENT_PO.poNumber, 'SENT', DEMO_SENT_PO.supplier, storeManager.id, DEMO_SENT_PO.lines);

  // ── Supplier AP portfolio: closed POs + invoices across aging buckets ──
  for (const inv of DEMO_INVOICES) {
    const supplierId = supplierByName.get(inv.supplier)!;
    let closedPo = await prisma.purchaseOrder.findFirst({
      where: { organizationId, poNumber: inv.closedPo.poNumber },
    });
    if (!closedPo) {
      const sentAt = daysAgo(inv.daysAgo);
      closedPo = await prisma.purchaseOrder.create({
        data: {
          organizationId,
          supplierId,
          locationId: location.id,
          poNumber: inv.closedPo.poNumber,
          status: 'CLOSED',
          createdById: storeManager.id,
          sentAt,
          closedAt: sentAt,
          lines: {
            create: inv.closedPo.lines.map((line) => ({
              organizationId,
              inventoryItemId: itemIdByName.get(line.itemName)!,
              orderedQty: d(line.qty),
              unitPrice: d(line.unitPrice),
              receivedQty: d(line.qty),
              invoicePrice: d(line.unitPrice),
              receivedAt: sentAt,
            })),
          },
        },
      });
      console.log(`OK    Purchase Order ${inv.closedPo.poNumber} — CLOSED (AP backing)`);
    }

    const existingInvoice = await prisma.supplierInvoice.findFirst({
      where: { organizationId, referenceNumber: inv.reference },
    });
    if (existingInvoice) {
      console.log(`SKIP  Supplier Invoice ${inv.reference}`);
      continue;
    }
    const invoice = await supplierInvoiceService.create(managerActor, {
      supplierId,
      purchaseOrderId: closedPo.id,
      referenceNumber: inv.reference,
      amount: inv.amount,
      invoiceDate: daysAgo(inv.daysAgo).toISOString(),
    });
    for (const payment of inv.payments) {
      await supplierInvoiceService.recordPayment(managerActor, invoice.id, {
        amount: payment.amount,
        method: payment.method,
        paidAt: daysAgo(payment.daysAgo).toISOString(),
      });
    }
    console.log(`OK    Supplier Invoice ${inv.reference} — ${inv.payments.length ? 'with payment(s)' : 'UNPAID'}`);
  }

  // ── Waste entry (day before "recording") ──
  const existingWaste = await prisma.wasteLog.findFirst({ where: { organizationId } });
  if (!existingWaste) {
    await wasteLogService.create(attendantActor, {
      locationId: location.id,
      inventoryItemId: itemIdByName.get(DEMO_WASTE.itemName)!,
      quantity: DEMO_WASTE.quantity,
      reason: DEMO_WASTE.reason,
      note: DEMO_WASTE.note,
    });
    console.log(`OK    Waste Log — ${DEMO_WASTE.quantity}L ${DEMO_WASTE.itemName}, ${DEMO_WASTE.reason}`);
  } else {
    console.log('SKIP  Waste Log');
  }

  // ── In-progress stock count, left for the live blind-count walkthrough ──
  const existingCount = await prisma.stockCount.findFirst({
    where: { organizationId, label: DEMO_STOCK_COUNT.label },
  });
  if (!existingCount) {
    const created = await stockCountService.create(managerActor, {
      locationId: location.id,
      label: DEMO_STOCK_COUNT.label,
      scheduledDate: new Date().toISOString(),
      inventoryItemIds: DEMO_STOCK_COUNT.itemNames.map((name) => itemIdByName.get(name)!),
    });
    console.log(`OK    Stock Count "${created.label}" — IN_PROGRESS (execute the blind count in the UI)`);
  } else {
    console.log(`SKIP  Stock Count "${DEMO_STOCK_COUNT.label}"`);
  }

  console.log('\nDone. Log in as the Store Manager / Store Attendant and follow the test guide.');
};

run()
  .catch((error: unknown) => {
    console.error('seed-pilot-demo-local failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
