/**
 * seed-inventory-catalog.ts
 *
 * Inventory Milestone One catalog/supplier/restock-level seed data — real
 * supplier names, real products, real units and pack sizes, transcribed from
 * `docs/inventory/reference-photos/`: two Samrat Supermarket Ltd deliveries
 * (photos 1, 8 — dated 07-Jul-2026 and 21-Jul-2026) and one Summer Limited
 * delivery (photo 5 — dated 16-Jul-2026), plus the client's own category
 * vocabulary from their paper stock sheets (photo 20: "Market items" /
 * "Dry items").
 *
 * Replaces the retired seed-inventory-demo.ts / seed-pilot-demo(-local).ts /
 * seed-price-history-demo.ts — those targeted the pre-Milestone-One schema
 * (reorderLevel, PurchaseOrder, SupplierItem, ...) and the production rows
 * they described were invented showcase names ("Sunrise Cooking Oil") that
 * appear on no real invoice (plan §4, "Photos win"). This script seeds only
 * what Milestone One owns: categories, items, suppliers, restock levels.
 * Goods receipts, purchase orders, prep, and AP are out of scope this
 * milestone (plan §0) and seed no data here.
 *
 * D-15: all Central Store data is written under the hub org
 * (`docs/inventory/CENTRAL_STORE_SCOPING_DESIGN.md` §4). This script resolves
 * the hub org and its CENTRAL_STORE location the same way seed-dev.ts creates
 * them — run seed-dev.ts first in a fresh environment.
 *
 * Idempotent: items/categories/suppliers are upserted by (organizationId,
 * name); restock levels are upserted by (locationId, inventoryItemId). Safe
 * to re-run.
 *
 * Usage:
 *   npx tsx src/scripts/seed-inventory-catalog.ts
 *
 * Production: guarded by the existing ALLOW_PRODUCTION_SEED/confirm-env
 * pattern, matching seed-report-orders.ts.
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';

if (env.NODE_ENV === 'production') {
  if (process.env['ALLOW_PRODUCTION_SEED'] !== 'true' || process.env['SEED_REPORTS_CONFIRM'] !== 'YES') {
    console.error(
      'ERROR: refusing to seed inventory catalog data in production without ' +
        'ALLOW_PRODUCTION_SEED=true and SEED_REPORTS_CONFIRM=YES. Exiting.',
    );
    process.exit(1);
  }
}

type ItemType = 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';
type DeptTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

type ItemSpec = {
  name: string;
  type: ItemType;
  category: string;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string | null;
  packSize: string | null;
  departmentTags: DeptTag[];
  supplier: string;
  /** Central Store restock level, in the item's usage unit. */
  centralStoreLevel: string;
};

/** The client's own category vocabulary — reference photo 20's paper sheets. */
const CATEGORIES = ['Dry items', 'Market items'] as const;

/**
 * Real data — Samrat Supermarket Ltd (photos 1, 8: pantry/consumables,
 * dry-goods invoices dated 21-Jul-2026 and an earlier delivery).
 * Raw ingredients: never department-scoped (plan §3.2). Consumables the
 * client issues directly to a department (cling film, air freshener) are
 * STOCKED and carry the department that uses them.
 */
const SAMRAT_ITEMS: ItemSpec[] = [
  { name: 'Salt Cooking Oil 10ltr', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'jerrican (10L)', usageUnit: 'L', conversionFactor: '10', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '40' },
  { name: 'Kabras Sugar 1kg', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '100' },
  { name: 'Prestige Margarine 10kg box', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'box (10kg)', usageUnit: 'kg', conversionFactor: '10', packSize: '10', departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '20' },
  { name: 'Chain Kwo Soy Sauce Dark 623ml', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'bottle (623ml)', usageUnit: 'ml', conversionFactor: '623', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '2500' },
  { name: 'Kamal Gram Flour 1kg', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '10' },
  { name: 'Clovers Brown Sugar 1kg pkt', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'pkt (1kg)', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '15' },
  { name: 'Angel Instant Dry Yeast 500g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'pouch (500g)', usageUnit: 'g', conversionFactor: '500', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '1000' },
  { name: 'Gathuthi Tea Leaves 750ml Hazelnut', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'pkt', usageUnit: 'pkt', conversionFactor: null, packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '20' },
  { name: 'BSD Natural Yoghurt Cup 450ml', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'cup (450ml)', usageUnit: 'ml', conversionFactor: '450', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '900' },
  { name: 'Zesta Yellow Mustard 240g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'bottle (240g)', usageUnit: 'g', conversionFactor: '240', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '720' },
  { name: 'Zesta Eggless Mayonnaise 340g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'bottle (340g)', usageUnit: 'g', conversionFactor: '340', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '680' },
  { name: 'S/Garden Whole Mushroom 400g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'pkt (400g)', usageUnit: 'g', conversionFactor: '400', packSize: null, departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '1600' },
  { name: 'Zesta Chilli Sauce Sachets 300x15g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'ctn (1000pcs x5g)', usageUnit: 'sachet', conversionFactor: '1000', packSize: '1000', departmentTags: [], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '2000' },
  { name: 'Royal Cling Film 30x300m', type: 'STOCKED', category: 'Dry items', buyUnit: 'roll', usageUnit: 'roll', conversionFactor: '1', packSize: null, departmentTags: ['KITCHEN', 'SERVICE'], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '5' },
  { name: 'Rubina A/Freshener 100ml Strawberry', type: 'STOCKED', category: 'Dry items', buyUnit: 'can', usageUnit: 'can', conversionFactor: '1', packSize: null, departmentTags: ['HOUSEKEEPING'], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '6' },
  { name: 'Safisha Disinfectant Colour Ball 200gm 5pcs', type: 'STOCKED', category: 'Dry items', buyUnit: 'pkt (5pcs)', usageUnit: 'pc', conversionFactor: '5', packSize: '5', departmentTags: ['HOUSEKEEPING'], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '10' },
  { name: 'S/Steel Strainer No.25', type: 'STOCKED', category: 'Dry items', buyUnit: 'pc', usageUnit: 'pc', conversionFactor: null, packSize: null, departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket Ltd', centralStoreLevel: '3' },
];

/** Real data — Summer Limited (photo 5: bulk/butchery/cleaning supplies, dated 16-Jul-2026). */
const SUMMER_ITEMS: ItemSpec[] = [
  { name: '210 Home Baking Flour 12x2kg', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'ctn (12x2kg)', usageUnit: 'kg', conversionFactor: '24', packSize: '12', departmentTags: [], supplier: 'Summer Limited', centralStoreLevel: '48' },
  { name: 'Golden Drop Oil 20ltr', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'jerrican (20L)', usageUnit: 'L', conversionFactor: '20', packSize: null, departmentTags: [], supplier: 'Summer Limited', centralStoreLevel: '60' },
  { name: 'Zesta Chilli Sauce Sachets 300x15g', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'ctn (300x15g)', usageUnit: 'sachet', conversionFactor: '300', packSize: '300', departmentTags: [], supplier: 'Summer Limited', centralStoreLevel: '900' },
  { name: 'Toilex White Tissue Wrapped 10pack', type: 'STOCKED', category: 'Dry items', buyUnit: 'ctn (10pack)', usageUnit: 'pack', conversionFactor: '10', packSize: '10', departmentTags: ['HOUSEKEEPING'], supplier: 'Summer Limited', centralStoreLevel: '30' },
  { name: 'Pulita Serviette', type: 'STOCKED', category: 'Dry items', buyUnit: 'ctn', usageUnit: 'pack', conversionFactor: null, packSize: null, departmentTags: ['SERVICE'], supplier: 'Summer Limited', centralStoreLevel: '20' },
  { name: 'Highlands Water 12x1ltr', type: 'STOCKED', category: 'Dry items', buyUnit: 'ctn (12x1L)', usageUnit: 'bottle', conversionFactor: '12', packSize: '12', departmentTags: ['SERVICE'], supplier: 'Summer Limited', centralStoreLevel: '48' },
  { name: 'Duos Cream Cookies 4corex24pktx30gms', type: 'STOCKED', category: 'Dry items', buyUnit: 'ctn', usageUnit: 'pkt', conversionFactor: '96', packSize: '96', departmentTags: ['SERVICE'], supplier: 'Summer Limited', centralStoreLevel: '48' },
  { name: 'Coco Primo 24x100g Sachets', type: 'RAW_INGREDIENT', category: 'Dry items', buyUnit: 'ctn (24x100g)', usageUnit: 'sachet', conversionFactor: '24', packSize: '24', departmentTags: [], supplier: 'Summer Limited', centralStoreLevel: '48' },
  { name: 'Meta Multipurpose Soap 10x1kg', type: 'STOCKED', category: 'Dry items', buyUnit: 'ctn (10x1kg)', usageUnit: 'kg', conversionFactor: '10', packSize: '10', departmentTags: ['HOUSEKEEPING'], supplier: 'Summer Limited', centralStoreLevel: '20' },
  { name: 'Mariandazi 72x100g Box', type: 'STOCKED', category: 'Dry items', buyUnit: 'box (72x100g)', usageUnit: 'pc', conversionFactor: '72', packSize: '72', departmentTags: ['SERVICE'], supplier: 'Summer Limited', centralStoreLevel: '72' },
];

/**
 * Real data — the client's own "Market items" sheet (photo 20). Market
 * produce is bought fresh, without a formal supplier invoice, so no fixed
 * supplier is attached; department-scoped to KITCHEN since it's issued
 * straight to the kitchen on receipt.
 */
const MARKET_ITEMS: ItemSpec[] = [
  { name: 'Potatoes', type: 'RAW_INGREDIENT', category: 'Market items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: '', centralStoreLevel: '50' },
  { name: 'Tomatoes', type: 'RAW_INGREDIENT', category: 'Market items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: '', centralStoreLevel: '15' },
  { name: 'Carrots', type: 'RAW_INGREDIENT', category: 'Market items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: '', centralStoreLevel: '10' },
  { name: 'Onions', type: 'RAW_INGREDIENT', category: 'Market items', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', packSize: null, departmentTags: [], supplier: '', centralStoreLevel: '15' },
  { name: 'Lettuce', type: 'RAW_INGREDIENT', category: 'Market items', buyUnit: 'pc', usageUnit: 'pc', conversionFactor: null, packSize: null, departmentTags: [], supplier: '', centralStoreLevel: '5' },
];

const SUPPLIERS: { name: string; category: string; contactName: string; phone: string; email: string; location: string }[] = [
  { name: 'Samrat Supermarket Ltd', category: 'Dry items', contactName: 'Dattu', phone: '+254722160400', email: 'samratnyeri@gmail.com', location: 'Nyeri town' },
  { name: 'Summer Limited', category: 'Dry items', contactName: 'Summer Ltd Accounts', phone: '+254722204970', email: 'info@summerltd.com', location: 'Nyeri town' },
];

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const run = async (): Promise<void> => {
  const storeManager = await prisma.user.findFirst({
    where: { role: 'STORE_MANAGER', organizationId: { not: null } },
    select: { id: true, organizationId: true },
  });
  if (!storeManager || !storeManager.organizationId) {
    throw new Error('No STORE_MANAGER user with an organizationId found. Run seed-dev.ts first.');
  }
  const organizationId = storeManager.organizationId;

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { isHub: true } });
  if (!organization?.isHub) {
    throw new Error(
      `STORE_MANAGER's organization (${organizationId}) is not the hub org — D-15 requires Central Store ` +
        'data on the hub org. Run seed-dev.ts first.',
    );
  }

  const location = await prisma.location.findFirst({ where: { organizationId, type: 'CENTRAL_STORE' } });
  if (!location) {
    throw new Error('No CENTRAL_STORE location found. Run seed-dev.ts first.');
  }

  console.log(`Seeding Inventory Milestone One catalog for hub org ${organizationId}, location ${location.id}\n`);

  // --- Categories ---
  const categoryIdByName = new Map<string, string>();
  for (const name of CATEGORIES) {
    const existing = await prisma.category.findFirst({ where: { organizationId, name } });
    const category = existing ?? (await prisma.category.create({ data: { organizationId, name } }));
    categoryIdByName.set(name, category.id);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Category: ${name}`);
  }

  // --- Suppliers ---
  const supplierIdByName = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { organizationId, name: s.name } });
    const supplier = existing ?? (await prisma.supplier.create({
      data: {
        organizationId,
        name: s.name,
        contactName: s.contactName,
        categoryId: categoryIdByName.get(s.category) ?? null,
        phone: s.phone,
        email: s.email,
        location: s.location,
        defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
      },
    }));
    supplierIdByName.set(s.name, supplier.id);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Supplier: ${s.name}`);
  }

  // --- Items + Central Store restock levels ---
  const ALL_ITEMS = [...SAMRAT_ITEMS, ...SUMMER_ITEMS, ...MARKET_ITEMS];
  for (const spec of ALL_ITEMS) {
    const existing = await prisma.inventoryItem.findFirst({ where: { organizationId, name: spec.name } });
    const item = existing ?? (await prisma.inventoryItem.create({
      data: {
        organizationId,
        name: spec.name,
        type: spec.type,
        categoryId: categoryIdByName.get(spec.category) ?? null,
        preferredSupplierId: spec.supplier ? supplierIdByName.get(spec.supplier) ?? null : null,
        buyUnit: spec.buyUnit,
        usageUnit: spec.usageUnit,
        conversionFactor: spec.conversionFactor ? d(spec.conversionFactor) : null,
        packSize: spec.packSize ? d(spec.packSize) : null,
        departmentTags: spec.departmentTags,
      },
    }));
    console.log(`${existing ? 'SKIP ' : 'OK   '} Item: ${spec.name}`);

    await prisma.restockLevel.upsert({
      where: { locationId_inventoryItemId: { locationId: location.id, inventoryItemId: item.id } },
      update: {},
      create: {
        organizationId,
        locationId: location.id,
        inventoryItemId: item.id,
        level: d(spec.centralStoreLevel),
        setById: storeManager.id,
      },
    });
  }

  console.log('\nDone.');
};

run()
  .catch((error: unknown) => {
    console.error('seed-inventory-catalog failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
