/**
 * seed-rehearsal-reference.ts
 *
 * Reference data for the local Inventory & Procurement rehearsal walkthrough:
 * hub + two branches with department locations, one named person per role
 * (all with signing PINs), the category hierarchy, suppliers on all three
 * payment terms, ~55 catalog items with standard costs, restock levels,
 * counting thresholds, Central Store opening stock and one branch opening
 * balance. Reference data ONLY — the day itself (receiving, prep, counts,
 * requisitions, dispatches, close) is walked through the UI so the ledger is
 * real. Idempotent and ordered: safe to re-run; existing rows are left alone.
 *
 * Refuses to run against production or any non-local database.
 *
 * Usage (local dev DB only):
 *   REHEARSAL_SEED_CONFIRM=YES npx tsx src/scripts/seed-rehearsal-reference.ts
 *
 * Logins — password `password123`, signing PIN `1234` for everyone:
 *   store.manager@wendo.test        STORE_MANAGER       (hub)
 *   store.attendant@wendo.test      STORE_ATTENDANT     (hub)
 *   bm.town@wendo.test              MANAGER             Nyeri Town
 *   bm.highway@wendo.test           MANAGER             Nyeri Highway
 *   kitchen.head.town@wendo.test    Kitchen head        Nyeri Town
 *   barista.head.town@wendo.test    Barista head        Nyeri Town
 *   kitchen.head.highway@wendo.test Kitchen head        Nyeri Highway
 *   accountant@wendo.test           ACCOUNTANT          (hub)
 *   director@wendo.test             DIRECTOR            (hub)
 */

import 'dotenv/config';
import { DepartmentTag, InventoryItemType, Prisma, SupplierPaymentTerms, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashPassword, hashPin } from '../utils/password';
import { createSeedSupplier } from './seed-supplier-helper';

const PASSWORD = 'password123';
const PIN = '1234';
const OPENING_REASON = 'Opening stock (rehearsal)';
const BRANCH_OPENING_REASON = 'Opening balance (rehearsal)';

const dec = (n: number): Prisma.Decimal => new Prisma.Decimal(n);

// ── Organizations & department locations ────────────────────────────────────

const DEPARTMENTS: { tag: DepartmentTag; name: string }[] = [
  { tag: 'KITCHEN', name: 'Kitchen' },
  { tag: 'PASTRY', name: 'Pastry' },
  { tag: 'BARISTA', name: 'Barista' },
  { tag: 'SERVICE', name: 'Service' },
  { tag: 'HOUSEKEEPING', name: 'Housekeeping' },
];

const ORGS = [
  { name: 'Wendo Central Kitchen', address: 'Ring Road, Nyeri', city: 'Nyeri', latitude: '-0.4197', longitude: '36.9489', isHub: true },
  { name: 'Nyeri Town', address: 'Kimathi Way, Nyeri Town', city: 'Nyeri', latitude: '-0.4225', longitude: '36.9515', isHub: false },
  { name: 'Nyeri Highway', address: 'Nyeri-Nairobi Highway', city: 'Nyeri', latitude: '-0.4381', longitude: '36.9601', isHub: false },
];

// ── People ──────────────────────────────────────────────────────────────────

interface PersonSpec {
  email: string;
  name: string;
  role: UserRole;
  org: string;
  head?: DepartmentTag;
}

const HUB = 'Wendo Central Kitchen';
const PEOPLE: PersonSpec[] = [
  { email: 'store.manager@wendo.test', name: 'Grace Wanjiku (Store Manager)', role: 'STORE_MANAGER', org: HUB },
  { email: 'store.attendant@wendo.test', name: 'Peter Mwangi (Store Attendant)', role: 'STORE_ATTENDANT', org: HUB },
  { email: 'bm.town@wendo.test', name: 'Faith Njeri (BM Nyeri Town)', role: 'MANAGER', org: 'Nyeri Town' },
  { email: 'bm.highway@wendo.test', name: 'James Kariuki (BM Nyeri Highway)', role: 'MANAGER', org: 'Nyeri Highway' },
  { email: 'kitchen.head.town@wendo.test', name: 'Kelvin Kings (Kitchen head, Town)', role: 'CHEF', org: 'Nyeri Town', head: 'KITCHEN' },
  { email: 'barista.head.town@wendo.test', name: 'Victor Maina (Barista head, Town)', role: 'BARISTA', org: 'Nyeri Town', head: 'BARISTA' },
  { email: 'kitchen.head.highway@wendo.test', name: 'Susan Wairimu (Kitchen head, Highway)', role: 'CHEF', org: 'Nyeri Highway', head: 'KITCHEN' },
  { email: 'accountant@wendo.test', name: 'Anne Muthoni (Accountant)', role: 'ACCOUNTANT', org: HUB },
  { email: 'director@wendo.test', name: 'Wendo Director', role: 'DIRECTOR', org: HUB },
];

// ── Categories ──────────────────────────────────────────────────────────────

/** [name, parent name | null] — parents first. */
const CATEGORIES: [string, string | null][] = [
  ['Prep Kitchen Items', null],
  ['Chicken', 'Prep Kitchen Items'],
  ['Beef', 'Prep Kitchen Items'],
  ['Pork', 'Prep Kitchen Items'],
  ['Fish', 'Prep Kitchen Items'],
  ['Market Items', null],
  ['Dry Items', null],
  ['Dairy & Eggs', null],
  ['Coffee & Beverages', null],
  ['Packaging & Disposables', null],
  ['Cleaning & Housekeeping', null],
];

// ── Suppliers ───────────────────────────────────────────────────────────────

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
  { name: 'Nyeri Butchery', contactName: 'Joseph Kimani', phone: '0700 118 340', location: 'Nyeri town', terms: 'PAY_NOW', paymentDays: 0 },
  { name: 'Karatina Fresh Produce', contactName: 'Lucy Wanjiru', phone: '0733 918 204', location: 'Karatina market', terms: 'PAY_NOW', paymentDays: 0 },
  { name: 'Nyeri Dairy Cooperative', contactName: 'Samuel Ngugi', phone: '0711 602 887', location: 'Nyeri town', terms: 'INVOICE_TO_FOLLOW', paymentDays: 30 },
  { name: 'Samrat Supermarket Ltd', contactName: 'Dattu', phone: '+254722160400', location: 'Nyeri town', terms: 'INVOICE_TO_FOLLOW', paymentDays: 14 },
  { name: 'Summer Limited', contactName: 'Summer Ltd Accounts', phone: '+254722204970', location: 'Nyeri town', terms: 'INVOICE_TO_FOLLOW', paymentDays: 30 },
  { name: 'Highland Coffee Roasters', contactName: 'Mary Gathoni', phone: '0724 553 190', location: 'Mathira', terms: 'INVOICE_TO_FOLLOW', paymentDays: 30 },
];

// ── Catalog ─────────────────────────────────────────────────────────────────

const KIT: DepartmentTag[] = ['KITCHEN'];
const BAR: DepartmentTag[] = ['BARISTA'];
const SVC: DepartmentTag[] = ['SERVICE'];
const HSK: DepartmentTag[] = ['HOUSEKEEPING'];

interface ItemSpec {
  name: string;
  type: InventoryItemType;
  category: string;
  supplier?: string;
  buyUnit: string;
  usageUnit: string;
  /** usage units per buy unit; null when they are the same thing. */
  conv: number | null;
  /** standard cost, KES per usage unit — a later receipt above this trips the price alert. */
  cost: number;
  tags: DepartmentTag[];
  /** Central Store opening stock, usage units. */
  open: number;
  /** Central Store restock level, usage units (omit for prepped items — made, not bought). */
  level?: number;
  /** Department restock level (Nyeri Town; Highway gets half) for the tagged departments. */
  deptLevel?: number;
}

const raw = (
  name: string, category: string, supplier: string | undefined, buyUnit: string, usageUnit: string,
  conv: number | null, cost: number, open: number, level: number,
): ItemSpec => ({ name, type: 'RAW_INGREDIENT', category, supplier, buyUnit, usageUnit, conv, cost, tags: [], open, level });

const stocked = (
  name: string, category: string, supplier: string | undefined, buyUnit: string, usageUnit: string,
  conv: number | null, cost: number, tags: DepartmentTag[], open: number, level: number, deptLevel: number,
): ItemSpec => ({ name, type: 'STOCKED', category, supplier, buyUnit, usageUnit, conv, cost, tags, open, level, deptLevel });

const prepped = (name: string, category: string, usageUnit: string, tags: DepartmentTag[], deptLevel: number): ItemSpec => ({
  name, type: 'PREPPED', category, buyUnit: usageUnit, usageUnit, conv: 1, cost: 0, tags, open: 0, deptLevel,
});

const ITEMS: ItemSpec[] = [
  // Prep Kitchen Items — Chicken
  raw('Chicken breast (raw)', 'Chicken', 'Kagumo Poultry Farm', 'tray (5kg)', 'kg', 5, 620, 40, 50),
  raw('Chicken thighs (raw)', 'Chicken', 'Kagumo Poultry Farm', 'tray (5kg)', 'kg', 5, 480, 30, 40),
  raw('Chicken wings (raw)', 'Chicken', 'Kagumo Poultry Farm', 'kg', 'kg', null, 450, 20, 25),
  // Beef
  raw('Beef fillet', 'Beef', 'Nyeri Butchery', 'kg', 'kg', null, 1100, 12, 15),
  raw('Minced beef', 'Beef', 'Nyeri Butchery', 'kg', 'kg', null, 750, 25, 30),
  raw('Beef stewing cuts', 'Beef', 'Nyeri Butchery', 'kg', 'kg', null, 780, 18, 20),
  // Pork
  raw('Pork belly', 'Pork', 'Nyeri Butchery', 'kg', 'kg', null, 700, 15, 20),
  raw('Pork ribs', 'Pork', 'Nyeri Butchery', 'kg', 'kg', null, 780, 10, 15),
  raw('Bacon (raw)', 'Pork', 'Nyeri Butchery', 'pkt (1kg)', 'kg', 1, 1100, 8, 10),
  // Fish
  raw('Tilapia fillet', 'Fish', 'Nyeri Butchery', 'kg', 'kg', null, 900, 10, 12),
  raw('Nile perch fillet', 'Fish', 'Nyeri Butchery', 'kg', 'kg', null, 1000, 8, 10),
  raw('Whole tilapia', 'Fish', 'Nyeri Butchery', 'kg', 'kg', null, 550, 12, 15),
  // Market Items
  raw('Potatoes', 'Market Items', 'Karatina Fresh Produce', 'sack (50kg)', 'kg', 50, 55, 100, 120),
  raw('Tomatoes', 'Market Items', 'Karatina Fresh Produce', 'crate (25kg)', 'kg', 25, 90, 30, 40),
  raw('Onions', 'Market Items', 'Karatina Fresh Produce', 'net (10kg)', 'kg', 10, 110, 30, 40),
  raw('Carrots', 'Market Items', 'Karatina Fresh Produce', 'kg', 'kg', null, 90, 15, 20),
  raw('Lettuce', 'Market Items', 'Karatina Fresh Produce', 'pc', 'pc', null, 50, 20, 25),
  raw('Garlic', 'Market Items', 'Karatina Fresh Produce', 'net (5kg)', 'kg', 5, 380, 10, 12),
  raw('Lemons', 'Market Items', 'Karatina Fresh Produce', 'crate (100pcs)', 'pcs', 100, 12, 300, 250),
  raw('Avocados', 'Market Items', 'Karatina Fresh Produce', 'crate (40pcs)', 'pcs', 40, 35, 80, 100),
  raw('Capsicum', 'Market Items', 'Karatina Fresh Produce', 'kg', 'kg', null, 200, 8, 10),
  // Dry Items
  raw('Wheat flour', 'Dry Items', 'Summer Limited', 'bag (24kg)', 'kg', 24, 105, 120, 100),
  raw('Sugar', 'Dry Items', 'Samrat Supermarket Ltd', 'sack (50kg)', 'kg', 50, 155, 100, 80),
  raw('Cooking oil', 'Dry Items', 'Summer Limited', 'jerrican (20L)', 'L', 20, 260, 60, 40),
  raw('Rice (pishori)', 'Dry Items', 'Samrat Supermarket Ltd', 'bag (25kg)', 'kg', 25, 180, 75, 50),
  raw('Instant yeast', 'Dry Items', 'Samrat Supermarket Ltd', 'pouch (500g)', 'kg', 0.5, 700, 4, 3),
  raw('Chilli sauce sachets', 'Dry Items', 'Summer Limited', 'ctn (300 sachets)', 'sachet', 300, 3, 900, 600),
  // Dairy & Eggs (issued straight to departments)
  stocked('Fresh milk', 'Dairy & Eggs', 'Nyeri Dairy Cooperative', 'crate (12L)', 'L', 12, 75, ['BARISTA', 'KITCHEN'], 96, 120, 24),
  stocked('Eggs', 'Dairy & Eggs', 'Nyeri Dairy Cooperative', 'tray (30)', 'pcs', 30, 17, ['KITCHEN', 'PASTRY'], 180, 150, 60),
  stocked('Butter', 'Dairy & Eggs', 'Nyeri Dairy Cooperative', 'box (10kg)', 'kg', 10, 620, ['KITCHEN', 'PASTRY'], 20, 15, 3),
  stocked('Mozzarella cheese', 'Dairy & Eggs', 'Nyeri Dairy Cooperative', 'block (2kg)', 'kg', 2, 1400, KIT, 10, 8, 3),
  stocked('Fresh cream', 'Dairy & Eggs', 'Nyeri Dairy Cooperative', 'L', 'L', null, 450, ['BARISTA', 'KITCHEN'], 12, 10, 2),
  // Coffee & Beverages
  stocked('Coffee beans (house blend)', 'Coffee & Beverages', 'Highland Coffee Roasters', 'bag (5kg)', 'kg', 5, 1800, BAR, 25, 30, 6),
  stocked('Chocolate powder', 'Coffee & Beverages', 'Samrat Supermarket Ltd', 'tin (2kg)', 'kg', 2, 900, BAR, 8, 6, 2),
  stocked('Tea leaves', 'Coffee & Beverages', 'Samrat Supermarket Ltd', 'pkt (500g)', 'kg', 0.5, 700, BAR, 6, 5, 1),
  raw('Vanilla essence', 'Coffee & Beverages', 'Samrat Supermarket Ltd', 'bottle (1L)', 'L', 1, 2200, 4, 3),
  stocked('Highland water 1L', 'Coffee & Beverages', 'Summer Limited', 'ctn (12)', 'bottle', 12, 45, SVC, 96, 72, 24),
  // Packaging & Disposables
  stocked('Takeaway cups 8oz', 'Packaging & Disposables', 'Summer Limited', 'ctn (1000)', 'pcs', 1000, 6, ['BARISTA', 'SERVICE'], 3000, 2000, 400),
  stocked('Cup lids 8oz', 'Packaging & Disposables', 'Summer Limited', 'ctn (1000)', 'pcs', 1000, 2, ['BARISTA', 'SERVICE'], 3000, 2000, 400),
  stocked('Paper straws', 'Packaging & Disposables', 'Summer Limited', 'pkt (250)', 'pcs', 250, 1.5, SVC, 1500, 1000, 250),
  stocked('Serviettes', 'Packaging & Disposables', 'Summer Limited', 'ctn', 'pack', null, 180, SVC, 40, 30, 8),
  stocked('Takeaway containers', 'Packaging & Disposables', 'Summer Limited', 'ctn (200)', 'pcs', 200, 12, KIT, 600, 400, 100),
  stocked('Cling film roll', 'Packaging & Disposables', 'Samrat Supermarket Ltd', 'roll', 'roll', 1, 950, KIT, 12, 8, 2),
  stocked('Foil roll', 'Packaging & Disposables', 'Samrat Supermarket Ltd', 'roll', 'roll', 1, 780, KIT, 10, 6, 2),
  // Cleaning & Housekeeping
  stocked('Multipurpose soap', 'Cleaning & Housekeeping', 'Summer Limited', 'ctn (10kg)', 'kg', 10, 190, HSK, 30, 20, 5),
  stocked('Toilet tissue', 'Cleaning & Housekeeping', 'Summer Limited', 'ctn (10 pack)', 'pack', 10, 380, HSK, 50, 40, 10),
  stocked('Air freshener', 'Cleaning & Housekeeping', 'Samrat Supermarket Ltd', 'can', 'can', 1, 420, HSK, 15, 10, 3),
  stocked('Dish liquid', 'Cleaning & Housekeeping', 'Samrat Supermarket Ltd', 'jerrican (5L)', 'L', 5, 240, ['KITCHEN', 'HOUSEKEEPING'], 20, 15, 5),
  stocked('Bin liners', 'Cleaning & Housekeeping', 'Samrat Supermarket Ltd', 'roll', 'roll', 1, 120, ['KITCHEN', 'HOUSEKEEPING'], 40, 30, 8),
  // Prepped in the Central Store (made by Prep runs — no stock, no supplier)
  prepped('Marinated chicken breast', 'Chicken', 'kg', KIT, 8),
  prepped('Marinated chicken thighs', 'Chicken', 'kg', KIT, 6),
  prepped('Seasoned beef mince', 'Beef', 'kg', KIT, 5),
  prepped('Vanilla syrup (house)', 'Coffee & Beverages', 'L', BAR, 2),
  prepped('Caramel syrup (house)', 'Coffee & Beverages', 'L', BAR, 2),
];

/** Branch opening balance: Nyeri Town Kitchen. Everything else arrives by dispatch during the walk. */
const TOWN_KITCHEN_OPENING: { item: string; qty: number }[] = [
  { item: 'Eggs', qty: 60 },
  { item: 'Fresh milk', qty: 12 },
  { item: 'Cling film roll', qty: 2 },
  { item: 'Butter', qty: 3 },
];

// ── Run ─────────────────────────────────────────────────────────────────────

const assertLocalDatabase = (): void => {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to run in production.');
  if (process.env.REHEARSAL_SEED_CONFIRM !== 'YES') throw new Error('Set REHEARSAL_SEED_CONFIRM=YES to run this seed.');
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('DATABASE_URL is not a local database — refusing.');
};

const run = async (): Promise<void> => {
  assertLocalDatabase();

  // 1. Organizations + locations
  const company =
    (await prisma.company.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })) ??
    (await prisma.company.create({ data: { name: 'Wendo Coffee Bistro' } }));
  const orgId = new Map<string, string>();
  for (const spec of ORGS) {
    const found = await prisma.site.findFirst({ where: { name: spec.name } });
    const row =
      found ??
      (await prisma.site.create({
        data: { ...spec, companyId: company.id, type: spec.isHub ? 'CENTRAL_STORE' : 'BRANCH', isActive: true },
      }));
    orgId.set(spec.name, row.id);
  }
  const hubId = orgId.get(HUB)!;

  const centralExisting = await prisma.location.findFirst({ where: { siteId: hubId, type: 'CENTRAL_STORE' } });
  const central = centralExisting ?? (await prisma.location.create({ data: { siteId: hubId, type: 'CENTRAL_STORE', name: 'Central Store' } }));

  const deptLoc = new Map<string, string>(); // `${org}|${tag}` → location id
  for (const org of ORGS.filter((o) => !o.isHub)) {
    for (const dept of DEPARTMENTS) {
      const where = { siteId_type_departmentTag: { siteId: orgId.get(org.name)!, type: 'BRANCH_DEPARTMENT' as const, departmentTag: dept.tag } };
      const found = await prisma.location.findUnique({ where });
      const row =
        found ??
        (await prisma.location.create({
          data: { siteId: orgId.get(org.name)!, type: 'BRANCH_DEPARTMENT', departmentTag: dept.tag, name: `${org.name} — ${dept.name}` },
        }));
      deptLoc.set(`${org.name}|${dept.tag}`, row.id);
    }
  }

  // 2. People
  const passwordHash = await hashPassword(PASSWORD);
  const pinHash = await hashPin(PIN);
  const userId = new Map<string, string>();
  for (const p of PEOPLE) {
    const found = await prisma.user.findUnique({ where: { email: p.email }, select: { id: true } });
    const row =
      found ??
      (await prisma.user.create({
        data: {
          email: p.email,
          name: p.name,
          role: p.role,
          siteId: orgId.get(p.org)!,
          passwordHash,
          pinHash,
          isActive: true,
          isDepartmentHead: p.head !== undefined,
          departmentTag: p.head ?? null,
        },
        select: { id: true },
      }));
    userId.set(p.email, row.id);
  }
  const storeManagerId = userId.get('store.manager@wendo.test')!;
  const directorId = userId.get('director@wendo.test')!;

  // 3. Categories
  const categoryId = new Map<string, string>();
  for (const [name, parent] of CATEGORIES) {
    const found = await prisma.category.findFirst({ where: { siteId: hubId, name, deletedAt: null }, select: { id: true } });
    const row =
      found ??
      (await prisma.category.create({
        data: { siteId: hubId, name, parentCategoryId: parent ? categoryId.get(parent) : undefined },
        select: { id: true },
      }));
    categoryId.set(name, row.id);
  }

  // 4. Suppliers
  const supplierId = new Map<string, string>();
  for (const s of SUPPLIERS) {
    const found = await prisma.supplier.findFirst({ where: { siteId: hubId, name: s.name, deletedAt: null }, select: { id: true } });
    const row =
      found ??
      (await createSeedSupplier(prisma, {
        siteId: hubId, name: s.name, contactName: s.contactName, phone: s.phone, location: s.location,
        defaultPaymentTerms: s.terms, paymentDays: s.paymentDays,
      }));
    supplierId.set(s.name, row.id);
  }

  // 5. Items, Central Store opening stock, restock levels
  const itemId = new Map<string, string>();
  let openingRows = 0;
  let levels = 0;
  for (const spec of ITEMS) {
    const found = await prisma.inventoryItem.findFirst({ where: { siteId: hubId, name: spec.name, deletedAt: null }, select: { id: true } });
    const row =
      found ??
      (await prisma.inventoryItem.create({
        data: {
          siteId: hubId,
          name: spec.name,
          type: spec.type,
          categoryId: categoryId.get(spec.category),
          preferredSupplierId: spec.supplier ? supplierId.get(spec.supplier) : undefined,
          buyUnit: spec.buyUnit,
          usageUnit: spec.usageUnit,
          conversionFactor: spec.conv === null ? null : dec(spec.conv),
          departmentTags: spec.tags,
          currentCost: dec(spec.cost),
        },
        select: { id: true },
      }));
    itemId.set(spec.name, row.id);

    if (!found && spec.open > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          siteId: hubId, locationId: central.id, inventoryItemId: row.id, type: 'RECEIVE',
          quantity: dec(spec.open), unitCost: dec(spec.cost), reason: OPENING_REASON, userId: storeManagerId,
        },
      });
      openingRows++;
    }

    if (spec.level !== undefined) {
      await prisma.restockLevel.upsert({
        where: { locationId_inventoryItemId: { locationId: central.id, inventoryItemId: row.id } },
        update: {},
        create: { siteId: hubId, locationId: central.id, inventoryItemId: row.id, level: dec(spec.level), setById: storeManagerId },
      });
      levels++;
    }

    if (spec.deptLevel !== undefined) {
      for (const [branch, factor] of [['Nyeri Town', 1], ['Nyeri Highway', 0.5]] as const) {
        for (const tag of spec.tags) {
          const locationId = deptLoc.get(`${branch}|${tag}`)!;
          await prisma.restockLevel.upsert({
            where: { locationId_inventoryItemId: { locationId, inventoryItemId: row.id } },
            update: {},
            create: {
              siteId: orgId.get(branch)!, locationId, inventoryItemId: row.id,
              level: dec(Math.max(1, Math.round(spec.deptLevel * factor))), setById: storeManagerId,
            },
          });
          levels++;
        }
      }
    }
  }

  // 6. Branch opening balance — Nyeri Town Kitchen (DISPATCH_IN without a dispatch line, as the dev fixtures do)
  const townKitchen = deptLoc.get('Nyeri Town|KITCHEN')!;
  let branchRows = 0;
  for (const o of TOWN_KITCHEN_OPENING) {
    const id = itemId.get(o.item)!;
    const already = await prisma.inventoryTransaction.findFirst({
      where: { locationId: townKitchen, inventoryItemId: id, reason: BRANCH_OPENING_REASON },
      select: { id: true },
    });
    if (already) continue;
    const spec = ITEMS.find((i) => i.name === o.item)!;
    await prisma.inventoryTransaction.create({
      data: {
        siteId: orgId.get('Nyeri Town')!, locationId: townKitchen, inventoryItemId: id, type: 'DISPATCH_IN',
        quantity: dec(o.qty), unitCost: dec(spec.cost), reason: BRANCH_OPENING_REASON, userId: userId.get('bm.town@wendo.test')!,
      },
    });
    branchRows++;
  }

  // 7. Counting thresholds — set low enough that scripted variances cross them.
  //    Hub row: Store Manager reason threshold + Director company-wide alert.
  //    Branch rows: Branch Manager reason threshold + overnight alert.
  await prisma.countingThresholds.upsert({
    where: { siteId: hubId },
    update: {},
    create: {
      siteId: hubId, reasonRequiredKes: 300, directorAlertKes: 1500,
      updatedById: storeManagerId, directorUpdatedById: directorId, directorUpdatedAt: new Date(),
    },
  });
  for (const [branch, bm] of [['Nyeri Town', 'bm.town@wendo.test'], ['Nyeri Highway', 'bm.highway@wendo.test']] as const) {
    await prisma.countingThresholds.upsert({
      where: { siteId: orgId.get(branch)! },
      update: {},
      create: { siteId: orgId.get(branch)!, reasonRequiredKes: 400, overnightAlertKes: 300, updatedById: userId.get(bm)! },
    });
  }

  console.log(
    `Rehearsal reference data ready: ${orgId.size} orgs, ${PEOPLE.length} people, ${categoryId.size} categories, ` +
      `${supplierId.size} suppliers, ${itemId.size} items, ${openingRows} store opening rows, ${branchRows} branch opening rows, ${levels} restock levels.`,
  );
  console.log(`Logins: password "${PASSWORD}", PIN "${PIN}" — see the file header for the email list.`);
};

run()
  .catch((error: unknown) => {
    console.error('seed-rehearsal-reference failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
