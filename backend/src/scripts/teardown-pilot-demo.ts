/**
 * teardown-pilot-demo.ts
 *
 * Removes exactly the rows created by seed-pilot-demo.ts from the hub org's
 * Central Store, after the demo video has been recorded — WITHOUT touching
 * anything else in that org. Because there is only one hub Organization
 * system-wide (D-15), the demo data lives inside the *real* Central Store,
 * not an isolated org (see plan doc §2 "Course correction — 2026-08-01"), so
 * teardown cannot delete "everything where organizationId = X." Instead it
 * deletes only rows matching the exact markers seed-pilot-demo.ts used for
 * its own idempotency checks: item/supplier names from pilot-demo-data.ts,
 * PO numbers (PO-DEMO-*), invoice references (*-INV-*), and the stock count
 * label. Anything created later through real use of the same org — even an
 * item that happens to share a name — is a risk this script cannot fully
 * eliminate; review the dry-run output before confirming.
 *
 * ONLY runs when NODE_ENV === 'production' (same as seed-pilot-demo.ts).
 * Requires SEED_PILOT_DEMO_CONFIRM=YES.
 *
 * Defaults to DRY RUN — prints exactly what would be deleted, deletes
 * nothing, unless --confirm is passed.
 *
 * Usage:
 *   # 1. Preview first (always do this):
 *   docker compose exec api sh -c \
 *     "SEED_PILOT_DEMO_CONFIRM=YES node dist/scripts/teardown-pilot-demo.js"
 *
 *   # 2. Then actually delete:
 *   docker compose exec api sh -c \
 *     "SEED_PILOT_DEMO_CONFIRM=YES node dist/scripts/teardown-pilot-demo.js --confirm"
 */

import 'dotenv/config';
import { prisma } from '../config/database';
import { env } from '../config/env';
import {
  DEMO_DRAFT_PO,
  DEMO_INVOICES,
  DEMO_ITEMS,
  DEMO_PREP_RECIPE,
  DEMO_SENT_PO,
  DEMO_STOCK_COUNT,
  DEMO_SUPPLIERS,
} from './pilot-demo-data';

if (env.NODE_ENV !== 'production') {
  console.error('ERROR: teardown-pilot-demo only runs against production. Exiting.');
  process.exit(1);
}

if (process.env.SEED_PILOT_DEMO_CONFIRM !== 'YES') {
  console.error('ERROR: SEED_PILOT_DEMO_CONFIRM=YES is required to run this against production. Exiting.');
  process.exit(1);
}

const DRY_RUN = !process.argv.includes('--confirm');

const DEMO_ITEM_NAMES = [...DEMO_ITEMS.map((i) => i.name), DEMO_PREP_RECIPE.outputItemName];
const DEMO_SUPPLIER_NAMES = DEMO_SUPPLIERS.map((s) => s.name);
const DEMO_PO_NUMBERS = [
  DEMO_DRAFT_PO.poNumber,
  DEMO_SENT_PO.poNumber,
  ...DEMO_INVOICES.map((inv) => inv.closedPo.poNumber),
];
const DEMO_INVOICE_REFS = DEMO_INVOICES.map((inv) => inv.reference);
const DEMO_STOCK_COUNT_LABEL = DEMO_STOCK_COUNT.label;

const run = async (): Promise<void> => {
  const hubOrg = await prisma.organization.findFirst({ where: { isHub: true, isActive: true } });
  if (!hubOrg) {
    throw new Error('No hub organization found — nothing to tear down.');
  }
  const organizationId = hubOrg.id;

  console.log(`${DRY_RUN ? 'DRY RUN — ' : ''}Tearing down pilot demo data from org "${hubOrg.name}" (${organizationId})\n`);

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId, name: { in: DEMO_ITEM_NAMES } },
    select: { id: true, name: true },
  });
  const itemIds = items.map((i) => i.id);

  const suppliers = await prisma.supplier.findMany({
    where: { organizationId, name: { in: DEMO_SUPPLIER_NAMES } },
    select: { id: true, name: true },
  });
  const supplierIds = suppliers.map((s) => s.id);

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { organizationId, poNumber: { in: DEMO_PO_NUMBERS } },
    select: { id: true, poNumber: true },
  });
  const poIds = purchaseOrders.map((p) => p.id);

  const invoices = await prisma.supplierInvoice.findMany({
    where: { organizationId, referenceNumber: { in: DEMO_INVOICE_REFS } },
    select: { id: true, referenceNumber: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  const stockCounts = await prisma.stockCount.findMany({
    where: { organizationId, label: DEMO_STOCK_COUNT_LABEL },
    select: { id: true, label: true },
  });
  const stockCountIds = stockCounts.map((c) => c.id);

  const wasteLogs = await prisma.wasteLog.findMany({
    where: { organizationId, inventoryItemId: { in: itemIds } },
    select: { id: true, quantity: true, reason: true },
  });
  const wasteLogIds = wasteLogs.map((w) => w.id);

  const prepRecords = await prisma.prepRecord.findMany({
    where: { organizationId, outputItemId: { in: itemIds } },
    select: { id: true, actualYield: true },
  });
  const prepRecordIds = prepRecords.map((p) => p.id);

  const prepRecipes = await prisma.prepRecipe.findMany({
    where: { organizationId, outputItemId: { in: itemIds } },
    select: { id: true, name: true },
  });
  const prepRecipeIds = prepRecipes.map((r) => r.id);

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { organizationId, inventoryItemId: { in: itemIds } },
    select: { id: true },
  });
  const transactionIds = transactions.map((t) => t.id);

  console.log('Would delete:');
  console.log(`  ${transactionIds.length} InventoryTransaction rows`);
  console.log(`  ${wasteLogIds.length} WasteLog rows`);
  console.log(`  ${prepRecordIds.length} PrepRecord rows`);
  console.log(`  ${prepRecipeIds.length} PrepRecipe rows (cascades their lines)`);
  console.log(`  ${stockCountIds.length} StockCount rows (cascades their lines) — ${stockCounts.map((c) => c.label).join(', ') || 'none'}`);
  console.log(`  ${invoiceIds.length} SupplierInvoice rows (cascades their payments) — ${invoices.map((i) => i.referenceNumber).join(', ') || 'none'}`);
  console.log(`  ${poIds.length} PurchaseOrder rows (cascades their lines) — ${purchaseOrders.map((p) => p.poNumber).join(', ') || 'none'}`);
  console.log(`  ${items.length} InventoryItem rows — ${items.map((i) => i.name).join(', ') || 'none'}`);
  console.log(`  ${supplierIds.length} Supplier rows (cascades their SupplierItem links) — ${suppliers.map((s) => s.name).join(', ') || 'none'}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to actually delete.');
    return;
  }

  await prisma.$transaction([
    prisma.inventoryTransaction.deleteMany({ where: { id: { in: transactionIds } } }),
    prisma.wasteLog.deleteMany({ where: { id: { in: wasteLogIds } } }),
    prisma.prepRecord.deleteMany({ where: { id: { in: prepRecordIds } } }),
    prisma.prepRecipe.deleteMany({ where: { id: { in: prepRecipeIds } } }),
    prisma.stockCount.deleteMany({ where: { id: { in: stockCountIds } } }),
    prisma.supplierInvoice.deleteMany({ where: { id: { in: invoiceIds } } }),
    prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } }),
    prisma.supplierItem.deleteMany({ where: { organizationId, inventoryItemId: { in: itemIds } } }),
    prisma.inventoryItem.deleteMany({ where: { id: { in: itemIds } } }),
    prisma.supplier.deleteMany({ where: { id: { in: supplierIds } } }),
  ]);

  console.log('\nDone. Demo data removed; the hub org, Central Store location, and Manager/Attendant accounts are untouched.');
};

run()
  .catch((error: unknown) => {
    console.error('teardown-pilot-demo failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
