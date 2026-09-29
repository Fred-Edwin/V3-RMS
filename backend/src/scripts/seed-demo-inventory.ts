/**
 * seed-demo-inventory.ts
 *
 * Reference data for a demo / dry run of the Inventory & Procurement feature:
 * categories, suppliers, catalog items (raw, prepped, stocked), opening stock
 * at the Central Store, and restock levels. Idempotent — safe to re-run.
 *
 * It does NOT create accounts (the demo creates those through the UI) and it
 * does NOT create the branch department locations (run
 * provision-branch-departments.ts first — this script checks and stops if they
 * are missing).
 *
 * Usage (scratch or dev only):
 *   DEMO_SEED_CONFIRM=YES npx tsx src/scripts/seed-demo-inventory.ts
 *   DEMO_SEED_CONFIRM=YES DEMO_SET_PASSWORDS=YES npx tsx src/scripts/seed-demo-inventory.ts
 *     (the second form also sets a known dev password on the demo Kitchen head,
 *      Barista head and Branch Manager — refuses unless the database name ends
 *      in "dryrun" or "dev")
 */

import 'dotenv/config';
import { DepartmentTag, InventoryItemType, Prisma, SupplierPaymentTerms } from '@prisma/client';
import { prisma } from '../config/database';
import { hashPassword } from '../utils/password';

const DEV_PASSWORD = 'DryRun#2026!';
const STORE_MANAGER_EMAIL = process.env.DEMO_STORE_MANAGER_EMAIL ?? 'demo.storemanager@wendo.co.ke';

interface SupplierSpec {
  name: string;
  contactName: string;
  phone: string;
  location: string;
  terms: SupplierPaymentTerms;
  paymentDays: number;
}

const SUPPLIERS: SupplierSpec[] = [
  { name: 'Kagumo Poultry Farm', contactName: 'Peter Kariuki', phone: '0722 410 552', location: 'Kagumo', terms: 'INVOICE_TO_FOLLOW', paymentDays: 14 },
  { name: 'Karatina Fresh Produce', contactName: 'Lucy Wanjiru', phone: '0733 918 204', location: 'Karatina market', terms: 'PAY_NOW', paymentDays: 0 },
  { name: 'Nyeri Dairy Cooperative', contactName: 'Samuel Ngugi', phone: '0711 602 887', location: 'Nyeri town', terms: 'INVOICE_TO_FOLLOW', paymentDays: 30 },
];

const CATEGORIES = ['Meat & Poultry', 'Dairy & Eggs', 'Vegetables & Herbs', 'Dry Goods', 'Cooking Essentials'];

interface ItemSpec {
  name: string;
  type: InventoryItemType;
  category: string;
  supplier?: string;
  buyUnit: string;
  usageUnit: string;
  conversion: number | null;
  cost: number; // KES per usage unit
  tags: DepartmentTag[];
  openingStock: number; // in usage units at the Central Store
}

const ITEMS: ItemSpec[] = [
  { name: 'Chicken breast (raw)', type: 'RAW_INGREDIENT', category: 'Meat & Poultry', supplier: 'Kagumo Poultry Farm', buyUnit: 'tray', usageUnit: 'kg', conversion: 5, cost: 620, tags: [], openingStock: 40 },
  { name: 'Cooking oil', type: 'RAW_INGREDIENT', category: 'Cooking Essentials', supplier: 'Karatina Fresh Produce', buyUnit: 'jerrycan', usageUnit: 'L', conversion: 20, cost: 260, tags: [], openingStock: 60 },
  { name: 'Garlic', type: 'RAW_INGREDIENT', category: 'Vegetables & Herbs', supplier: 'Karatina Fresh Produce', buyUnit: 'net', usageUnit: 'kg', conversion: 5, cost: 380, tags: [], openingStock: 10 },
  { name: 'Lemons', type: 'RAW_INGREDIENT', category: 'Vegetables & Herbs', supplier: 'Karatina Fresh Produce', buyUnit: 'crate', usageUnit: 'pcs', conversion: 100, cost: 12, tags: [], openingStock: 300 },
  { name: 'Wheat flour', type: 'RAW_INGREDIENT', category: 'Dry Goods', buyUnit: 'bag', usageUnit: 'kg', conversion: 24, cost: 105, tags: [], openingStock: 120 },
  { name: 'Marinated chicken breast', type: 'PREPPED', category: 'Meat & Poultry', buyUnit: 'kg', usageUnit: 'kg', conversion: 1, cost: 0, tags: ['KITCHEN'], openingStock: 0 },
  { name: 'Fresh milk', type: 'STOCKED', category: 'Dairy & Eggs', supplier: 'Nyeri Dairy Cooperative', buyUnit: 'crate', usageUnit: 'L', conversion: 12, cost: 75, tags: ['BARISTA', 'KITCHEN'], openingStock: 96 },
  { name: 'Eggs', type: 'STOCKED', category: 'Dairy & Eggs', supplier: 'Nyeri Dairy Cooperative', buyUnit: 'tray', usageUnit: 'pcs', conversion: 30, cost: 17, tags: ['KITCHEN', 'PASTRY'], openingStock: 180 },
];

/** Central Store restock levels, in each item's usage unit. */
const CENTRAL_LEVELS: Record<string, number> = {
  'Chicken breast (raw)': 50,
  'Cooking oil': 40,
  'Wheat flour': 100,
  'Fresh milk': 120,
  Eggs: 150,
};

/** Department restock levels at Nyeri Town. */
const DEPARTMENT_LEVELS: { tag: DepartmentTag; item: string; level: number }[] = [
  { tag: 'KITCHEN', item: 'Marinated chicken breast', level: 8 },
  { tag: 'KITCHEN', item: 'Eggs', level: 60 },
  { tag: 'KITCHEN', item: 'Fresh milk', level: 6 },
  { tag: 'BARISTA', item: 'Fresh milk', level: 24 },
  { tag: 'PASTRY', item: 'Eggs', level: 90 },
];

const dec = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

const run = async (): Promise<void> => {
  if (process.env.DEMO_SEED_CONFIRM !== 'YES') {
    throw new Error('Set DEMO_SEED_CONFIRM=YES to run this demo seed.');
  }

  const hub = await prisma.organization.findFirst({ where: { isHub: true }, select: { id: true, name: true } });
  if (!hub) throw new Error('No hub organization found.');

  const centralLocation = await prisma.location.findFirst({
    where: { organizationId: hub.id, type: 'CENTRAL_STORE' },
    select: { id: true },
  });
  if (!centralLocation) throw new Error('Central Store location not found.');

  const nyeri = await prisma.organization.findFirst({ where: { name: 'Nyeri Town', isHub: false }, select: { id: true } });
  if (!nyeri) throw new Error('Nyeri Town branch not found.');
  const deptLocations = await prisma.location.findMany({
    where: { organizationId: nyeri.id, type: 'BRANCH_DEPARTMENT' },
    select: { id: true, departmentTag: true },
  });
  if (deptLocations.length < 5) {
    throw new Error('Nyeri Town department locations are missing — run provision-branch-departments.ts first.');
  }

  const actor = await prisma.user.findFirst({ where: { email: STORE_MANAGER_EMAIL }, select: { id: true } });
  if (!actor) throw new Error(`Store Manager ${STORE_MANAGER_EMAIL} not found — create it through the UI first.`);

  // Categories
  const categoryId = new Map<string, string>();
  for (const name of CATEGORIES) {
    const found = await prisma.category.findFirst({ where: { organizationId: hub.id, name, deletedAt: null }, select: { id: true } });
    const row = found ?? (await prisma.category.create({ data: { organizationId: hub.id, name }, select: { id: true } }));
    categoryId.set(name, row.id);
  }
  const coffee = await prisma.category.findFirst({ where: { organizationId: hub.id, name: 'Coffee', deletedAt: null }, select: { id: true } });
  if (coffee) categoryId.set('Coffee', coffee.id);

  // Suppliers
  const supplierId = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const found = await prisma.supplier.findFirst({ where: { organizationId: hub.id, name: s.name, deletedAt: null }, select: { id: true } });
    const row =
      found ??
      (await prisma.supplier.create({
        data: {
          organizationId: hub.id,
          name: s.name,
          contactName: s.contactName,
          phone: s.phone,
          location: s.location,
          defaultPaymentTerms: s.terms,
          paymentDays: s.paymentDays,
        },
        select: { id: true },
      }));
    supplierId.set(s.name, row.id);
  }

  // Items + opening stock
  const itemId = new Map<string, string>();
  let stockRows = 0;
  for (const spec of ITEMS) {
    const found = await prisma.inventoryItem.findFirst({ where: { organizationId: hub.id, name: spec.name, deletedAt: null }, select: { id: true } });
    const row =
      found ??
      (await prisma.inventoryItem.create({
        data: {
          organizationId: hub.id,
          name: spec.name,
          type: spec.type,
          categoryId: categoryId.get(spec.category),
          preferredSupplierId: spec.supplier ? supplierId.get(spec.supplier) : undefined,
          buyUnit: spec.buyUnit,
          usageUnit: spec.usageUnit,
          conversionFactor: spec.conversion === null ? null : dec(spec.conversion),
          departmentTags: spec.tags,
          currentCost: dec(spec.cost),
        },
        select: { id: true },
      }));
    itemId.set(spec.name, row.id);

    if (!found && spec.openingStock > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          organizationId: hub.id,
          locationId: centralLocation.id,
          inventoryItemId: row.id,
          type: 'RECEIVE',
          quantity: dec(spec.openingStock),
          unitCost: dec(spec.cost),
          reason: 'Opening stock (demo data)',
          userId: actor.id,
        },
      });
      stockRows++;
    }
  }

  // Restock levels
  let levels = 0;
  for (const [name, level] of Object.entries(CENTRAL_LEVELS)) {
    const id = itemId.get(name);
    if (!id) continue;
    await prisma.restockLevel.upsert({
      where: { locationId_inventoryItemId: { locationId: centralLocation.id, inventoryItemId: id } },
      update: { level: dec(level), setById: actor.id },
      create: { organizationId: hub.id, locationId: centralLocation.id, inventoryItemId: id, level: dec(level), setById: actor.id },
    });
    levels++;
  }
  for (const d of DEPARTMENT_LEVELS) {
    const loc = deptLocations.find((l) => l.departmentTag === d.tag);
    const id = itemId.get(d.item);
    if (!loc || !id) continue;
    await prisma.restockLevel.upsert({
      where: { locationId_inventoryItemId: { locationId: loc.id, inventoryItemId: id } },
      update: { level: dec(d.level), setById: actor.id },
      create: { organizationId: nyeri.id, locationId: loc.id, inventoryItemId: id, level: dec(d.level), setById: actor.id },
    });
    levels++;
  }

  console.log(`Demo inventory seeded: ${categoryId.size} categories, ${supplierId.size} suppliers, ${itemId.size} items, ${stockRows} opening-stock rows, ${levels} restock levels.`);

  // Dev passwords (scratch/dev databases only)
  if (process.env.DEMO_SET_PASSWORDS === 'YES') {
    const dbName = (process.env.DATABASE_URL ?? '').split('/').pop()?.split('?')[0] ?? '';
    if (!/(dryrun|dev)$/.test(dbName)) {
      throw new Error(`Refusing to set dev passwords on database "${dbName}".`);
    }
    const hash = await hashPassword(DEV_PASSWORD);
    const emails = ['kelvin.kings@wendo.co.ke', 'victor.town@wendo.co.ke', 'manager.town@wendo.co.ke'];
    const res = await prisma.user.updateMany({ where: { email: { in: emails } }, data: { passwordHash: hash } });
    console.log(`Dev password set on ${res.count} accounts (${emails.join(', ')}).`);
  }
};

run()
  .catch((error: unknown) => {
    console.error('Demo seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
