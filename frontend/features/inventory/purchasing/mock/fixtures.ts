import type { PayMethod } from '../types';

/**
 * Curated demo data. Built once from the real catalog and supplier records (real item names, units, pack sizes and Kenyan
 * suppliers; test suppliers dropped; prices rounded; the cases the demo needs added). The mock never reads live data at
 * runtime: this file is the whole world.
 */
export interface FixtureSupplier {
  id: string;
  code: string;
  name: string;
  address: string;
  contactName: string | null;
  whatsapp: string | null;
  termsDays: number | null;
  onHold: boolean;
  payMethods: Array<{ method: PayMethod; label: string; detail: string; isDefault: boolean }>;
}

export interface FixtureItem {
  id: string;
  name: string;
  category: string;
  usageUnit: string;
  onHand: number;
  level: number;
  /** Items the attendant added that the Store Manager has not finished setting up cannot be ordered (decision Q2). */
  setupDone: boolean;
}

export interface FixtureLine {
  supplierId: string;
  itemId: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string;
  /** Usage units in one buy unit. */
  pack: number;
  price: number;
  lastBoughtAt: string | null;
  preferred: boolean;
}

const bank = (acct: string): FixtureSupplier['payMethods'][number] => ({ method: 'BANK_TRANSFER', label: 'Bank transfer', detail: acct, isDefault: true });
const paybill = { method: 'MPESA_PAYBILL' as const, label: 'M-Pesa Paybill', detail: '522533 · WENDO-NYERI', isDefault: false };
const till = { method: 'MPESA_TILL' as const, label: 'M-Pesa Till', detail: 'Not saved · enter the till number when you pay', isDefault: false };
const cash = { method: 'CASH' as const, label: 'Cash', detail: '', isDefault: false };

export const SUPPLIERS: FixtureSupplier[] = [
  {
    id: 'sup-samrat',
    code: 'SUPPLIER-0001',
    name: 'Samrat Supermarket Ltd',
    address: 'Kimathi Way, opposite Nyeri Town Hall, Nyeri',
    contactName: 'Rajesh Samrat',
    whatsapp: '+254 722 118 340',
    termsDays: 14,
    onHold: false,
    payMethods: [
      bank('KCB Bank · ····4471'),
      paybill,
      till,
      { method: 'MPESA_SEND_MONEY', label: 'M-Pesa Send Money', detail: '+254 722 118 340 · Rajesh Samrat', isDefault: false },
      { method: 'CHEQUE', label: 'Cheque', detail: 'Payable to Samrat Supermarket Ltd · Equity Bank', isDefault: false },
      cash,
    ],
  },
  {
    id: 'sup-summer',
    code: 'SUPPLIER-0002',
    name: 'Summer Limited',
    address: 'Industrial Area, Nyeri',
    contactName: 'Grace Wanjiru',
    whatsapp: '+254 733 204 118',
    termsDays: 30,
    onHold: false,
    payMethods: [bank('Equity Bank · ····9023'), paybill, cash],
  },
  {
    id: 'sup-kagumo',
    code: 'SUPPLIER-0008',
    name: 'Kagumo Poultry Farm',
    address: 'Kagumo, Kirinyaga Road, Nyeri',
    contactName: 'Peter Kariuki',
    whatsapp: '+254 711 502 667',
    termsDays: 14,
    onHold: false,
    payMethods: [{ method: 'MPESA_SEND_MONEY', label: 'M-Pesa Send Money', detail: '+254 711 502 667 · Peter Kariuki', isDefault: true }, cash],
  },
  {
    id: 'sup-kimathi',
    code: 'SUPPLIER-0004',
    name: 'Kimathi Butchery',
    address: 'Kimathi Street, Nyeri Market',
    contactName: 'Daniel Kimathi',
    whatsapp: '+254 722 640 912',
    termsDays: 7,
    onHold: false,
    payMethods: [{ method: 'MPESA_TILL', label: 'M-Pesa Till', detail: '842211 · Kimathi Butchery', isDefault: true }, cash],
  },
  {
    id: 'sup-market',
    code: 'SUPPLIER-0006',
    name: 'Nyeri Market Traders',
    address: 'Nyeri Municipal Market, Stall 14',
    contactName: 'Mary Njeri',
    whatsapp: '+254 700 318 205',
    termsDays: 7,
    onHold: false,
    payMethods: [{ method: 'MPESA_SEND_MONEY', label: 'M-Pesa Send Money', detail: '+254 700 318 205 · Mary Njeri', isDefault: true }, cash],
  },
  {
    id: 'sup-karatina',
    code: 'SUPPLIER-0011',
    name: 'Karatina Fresh Produce',
    address: 'Karatina Town, Nyeri',
    contactName: 'John Mwaura',
    whatsapp: '+254 722 777 410',
    termsDays: 7,
    onHold: false,
    payMethods: [{ method: 'MPESA_SEND_MONEY', label: 'M-Pesa Send Money', detail: '+254 722 777 410 · John Mwaura', isDefault: true }, cash],
  },
  {
    id: 'sup-demka',
    code: 'SUPPLIER-0003',
    name: 'Demka Dairy',
    address: 'Naivasha Road, Nyeri',
    contactName: 'Esther Mugo',
    whatsapp: '+254 720 905 331',
    termsDays: 14,
    onHold: false,
    payMethods: [bank('Co-op Bank · ····6618')],
  },
  {
    id: 'sup-palora',
    code: 'SUPPLIER-0005',
    name: 'Palora Ltd',
    address: 'Industrial Area, Nyeri',
    contactName: 'Samuel Gitau',
    whatsapp: '+254 722 310 058',
    termsDays: 14,
    onHold: true,
    payMethods: [bank('KCB Bank · ····2290')],
  },
];

export const ITEMS: FixtureItem[] = [
  { id: 'it-sugar', name: 'Kabras Sugar 1kg', category: 'Dry goods', usageUnit: 'kg', onHand: 18, level: 100, setupDone: true },
  { id: 'it-oil', name: 'Salt Cooking Oil 10ltr', category: 'Dry goods', usageUnit: 'L', onHand: 0, level: 40, setupDone: true },
  { id: 'it-margarine', name: 'Prestige Margarine 10kg box', category: 'Dry goods', usageUnit: 'kg', onHand: 6, level: 20, setupDone: true },
  { id: 'it-yeast', name: 'Angel Instant Dry Yeast 500g', category: 'Dry goods', usageUnit: 'g', onHand: 200, level: 1000, setupDone: true },
  { id: 'it-flour', name: '210 Home Baking Flour 12x2kg', category: 'Dry goods', usageUnit: 'kg', onHand: 10, level: 48, setupDone: true },
  { id: 'it-water', name: 'Highlands Water 12x1ltr', category: 'Service', usageUnit: 'btl', onHand: 0, level: 48, setupDone: true },
  { id: 'it-chicken', name: 'Chicken breast', category: 'Chicken', usageUnit: 'kg', onHand: 8, level: 30, setupDone: true },
  { id: 'it-wings', name: 'Chicken wings', category: 'Chicken', usageUnit: 'kg', onHand: 4, level: 14, setupDone: true },
  { id: 'it-cocoa', name: 'Coco Primo 24x100g Sachets', category: 'Dry goods', usageUnit: 'sachet', onHand: 12, level: 48, setupDone: true },
  { id: 'it-mayo', name: 'Zesta Eggless Mayonnaise 340g', category: 'Dry goods', usageUnit: 'g', onHand: 340, level: 680, setupDone: true },
  { id: 'it-brownsugar', name: 'Clovers Brown Sugar 1kg pkt', category: 'Dry goods', usageUnit: 'kg', onHand: 22, level: 15, setupDone: true },
  { id: 'it-tea', name: 'Gathuthi Tea Leaves 750ml Hazelnut', category: 'Dry goods', usageUnit: 'pkt', onHand: 14, level: 20, setupDone: true },
  { id: 'it-yoghurt', name: 'BSD Natural Yoghurt Cup 450ml', category: 'Dairy', usageUnit: 'ml', onHand: 1800, level: 900, setupDone: true },
  { id: 'it-beef', name: 'Beef', category: 'Beef', usageUnit: 'kg', onHand: 5, level: 25, setupDone: true },
  { id: 'it-goat', name: 'Goat meat', category: 'Goat', usageUnit: 'kg', onHand: 3, level: 15, setupDone: true },
  { id: 'it-potatoes', name: 'Potatoes', category: 'Vegetables', usageUnit: 'kg', onHand: 10, level: 60, setupDone: true },
  { id: 'it-onions', name: 'Onions', category: 'Vegetables', usageUnit: 'kg', onHand: 8, level: 30, setupDone: true },
  { id: 'it-tomatoes', name: 'Tomatoes', category: 'Vegetables', usageUnit: 'kg', onHand: 6, level: 30, setupDone: true },
  { id: 'it-carrots', name: 'Carrots', category: 'Vegetables', usageUnit: 'kg', onHand: 20, level: 20, setupDone: true },
  { id: 'it-cabbage', name: 'White cabbage', category: 'Vegetables', usageUnit: 'pcs', onHand: 20, level: 20, setupDone: true },
  { id: 'it-spinach', name: 'Spinach', category: 'Vegetables', usageUnit: 'kg', onHand: 10, level: 10, setupDone: true },
  { id: 'it-newitem', name: 'Napkins, paper (added by attendant)', category: 'Service', usageUnit: 'pack', onHand: 0, level: 0, setupDone: false },
];

/** One row per supplier line. `pack` is usage units per buy unit. */
export const LINES: FixtureLine[] = [
  { supplierId: 'sup-samrat', itemId: 'it-sugar', supplierItemName: 'KABRAS SUGAR 1KG', supplierItemCode: '190041', buyUnit: 'kg', pack: 1, price: 168, lastBoughtAt: '2026-09-18', preferred: true },
  { supplierId: 'sup-summer', itemId: 'it-sugar', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 158, lastBoughtAt: '2026-09-02', preferred: false },
  { supplierId: 'sup-samrat', itemId: 'it-oil', supplierItemName: 'SALT COOKING OIL 10LTR', supplierItemCode: '410022', buyUnit: 'jerrican', pack: 10, price: 2340, lastBoughtAt: '2026-09-18', preferred: true },
  { supplierId: 'sup-samrat', itemId: 'it-margarine', supplierItemName: 'PRESTIGE MARGARINE 10KG', supplierItemCode: '220310', buyUnit: 'box', pack: 10, price: 2890, lastBoughtAt: '2026-09-18', preferred: true },
  { supplierId: 'sup-samrat', itemId: 'it-yeast', supplierItemName: 'ANGEL YEAST DRY 500G', supplierItemCode: '230078', buyUnit: 'pouch', pack: 500, price: 610, lastBoughtAt: '2026-09-18', preferred: true },
  { supplierId: 'sup-summer', itemId: 'it-flour', supplierItemName: null, supplierItemCode: null, buyUnit: 'carton', pack: 24, price: 1960, lastBoughtAt: '2026-09-02', preferred: true },
  { supplierId: 'sup-summer', itemId: 'it-water', supplierItemName: null, supplierItemCode: null, buyUnit: 'carton', pack: 12, price: 720, lastBoughtAt: '2026-09-02', preferred: true },
  { supplierId: 'sup-kagumo', itemId: 'it-chicken', supplierItemName: null, supplierItemCode: null, buyUnit: 'tray', pack: 5, price: 2450, lastBoughtAt: '2026-09-20', preferred: true },
  { supplierId: 'sup-kagumo', itemId: 'it-wings', supplierItemName: null, supplierItemCode: null, buyUnit: 'tray', pack: 5, price: 1900, lastBoughtAt: '2026-09-20', preferred: true },
  // it-cocoa has no supplier line on purpose: it is Paper's "No supplier yet / never bought before" case.
  { supplierId: 'sup-samrat', itemId: 'it-mayo', supplierItemName: 'ZESTA EGGLESS MAYO 340G', supplierItemCode: '205010', buyUnit: 'bottle', pack: 340, price: 385, lastBoughtAt: '2026-09-11', preferred: true },
  { supplierId: 'sup-samrat', itemId: 'it-brownsugar', supplierItemName: 'CLOVERS BROWN SUGAR 1KG', supplierItemCode: '190099', buyUnit: 'pkt', pack: 1, price: 190, lastBoughtAt: '2026-09-11', preferred: true },
  { supplierId: 'sup-samrat', itemId: 'it-tea', supplierItemName: 'GATHUTHI TEA 750ML HAZELNUT', supplierItemCode: '145016', buyUnit: 'pkt', pack: 1, price: 420, lastBoughtAt: '2026-09-11', preferred: true },
  { supplierId: 'sup-demka', itemId: 'it-yoghurt', supplierItemName: null, supplierItemCode: null, buyUnit: 'cup', pack: 450, price: 130, lastBoughtAt: '2026-09-25', preferred: true },
  { supplierId: 'sup-kimathi', itemId: 'it-beef', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 760, lastBoughtAt: '2026-09-27', preferred: true },
  { supplierId: 'sup-kimathi', itemId: 'it-goat', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 1050, lastBoughtAt: '2026-09-27', preferred: true },
  { supplierId: 'sup-market', itemId: 'it-potatoes', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 70, lastBoughtAt: '2026-09-26', preferred: true },
  { supplierId: 'sup-market', itemId: 'it-onions', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 110, lastBoughtAt: '2026-09-26', preferred: true },
  { supplierId: 'sup-market', itemId: 'it-tomatoes', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 90, lastBoughtAt: '2026-09-26', preferred: true },
  { supplierId: 'sup-karatina', itemId: 'it-carrots', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 60, lastBoughtAt: '2026-09-25', preferred: true },
  { supplierId: 'sup-karatina', itemId: 'it-cabbage', supplierItemName: null, supplierItemCode: null, buyUnit: 'pcs', pack: 1, price: 50, lastBoughtAt: '2026-09-25', preferred: true },
  { supplierId: 'sup-karatina', itemId: 'it-spinach', supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', pack: 1, price: 50, lastBoughtAt: '2026-09-25', preferred: true },
];

/** The people the mock acts as. Ids are stable so a scenario can refer to them. */
export const PEOPLE = {
  STORE_MANAGER: { id: 'u-joseph', name: 'Joseph Mwangi', role: 'Store Manager' },
  STORE_ATTENDANT: { id: 'u-attendant', name: 'Store Attendant', role: 'Store Attendant' },
  ACCOUNTANT: { id: 'u-margaret', name: 'Margaret', role: 'Accountant' },
  DIRECTOR: { id: 'u-director', name: 'Director', role: 'Director' },
  MANAGER: { id: 'u-bm', name: 'Branch Manager', role: 'Branch Manager' },
  SYSTEM_ADMIN: { id: 'u-admin', name: 'System Admin', role: 'System Admin' },
} as const;

export const DEMO_PIN = '1234';
