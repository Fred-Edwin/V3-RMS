/**
 * seed-inventory-demo.ts
 *
 * Central Store demo/Gate-trial data — real catalog items, quantities, and
 * prices transcribed from the client's own supplier paperwork (Session 9,
 * `docs/context/INVENTORY-FEATURE/inventory-real-data/`, images 1-9: two
 * Samrat Supermarket deliveries dated 07-Jul-2026 and 21-Jul-2026, plus one
 * Summer Limited delivery dated 16-Jul-2026). Images 10+ are branch/
 * departmental sheets (Phase 2 scope) and were not used.
 *
 * The client's paperwork covers dry goods/consumables only — no meat/dairy
 * supplier invoice was in the photo set even though one exists in real life
 * (see CLAUDE.md). "Nyeri Fresh Meat & Dairy" below is an INVENTED
 * placeholder supplier + a handful of RAW items/prices, needed so Prep
 * entry (which consumes RAW inputs to produce a PREPPED output) has
 * something realistic to run against. Everything under SAMRAT_ITEMS and
 * SUMMER_ITEMS is real client data; everything under PLACEHOLDER_RAW_ITEMS
 * is not — swap for the real invoice once available.
 *
 * Exercises the full Phase 1 data shape, not just a flat catalog:
 *   - Two receiving events per Samrat item that appears in both deliveries
 *     (07-Jul then 21-Jul), at the real different prices, so weighted-
 *     average cost and price-history reports have genuine multi-point data.
 *   - One PREPPED item ("Prepped Simple Syrup", from Sugar + Water) with an
 *     initial PrepRecord, so the rolling-average hint has history to show
 *     on a second run.
 *   - A DRAFT and a SENT PurchaseOrder (not just closed/received ones), so
 *     the PO list isn't all-one-status.
 *   - A separate opening StockCount session (APPROVED, with deliberate
 *     gaps) distinct from received quantities, so the count/adjustment
 *     workflow has real variance to show, not a trivially-zero one.
 *   - A WasteLog entry and a SupplierInvoice with a partial payment, so AP
 *     aging and waste-cost reports aren't empty.
 *
 * ONLY runs when NODE_ENV is not "production". Safe to re-run — idempotent
 * on items/suppliers (upsert by name); POs/receiving/prep/count/waste/AP
 * events are only created on first run per item (guarded by "item already
 * existed" checks), so re-running after the first time is a no-op, not a
 * duplicate-data generator.
 *
 * Usage:
 *   npx tsx src/scripts/seed-inventory-demo.ts
 */

import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { inventoryTransactionService } from '../services/inventory-transaction-service';
import { stockCountService } from '../services/stock-count-service';
import { wasteLogService } from '../services/waste-log-service';
import { supplierInvoiceService } from '../services/supplier-invoice-service';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-inventory-demo must not run in production. Exiting.');
  process.exit(1);
}

type ItemType = 'RAW' | 'PREPPED' | 'PASS_THROUGH';
type DeptTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

type ItemSpec = {
  name: string;
  type: ItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: DeptTag[];
  supplier: string;
};

/** Real data — Samrat Supermarket (pantry/consumables), both delivery dates. */
const SAMRAT_ITEMS: ItemSpec[] = [
  { name: 'Salit Cooking Oil', type: 'RAW', buyUnit: '20L jerrican', usageUnit: 'L', conversionFactor: '20', reorderLevel: '40', departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket' },
  { name: 'Kabras Sugar', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '100', departmentTags: ['KITCHEN', 'BARISTA'], supplier: 'Samrat Supermarket' },
  { name: 'Prestige Margarine', type: 'RAW', buyUnit: '10kg box', usageUnit: 'kg', conversionFactor: '10', reorderLevel: '20', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Samrat Supermarket' },
  { name: 'Chain Kwo Soy Sauce Dark 623ml', type: 'RAW', buyUnit: 'bottle (623ml)', usageUnit: 'ml', conversionFactor: '623', reorderLevel: '2500', departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket' },
  { name: 'Kamal Gram Flour', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '10', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Samrat Supermarket' },
  { name: 'Clovers Brown Sugar', type: 'RAW', buyUnit: 'kg pkt', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '15', departmentTags: ['KITCHEN', 'BARISTA'], supplier: 'Samrat Supermarket' },
  { name: 'Angel Instant Dry Yeast 500g', type: 'RAW', buyUnit: 'pouch (500g)', usageUnit: 'g', conversionFactor: '500', reorderLevel: '1000', departmentTags: ['PASTRY'], supplier: 'Samrat Supermarket' },
  { name: 'Gathuthi Tea Leaves 500g', type: 'RAW', buyUnit: 'pkt (500g)', usageUnit: 'g', conversionFactor: '500', reorderLevel: '1500', departmentTags: ['BARISTA'], supplier: 'Samrat Supermarket' },
  { name: 'BSD Natural Yoghurt Cup 450ml', type: 'RAW', buyUnit: 'cup (450ml)', usageUnit: 'ml', conversionFactor: '450', reorderLevel: '900', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Samrat Supermarket' },
  { name: 'Zesta Yellow Mustard 240g', type: 'RAW', buyUnit: 'bottle (240g)', usageUnit: 'g', conversionFactor: '240', reorderLevel: '720', departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket' },
  { name: 'Zesta Eggless Mayonnaise 340g', type: 'RAW', buyUnit: 'bottle (340g)', usageUnit: 'g', conversionFactor: '340', reorderLevel: '680', departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket' },
  { name: 'S/Garden Whole Mushroom 400g', type: 'RAW', buyUnit: 'pkt (400g)', usageUnit: 'g', conversionFactor: '400', reorderLevel: '1600', departmentTags: ['KITCHEN'], supplier: 'Samrat Supermarket' },
  { name: 'Royal Cling Film 30x300m', type: 'PASS_THROUGH', buyUnit: 'roll', usageUnit: 'roll', conversionFactor: '1', reorderLevel: '5', departmentTags: ['KITCHEN', 'SERVICE'], supplier: 'Samrat Supermarket' },
  { name: 'Rubina Air Freshener 100ml Strawberry', type: 'PASS_THROUGH', buyUnit: 'can', usageUnit: 'can', conversionFactor: '1', reorderLevel: '6', departmentTags: ['HOUSEKEEPING'], supplier: 'Samrat Supermarket' },
];

/** Real data — Summer Limited (bulk/butchery/cleaning supplies). */
const SUMMER_ITEMS: ItemSpec[] = [
  { name: '210 Home Baking Flour 2kg', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '15', departmentTags: ['PASTRY'], supplier: 'Summer Limited' },
  { name: 'Golden Drop Oil 20ltr', type: 'RAW', buyUnit: '20L jerrican', usageUnit: 'L', conversionFactor: '20', reorderLevel: '40', departmentTags: ['KITCHEN'], supplier: 'Summer Limited' },
  { name: 'Highlands Water 1ltr', type: 'PASS_THROUGH', buyUnit: 'ctn (12x1L)', usageUnit: 'bottle', conversionFactor: '12', reorderLevel: '48', departmentTags: ['SERVICE'], supplier: 'Summer Limited' },
  { name: 'Toilex White Tissue Wrapped', type: 'PASS_THROUGH', buyUnit: 'ctn (10pack)', usageUnit: 'pack', conversionFactor: '10', reorderLevel: '10', departmentTags: ['HOUSEKEEPING'], supplier: 'Summer Limited' },
  { name: 'Meta Multipurpose Soap 1kg', type: 'PASS_THROUGH', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '5', departmentTags: ['HOUSEKEEPING'], supplier: 'Summer Limited' },
  { name: 'Mariandazi 100g', type: 'PASS_THROUGH', buyUnit: 'box (72x100g)', usageUnit: 'pc', conversionFactor: '72', reorderLevel: '72', departmentTags: ['SERVICE'], supplier: 'Summer Limited' },
];

/**
 * INVENTED placeholder — no meat/dairy invoice was in the photo set (see
 * file header). Swap for the real supplier's paperwork when available.
 */
const PLACEHOLDER_RAW_ITEMS: ItemSpec[] = [
  { name: 'Fresh Milk', type: 'RAW', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '20', departmentTags: ['BARISTA', 'KITCHEN'], supplier: 'Nyeri Fresh Meat & Dairy' },
  { name: 'Chicken Breast', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '10', departmentTags: ['KITCHEN'], supplier: 'Nyeri Fresh Meat & Dairy' },
  { name: 'Fresh Eggs (Tray of 30)', type: 'RAW', buyUnit: 'tray (30pc)', usageUnit: 'pc', conversionFactor: '30', reorderLevel: '90', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Nyeri Fresh Meat & Dairy' },
];

/** One PREPPED item so Prep entry / rolling-average has something to run against. */
const PREPPED_ITEMS: ItemSpec[] = [
  { name: 'Prepped Simple Syrup', type: 'PREPPED', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '3', departmentTags: ['BARISTA'], supplier: '' },
];

const SUPPLIERS: { name: string; contactName: string; phone: string; email: string }[] = [
  { name: 'Samrat Supermarket', contactName: 'Dattu', phone: '0722160400', email: 'samratnyeri@gmail.com' },
  { name: 'Summer Limited', contactName: 'Summer Ltd Accounts', phone: '0722204970', email: 'info@summerltd.com' },
  { name: 'Nyeri Fresh Meat & Dairy', contactName: 'Store Contact (placeholder)', phone: '0700000000', email: 'orders@nyerifreshmeatdairy.example' },
];

/** [buyQty, unitPrice] per delivery date, real prices from the two Samrat deliveries. */
const SAMRAT_RECEIVE_HISTORY: Record<string, { date: string; buyQty: string; unitPrice: string }[]> = {
  'Salit Cooking Oil': [{ date: '2026-07-07', buyQty: '1', unitPrice: '5249' }],
  'Kabras Sugar': [{ date: '2026-07-21', buyQty: '50', unitPrice: '155' }],
  'Prestige Margarine': [
    { date: '2026-07-07', buyQty: '2', unitPrice: '3095' },
    { date: '2026-07-21', buyQty: '2', unitPrice: '3095' },
  ],
  'Chain Kwo Soy Sauce Dark 623ml': [
    { date: '2026-07-07', buyQty: '8', unitPrice: '365' },
    { date: '2026-07-21', buyQty: '12', unitPrice: '365' },
  ],
  'Kamal Gram Flour': [
    { date: '2026-07-07', buyQty: '3', unitPrice: '259' },
    { date: '2026-07-21', buyQty: '2', unitPrice: '219' },
  ],
  'Clovers Brown Sugar': [
    { date: '2026-07-07', buyQty: '4', unitPrice: '235' },
    { date: '2026-07-21', buyQty: '4', unitPrice: '235' },
  ],
  'Angel Instant Dry Yeast 500g': [
    { date: '2026-07-07', buyQty: '1', unitPrice: '415' },
    { date: '2026-07-21', buyQty: '3', unitPrice: '415' },
  ],
  'Gathuthi Tea Leaves 500g': [
    { date: '2026-07-07', buyQty: '5', unitPrice: '275' },
    { date: '2026-07-21', buyQty: '6', unitPrice: '275' },
  ],
  'BSD Natural Yoghurt Cup 450ml': [
    { date: '2026-07-07', buyQty: '2', unitPrice: '170' },
    { date: '2026-07-21', buyQty: '2', unitPrice: '170' },
  ],
  'Zesta Yellow Mustard 240g': [
    { date: '2026-07-07', buyQty: '3', unitPrice: '185' },
    { date: '2026-07-21', buyQty: '5', unitPrice: '185' },
  ],
  'Zesta Eggless Mayonnaise 340g': [
    { date: '2026-07-07', buyQty: '4', unitPrice: '255' },
    { date: '2026-07-21', buyQty: '4', unitPrice: '255' },
  ],
  'S/Garden Whole Mushroom 400g': [
    { date: '2026-07-07', buyQty: '2', unitPrice: '255' },
    { date: '2026-07-21', buyQty: '6', unitPrice: '255' },
  ],
  'Royal Cling Film 30x300m': [
    { date: '2026-07-07', buyQty: '6', unitPrice: '699' },
    { date: '2026-07-21', buyQty: '8', unitPrice: '699' },
  ],
  'Rubina Air Freshener 100ml Strawberry': [
    { date: '2026-07-07', buyQty: '8', unitPrice: '135' },
    { date: '2026-07-21', buyQty: '5', unitPrice: '135' },
  ],
};

const SUMMER_RECEIVE_HISTORY: Record<string, { date: string; buyQty: string; unitPrice: string }[]> = {
  '210 Home Baking Flour 2kg': [{ date: '2026-07-16', buyQty: '3', unitPrice: '1870' }],
  'Golden Drop Oil 20ltr': [{ date: '2026-07-16', buyQty: '3', unitPrice: '4900' }],
  'Highlands Water 1ltr': [{ date: '2026-07-16', buyQty: '2', unitPrice: '380' }],
  'Toilex White Tissue Wrapped': [{ date: '2026-07-16', buyQty: '2', unitPrice: '1190' }],
  'Meta Multipurpose Soap 1kg': [{ date: '2026-07-16', buyQty: '1', unitPrice: '1540' }],
  'Mariandazi 100g': [{ date: '2026-07-16', buyQty: '1', unitPrice: '1950' }],
};

const PLACEHOLDER_RECEIVE: Record<string, { date: string; buyQty: string; unitPrice: string }[]> = {
  'Fresh Milk': [{ date: '2026-07-20', buyQty: '30', unitPrice: '75' }],
  'Chicken Breast': [{ date: '2026-07-20', buyQty: '20', unitPrice: '480' }],
  'Fresh Eggs (Tray of 30)': [{ date: '2026-07-20', buyQty: '4', unitPrice: '450' }],
};

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

const poNumber = (suffix: string) => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `PO-${y}${m}${dd}-${suffix}`;
};

type ApPaymentSeed = {
  amount: string;
  method: 'MPESA' | 'CASH' | 'CARD';
  paidAt: string;
};

const run = async (): Promise<void> => {
  const storeManager = await prisma.user.findFirst({
    where: { role: 'STORE_MANAGER', organizationId: { not: null } },
    select: { id: true, organizationId: true, role: true },
  });
  if (!storeManager || !storeManager.organizationId) {
    throw new Error('No STORE_MANAGER user with an organizationId found. Run seed-dev.ts first.');
  }
  const storeAttendant = await prisma.user.findFirst({
    where: { role: 'STORE_ATTENDANT', organizationId: storeManager.organizationId },
    select: { id: true, organizationId: true, role: true },
  });
  if (!storeAttendant || !storeAttendant.organizationId) {
    throw new Error('No STORE_ATTENDANT user with an organizationId found. Run seed-dev.ts first.');
  }
  const organizationId = storeManager.organizationId;
  const managerActor = { id: storeManager.id, role: 'STORE_MANAGER' as const, organizationId };
  const attendantActor = { id: storeAttendant.id, role: 'STORE_ATTENDANT' as const, organizationId };

  const location = await prisma.location.findFirst({ where: { organizationId, type: 'CENTRAL_STORE' } });
  if (!location) {
    throw new Error('No CENTRAL_STORE location found. Run seed-dev.ts first.');
  }

  console.log(`Seeding real Central Store data for org ${organizationId}, location ${location.id}\n`);

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

  // --- Items + receive history (real dated events, populates on-hand qty + weighted-avg currentCost) ---
  const ALL_ITEMS = [...SAMRAT_ITEMS, ...SUMMER_ITEMS, ...PLACEHOLDER_RAW_ITEMS, ...PREPPED_ITEMS];
  const RECEIVE_HISTORY: Record<string, { date: string; buyQty: string; unitPrice: string }[]> = {
    ...SAMRAT_RECEIVE_HISTORY,
    ...SUMMER_RECEIVE_HISTORY,
    ...PLACEHOLDER_RECEIVE,
  };

  const itemIdByName = new Map<string, string>();
  const newlyCreated = new Set<string>();
  for (const spec of ALL_ITEMS) {
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
    if (!existing) newlyCreated.add(spec.name);
    console.log(`${existing ? 'SKIP ' : 'OK   '} Item: ${spec.name}`);

    if (!existing && spec.supplier) {
      const supplierId = supplierByName.get(spec.supplier);
      if (supplierId) {
        await prisma.supplierItem.upsert({
          where: { supplierId_inventoryItemId: { supplierId, inventoryItemId: item.id } },
          update: {},
          create: { organizationId, supplierId, inventoryItemId: item.id, isDefault: true },
        });
      }
    }

    if (!existing) {
      const history = RECEIVE_HISTORY[spec.name];
      if (history) {
        for (const event of history) {
          await inventoryTransactionService.recordReceive({
            organizationId,
            locationId: location.id,
            userId: storeManager.id,
            inventoryItemId: item.id,
            buyQty: d(event.buyQty),
            unitPrice: d(event.unitPrice),
          });
        }
      }
    }
  }

  // --- Prep record: Prepped Simple Syrup from Kabras Sugar (raw input, already received above) ---
  const syrupId = itemIdByName.get('Prepped Simple Syrup')!;
  const sugarId = itemIdByName.get('Kabras Sugar')!;
  if (newlyCreated.has('Prepped Simple Syrup')) {
    const prepRecord = await inventoryTransactionService.recordPrep({
      organizationId,
      locationId: location.id,
      outputItemId: syrupId,
      actualYield: d('9.5'),
      inputs: [{ inventoryItemId: sugarId, quantity: d('5') }],
      recordedById: storeAttendant.id,
    });
    console.log(`OK    Prep Record for Prepped Simple Syrup (yield ${prepRecord.actualYield?.toString() ?? '9.5'}L)`);
  }

  // --- Purchase orders across a few statuses (DRAFT + SENT, not just closed/received) ---
  const samratId = supplierByName.get('Samrat Supermarket')!;
  const summerId = supplierByName.get('Summer Limited')!;
  const dairyId = supplierByName.get('Nyeri Fresh Meat & Dairy')!;
  const marginId = itemIdByName.get('Prestige Margarine')!;
  const soySauceId = itemIdByName.get('Chain Kwo Soy Sauce Dark 623ml')!;
  const milkId = itemIdByName.get('Fresh Milk')!;
  const chickenId = itemIdByName.get('Chicken Breast')!;
  const flourId = itemIdByName.get('210 Home Baking Flour 2kg')!;
  const sugarIdForPo = itemIdByName.get('Kabras Sugar')!;
  const clingFilmId = itemIdByName.get('Royal Cling Film 30x300m')!;
  const oilId = itemIdByName.get('Golden Drop Oil 20ltr')!;

  const ensureClosedPurchaseOrder = async (
    suffix: string,
    supplierId: string,
    sentAt: string,
    lines: { inventoryItemId: string; qty: string; unitPrice: string }[],
  ) => {
    const number = poNumber(suffix);
    const existing = await prisma.purchaseOrder.findFirst({ where: { organizationId, poNumber: number } });
    if (existing) return existing;

    return prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId,
        locationId: location.id,
        poNumber: number,
        status: 'CLOSED',
        createdById: storeManager.id,
        sentAt: new Date(sentAt),
        closedAt: new Date(sentAt),
        lines: {
          create: lines.map((line) => ({
            organizationId,
            inventoryItemId: line.inventoryItemId,
            orderedQty: d(line.qty),
            unitPrice: d(line.unitPrice),
            receivedQty: d(line.qty),
            invoicePrice: d(line.unitPrice),
            receivedAt: new Date(sentAt),
          })),
        },
      },
    });
  };

  const ensureSupplierInvoice = async (
    input: {
      supplierId: string;
      purchaseOrderId?: string;
      referenceNumber: string;
      amount: string;
      invoiceDate: string;
      payments?: ApPaymentSeed[];
    },
  ) => {
    const existing = await prisma.supplierInvoice.findFirst({
      where: { organizationId, referenceNumber: input.referenceNumber },
      select: { id: true },
    });
    if (existing) {
      console.log(`SKIP  Supplier Invoice ${input.referenceNumber}`);
      return;
    }

    const invoice = await supplierInvoiceService.create(managerActor, {
      supplierId: input.supplierId,
      purchaseOrderId: input.purchaseOrderId,
      referenceNumber: input.referenceNumber,
      amount: input.amount,
      invoiceDate: new Date(input.invoiceDate).toISOString(),
    });
    for (const payment of input.payments ?? []) {
      await supplierInvoiceService.recordPayment(managerActor, invoice.id, {
        amount: payment.amount,
        method: payment.method,
        paidAt: new Date(payment.paidAt).toISOString(),
      });
    }
    console.log(`OK    Supplier Invoice ${input.referenceNumber} — ${input.payments?.length ? 'payment history added' : 'UNPAID'}`);
  };

  const existingDraft = await prisma.purchaseOrder.findFirst({ where: { organizationId, status: 'DRAFT' } });
  if (!existingDraft) {
    const draftPo = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: samratId,
        locationId: location.id,
        poNumber: poNumber('DRFT'),
        status: 'DRAFT',
        createdById: storeAttendant.id,
        lines: {
          create: [
            { organizationId, inventoryItemId: marginId, orderedQty: d('2'), unitPrice: d('3095') },
            { organizationId, inventoryItemId: soySauceId, orderedQty: d('10'), unitPrice: d('365') },
          ],
        },
      },
    });
    console.log(`OK    Purchase Order ${draftPo.poNumber} — DRAFT (Attendant-created, awaiting Manager send)`);
  }

  const existingSent = await prisma.purchaseOrder.findFirst({ where: { organizationId, status: 'SENT' } });
  if (!existingSent) {
    const sentPo = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: dairyId,
        locationId: location.id,
        poNumber: poNumber('SENT'),
        status: 'SENT',
        createdById: storeManager.id,
        sentAt: new Date(),
        lines: {
          create: [
            { organizationId, inventoryItemId: milkId, orderedQty: d('40'), unitPrice: d('75') },
            { organizationId, inventoryItemId: chickenId, orderedQty: d('15'), unitPrice: d('480') },
          ],
        },
      },
    });
    console.log(`OK    Purchase Order ${sentPo.poNumber} — SENT (ready for a live Receiving walkthrough)`);
  }

  let summerClosedPo = await prisma.purchaseOrder.findFirst({ where: { organizationId, status: 'CLOSED', supplierId: summerId } });
  if (!summerClosedPo) {
    summerClosedPo = await prisma.purchaseOrder.create({
      data: {
        organizationId,
        supplierId: summerId,
        locationId: location.id,
        poNumber: poNumber('CLSD'),
        status: 'CLOSED',
        createdById: storeManager.id,
        sentAt: new Date('2026-07-16'),
        closedAt: new Date('2026-07-16'),
        lines: {
          create: [
            {
              organizationId,
              inventoryItemId: flourId,
              orderedQty: d('3'),
              unitPrice: d('1870'),
              receivedQty: d('3'),
              invoicePrice: d('1870'),
              receivedAt: new Date('2026-07-16'),
            },
          ],
        },
      },
    });
    console.log(`OK    Purchase Order ${summerClosedPo.poNumber} — CLOSED`);
  }

  // --- Supplier AP: a small realistic portfolio across statuses and payment-age buckets ---
  const samratRecentPo = await ensureClosedPurchaseOrder('AP1', samratId, '2026-07-29', [
    { inventoryItemId: sugarIdForPo, qty: '50', unitPrice: '155' },
    { inventoryItemId: clingFilmId, qty: '8', unitPrice: '699' },
  ]);
  const dairyMidAgePo = await ensureClosedPurchaseOrder('AP2', dairyId, '2026-07-18', [
    { inventoryItemId: milkId, qty: '45', unitPrice: '75' },
    { inventoryItemId: chickenId, qty: '22', unitPrice: '480' },
  ]);
  const samratOverduePo = await ensureClosedPurchaseOrder('AP3', samratId, '2026-06-18', [
    { inventoryItemId: marginId, qty: '2', unitPrice: '3095' },
    { inventoryItemId: soySauceId, qty: '7', unitPrice: '365' },
  ]);
  const summerSettledPo = await ensureClosedPurchaseOrder('AP4', summerId, '2026-07-02', [
    { inventoryItemId: oilId, qty: '1', unitPrice: '4900' },
  ]);

  await ensureSupplierInvoice({
    supplierId: summerId,
    purchaseOrderId: summerClosedPo.id,
    referenceNumber: 'SINV57141',
    amount: '35670.00',
    invoiceDate: '2026-07-16',
    payments: [{ amount: '20000.00', method: 'MPESA', paidAt: '2026-07-22' }],
  });
  await ensureSupplierInvoice({
    supplierId: samratId,
    purchaseOrderId: samratRecentPo.id,
    referenceNumber: 'SAM-AP-0729',
    amount: '13342.00',
    invoiceDate: '2026-07-29',
  });
  await ensureSupplierInvoice({
    supplierId: dairyId,
    purchaseOrderId: dairyMidAgePo.id,
    referenceNumber: 'NFD-AP-0718',
    amount: '13935.00',
    invoiceDate: '2026-07-18',
    payments: [{ amount: '7500.00', method: 'CASH', paidAt: '2026-07-24' }],
  });
  await ensureSupplierInvoice({
    supplierId: samratId,
    purchaseOrderId: samratOverduePo.id,
    referenceNumber: 'SAM-AP-0618',
    amount: '8745.00',
    invoiceDate: '2026-06-18',
  });
  await ensureSupplierInvoice({
    supplierId: summerId,
    purchaseOrderId: summerSettledPo.id,
    referenceNumber: 'SUM-AP-0702',
    amount: '4900.00',
    invoiceDate: '2026-07-02',
    payments: [{ amount: '4900.00', method: 'CARD', paidAt: '2026-07-05' }],
  });

  // --- Waste log entry ---
  const existingWaste = await prisma.wasteLog.findFirst({ where: { organizationId } });
  if (!existingWaste) {
    await wasteLogService.create(attendantActor, {
      locationId: location.id,
      inventoryItemId: milkId,
      quantity: '2',
      reason: 'SPOILED',
      note: 'Two litres past use-by, discovered during morning prep',
    });
    console.log('OK    Waste Log entry — 2L Fresh Milk, SPOILED');
  }

  // --- Opening stock count: a separate APPROVED session with deliberate gaps ---
  const existingCount = await prisma.stockCount.findFirst({ where: { organizationId } });
  if (!existingCount) {
    const countItems = [sugarId, marginId, soySauceId, milkId, chickenId].filter(Boolean);
    const created = await stockCountService.create(managerActor, {
      locationId: location.id,
      label: 'Opening Physical Count',
      scheduledDate: new Date('2026-07-23').toISOString(),
      inventoryItemIds: countItems,
    });

    // Attendant executes: count values deliberately differ slightly from
    // expected so the gap/adjustment workflow has real variance to show.
    const lineDelta: Record<string, string> = {
      [sugarId]: '-2',
      [marginId]: '0',
      [soySauceId]: '-0.5',
      [milkId]: '1',
      [chickenId]: '0',
    };
    const submitLines = created.lines.map((line) => {
      const expected = line.expectedQty ? new Prisma.Decimal(line.expectedQty) : new Prisma.Decimal(0);
      const delta = new Prisma.Decimal(lineDelta[line.inventoryItemId] ?? '0');
      const counted = Prisma.Decimal.max(expected.add(delta), new Prisma.Decimal(0));
      return { lineId: line.id, countedQty: counted.toFixed(4) };
    });
    await stockCountService.submitCounts(attendantActor, created.id, submitLines);
    const approved = await stockCountService.approve(managerActor, created.id);
    console.log(`OK    Stock Count "${approved.label}" — submitted by Attendant, approved by Manager, adjustments posted`);
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
