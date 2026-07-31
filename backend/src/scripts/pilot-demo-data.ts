/**
 * pilot-demo-data.ts
 *
 * The fully synthetic Phase 1 demo dataset agreed in
 * `docs/context/INVENTORY-FEATURE/PILOT_DEMO_VIDEO_PLAN.md` §1/§3 (2026-07-31
 * follow-up session): invented suppliers and item names — deliberately NOT
 * derived from the client's real invoice photos — with realistic Nyeri-market
 * KES pricing and sane buyUnit/conversionFactor pairings (the old
 * seed-inventory-demo dataset had corrupted per-unit costs and is not used).
 *
 * Shared by the local test seed (seed-pilot-demo-local.ts) and, later, the
 * production demo-org seed (seed-pilot-demo.ts — not built yet, see the plan
 * doc §2). Keep data-only: no prisma imports, no side effects.
 */

export type DemoItemType = 'RAW' | 'PREPPED' | 'PASS_THROUGH';
export type DemoDeptTag = 'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING';

export interface DemoSupplier {
  name: string;
  contactName: string;
  phone: string;
  email: string;
}

export interface DemoItem {
  name: string;
  type: DemoItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  reorderLevel: string;
  departmentTags: DemoDeptTag[];
  supplier: string;
  /** buyUnit price in KES (plan doc §1) */
  buyUnitPrice: string;
  /** Opening-stock receive, in buy units (0 = no opening stock) */
  openingBuyQty: string;
}

export const DEMO_SUPPLIERS: DemoSupplier[] = [
  { name: 'Nyeri Highlands Wholesalers', contactName: 'Peter Kamau', phone: '0711223344', email: 'orders@nyerihighlands.example' },
  { name: 'Mt. Kenya Bulk Traders', contactName: 'Grace Wanjiru', phone: '0722334455', email: 'sales@mtkenyabulk.example' },
  { name: 'Aberdare Fresh Farm Supplies', contactName: 'Samuel Mwangi', phone: '0733445566', email: 'info@aberdarefresh.example' },
];

export const DEMO_ITEMS: DemoItem[] = [
  // ── Nyeri Highlands Wholesalers — pantry/dry goods ──
  { name: 'Sunrise Cooking Oil', type: 'RAW', buyUnit: '20L jerrican', usageUnit: 'L', conversionFactor: '20', reorderLevel: '20', departmentTags: ['KITCHEN'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '5200', openingBuyQty: '2' },
  { name: 'Golden Crown Sugar', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '25', departmentTags: ['KITCHEN', 'BARISTA'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '160', openingBuyQty: '50' },
  { name: 'Highland Margarine', type: 'RAW', buyUnit: '10kg carton', usageUnit: 'kg', conversionFactor: '10', reorderLevel: '10', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '3100', openingBuyQty: '3' },
  { name: 'Savanna Soy Sauce 620ml', type: 'RAW', buyUnit: 'bottle', usageUnit: 'ml', conversionFactor: '620', reorderLevel: '1860', departmentTags: ['KITCHEN'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '360', openingBuyQty: '8' },
  { name: 'Millers Choice Baking Flour', type: 'RAW', buyUnit: '50kg bag', usageUnit: 'kg', conversionFactor: '50', reorderLevel: '50', departmentTags: ['KITCHEN'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '4000', openingBuyQty: '2' },
  { name: 'Nyeri Brown Sugar', type: 'RAW', buyUnit: 'kg pkt', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '10', departmentTags: ['KITCHEN', 'BARISTA'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '240', openingBuyQty: '22' },
  { name: 'Bakers Best Dry Yeast 500g', type: 'RAW', buyUnit: 'pouch', usageUnit: 'g', conversionFactor: '500', reorderLevel: '1000', departmentTags: ['PASTRY'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '420', openingBuyQty: '4' },
  { name: 'Highland Tea Leaves 500g', type: 'RAW', buyUnit: 'pkt', usageUnit: 'g', conversionFactor: '500', reorderLevel: '1500', departmentTags: ['BARISTA'], supplier: 'Nyeri Highlands Wholesalers', buyUnitPrice: '280', openingBuyQty: '6' },

  // ── Mt. Kenya Bulk Traders — condiments/packaging supplies ──
  { name: 'Zenith Yellow Mustard 240g', type: 'RAW', buyUnit: 'bottle', usageUnit: 'g', conversionFactor: '240', reorderLevel: '720', departmentTags: ['KITCHEN'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '190', openingBuyQty: '5' },
  { name: 'Zenith Mayonnaise 340g', type: 'RAW', buyUnit: 'bottle', usageUnit: 'g', conversionFactor: '340', reorderLevel: '680', departmentTags: ['KITCHEN'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '260', openingBuyQty: '6' },
  { name: 'Garden Fresh Mushroom 400g', type: 'RAW', buyUnit: 'pkt', usageUnit: 'g', conversionFactor: '400', reorderLevel: '1200', departmentTags: ['KITCHEN'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '260', openingBuyQty: '4' },
  { name: 'ClearWrap Cling Film 30x300m', type: 'PASS_THROUGH', buyUnit: 'roll', usageUnit: 'roll', conversionFactor: '1', reorderLevel: '4', departmentTags: ['SERVICE'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '700', openingBuyQty: '6' },
  { name: 'Breeze Air Freshener 100ml', type: 'PASS_THROUGH', buyUnit: 'can', usageUnit: 'can', conversionFactor: '1', reorderLevel: '6', departmentTags: ['HOUSEKEEPING'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '140', openingBuyQty: '8' },
  { name: 'PureSip Bottled Water 1L', type: 'PASS_THROUGH', buyUnit: 'ctn (12x1L)', usageUnit: 'bottle', conversionFactor: '12', reorderLevel: '36', departmentTags: ['SERVICE'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '390', openingBuyQty: '4' },
  { name: 'SoftTouch Tissue Wrapped', type: 'PASS_THROUGH', buyUnit: 'ctn (10pack)', usageUnit: 'pack', conversionFactor: '10', reorderLevel: '10', departmentTags: ['HOUSEKEEPING'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '1200', openingBuyQty: '3' },
  { name: 'Sparkle Multipurpose Soap', type: 'PASS_THROUGH', buyUnit: 'ctn (10x1kg)', usageUnit: 'kg', conversionFactor: '10', reorderLevel: '10', departmentTags: ['HOUSEKEEPING'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '1550', openingBuyQty: '2' },
  { name: 'Golden Pastry Flour 2kg', type: 'RAW', buyUnit: 'bale (12x2kg)', usageUnit: 'kg', conversionFactor: '24', reorderLevel: '24', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '1900', openingBuyQty: '2' },
  { name: 'Teatime Mandazi Bites 100g', type: 'PASS_THROUGH', buyUnit: 'box (72x100g)', usageUnit: 'pc', conversionFactor: '72', reorderLevel: '72', departmentTags: ['SERVICE'], supplier: 'Mt. Kenya Bulk Traders', buyUnitPrice: '2000', openingBuyQty: '1' },

  // ── Aberdare Fresh Farm Supplies — fresh/perishables ──
  { name: 'Aberdare Fresh Milk', type: 'RAW', buyUnit: 'L', usageUnit: 'L', conversionFactor: '1', reorderLevel: '20', departmentTags: ['KITCHEN', 'BARISTA'], supplier: 'Aberdare Fresh Farm Supplies', buyUnitPrice: '78', openingBuyQty: '30' },
  { name: 'Highland Chicken Breast', type: 'RAW', buyUnit: 'kg', usageUnit: 'kg', conversionFactor: '1', reorderLevel: '8', departmentTags: ['KITCHEN'], supplier: 'Aberdare Fresh Farm Supplies', buyUnitPrice: '490', openingBuyQty: '12' },
  { name: 'Aberdare Fresh Eggs (Tray of 30)', type: 'RAW', buyUnit: 'tray', usageUnit: 'pc', conversionFactor: '30', reorderLevel: '90', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Aberdare Fresh Farm Supplies', buyUnitPrice: '460', openingBuyQty: '5' },
  { name: 'Aberdare Natural Yoghurt Cup 450ml', type: 'RAW', buyUnit: 'cup', usageUnit: 'ml', conversionFactor: '450', reorderLevel: '1350', departmentTags: ['KITCHEN', 'PASTRY'], supplier: 'Aberdare Fresh Farm Supplies', buyUnitPrice: '175', openingBuyQty: '10' },
];

/** Plan doc §3 — walkthrough documents. PO numbers are fixed for idempotency. */
export const DEMO_PREP_RECIPE = {
  name: 'Simple Syrup — Standard Batch',
  outputItemName: 'Prepped Simple Syrup',
  usageUnit: 'L',
  expectedYield: '10',
  inputItemName: 'Golden Crown Sugar',
  inputQuantity: '5',
};

/** Prior prep run so the rolling-average hint has history (step 8). */
export const DEMO_PRIOR_PREP = { actualYield: '10.2', inputQuantity: '5' };

export const DEMO_DRAFT_PO = {
  poNumber: 'PO-DEMO-001',
  supplier: 'Nyeri Highlands Wholesalers',
  lines: [
    { itemName: 'Highland Margarine', qty: '3', unitPrice: '3100' },
    { itemName: 'Bakers Best Dry Yeast 500g', qty: '5', unitPrice: '420' },
  ],
};

export const DEMO_SENT_PO = {
  poNumber: 'PO-DEMO-002',
  supplier: 'Aberdare Fresh Farm Supplies',
  lines: [
    { itemName: 'Aberdare Fresh Milk', qty: '40', unitPrice: '78' },
    { itemName: 'Highland Chicken Breast', qty: '15', unitPrice: '490' },
  ],
};

export const DEMO_STOCK_COUNT = {
  label: 'Weekly Spot Count — Pantry',
  itemNames: [
    'Golden Crown Sugar',
    'Highland Margarine',
    'Millers Choice Baking Flour',
    'Nyeri Brown Sugar',
    'Highland Tea Leaves 500g',
  ],
};

export const DEMO_WASTE = {
  itemName: 'Aberdare Fresh Milk',
  quantity: '3',
  reason: 'SPOILED' as const,
  note: 'Discovered during morning fridge check, past use-by date',
};

/** §3 step 12 — AP portfolio across aging buckets (daysAgo relative to seed time). */
export const DEMO_INVOICES = [
  {
    reference: 'NHW-INV-101',
    supplier: 'Nyeri Highlands Wholesalers',
    amount: '18400.00',
    daysAgo: 10,
    closedPo: {
      poNumber: 'PO-DEMO-AP1',
      lines: [
        { itemName: 'Millers Choice Baking Flour', qty: '4', unitPrice: '4000' },
        { itemName: 'Highland Tea Leaves 500g', qty: '8', unitPrice: '280' },
      ],
    },
    payments: [{ amount: '10000.00', method: 'MPESA' as const, daysAgo: 6 }],
  },
  {
    reference: 'AFF-INV-207',
    supplier: 'Aberdare Fresh Farm Supplies',
    amount: '12150.00',
    daysAgo: 35,
    closedPo: {
      poNumber: 'PO-DEMO-AP2',
      lines: [
        { itemName: 'Aberdare Fresh Milk', qty: '80', unitPrice: '78' },
        { itemName: 'Highland Chicken Breast', qty: '12', unitPrice: '490' },
      ],
    },
    payments: [],
  },
  {
    reference: 'MKB-INV-330',
    supplier: 'Mt. Kenya Bulk Traders',
    amount: '6300.00',
    daysAgo: 14,
    closedPo: {
      poNumber: 'PO-DEMO-AP3',
      lines: [
        { itemName: 'PureSip Bottled Water 1L', qty: '10', unitPrice: '390' },
        { itemName: 'SoftTouch Tissue Wrapped', qty: '2', unitPrice: '1200' },
      ],
    },
    payments: [{ amount: '6300.00', method: 'CARD' as const, daysAgo: 12 }],
  },
];
