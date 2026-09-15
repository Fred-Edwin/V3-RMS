/**
 * Inventory Milestone One — mock data seed.
 *
 * Sourced from the reference content Paper actually draws on the Milestone
 * One artboards (page `B-0`), not invented placeholder text — item names,
 * units, pack sizes, KPI counts, category rows, and the sample supplier all
 * come from `get_jsx` reads of `SFQ-0` (item catalog), `SRB-0` (manage
 * categories), `SX5-0` (supplier detail/edit), and `T52-0` (restock levels).
 */
import type {
  Category,
  DepartmentTag,
  InventoryItem,
  RestockLevelRow,
  Supplier,
} from '../types';

/**
 * D-15: exactly one Central Store per hub organization. Milestone One's
 * contract has no "list locations" endpoint (out of scope, §0) — a Store
 * Manager is assumed to already know their own hub's Central Store id, the
 * same way the real backend resolves it from the actor's org. Fixed here so
 * the mock and the screen agree on one id.
 */
export const CENTRAL_STORE_LOCATION_ID = 'loc-central-store';

let idCounter = 1000;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

const now = new Date('2026-09-15T08:00:00.000Z').toISOString();

export const CATEGORY_SEED: Category[] = [
  { id: 'cat-dairy', name: 'Dairy', itemCount: 14, retiredAt: null, createdAt: now, updatedAt: now },
  { id: 'cat-dry-goods', name: 'Dry goods', itemCount: 38, retiredAt: null, createdAt: now, updatedAt: now },
  { id: 'cat-produce', name: 'Produce', itemCount: 22, retiredAt: null, createdAt: now, updatedAt: now },
  { id: 'cat-beverages', name: 'Beverages', itemCount: 19, retiredAt: null, createdAt: now, updatedAt: now },
  { id: 'cat-cleaning', name: 'Cleaning', itemCount: 11, retiredAt: null, createdAt: now, updatedAt: now },
  {
    id: 'cat-seasonal',
    name: 'Seasonal',
    itemCount: 0,
    retiredAt: '2026-08-20T00:00:00.000Z',
    createdAt: now,
    updatedAt: now,
  },
];

export const SUPPLIER_SEED: Supplier[] = [
  {
    id: 'sup-samrat',
    name: 'Samrat Ltd',
    contactName: 'Rajesh Samrat',
    category: { id: 'cat-dairy', name: 'Dairy' },
    phone: '+254 722 118 340',
    email: 'orders@samrat.co.ke',
    location: 'Nyeri town',
    defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
    retiredAt: null,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'sup-highland',
    name: 'Highland Roasters',
    contactName: 'Grace Wanjiru',
    category: { id: 'cat-beverages', name: 'Beverages' },
    phone: '+254 700 442 019',
    email: 'sales@highlandroasters.co.ke',
    location: 'Nyeri town',
    defaultPaymentTerms: 'PAY_NOW',
    retiredAt: null,
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: now,
  },
  {
    id: 'sup-freshmarket',
    name: 'Fresh Market Produce',
    contactName: 'Peter Kamau',
    category: { id: 'cat-produce', name: 'Produce' },
    phone: '+254 733 220 981',
    email: null,
    location: 'Nyeri town',
    defaultPaymentTerms: 'INVOICE_TO_FOLLOW',
    retiredAt: null,
    createdAt: '2026-04-18T00:00:00.000Z',
    updatedAt: now,
  },
];

/** ItemCatalogMeta counts, exactly as `SFQ-0`'s KPI strip draws them. */
export const ITEM_CATALOG_META = {
  itemsTracked: 148,
  typesRepresented: 3,
  categoryCount: 5,
  retiredCategoryCount: 1,
  departmentCount: 5,
  supplierCount: 12,
};

const dept = (...tags: DepartmentTag[]): DepartmentTag[] => tags;

export const ITEM_SEED: InventoryItem[] = [
  {
    id: 'item-rice',
    name: 'Rice',
    type: 'RAW_INGREDIENT',
    categoryId: 'cat-dry-goods',
    preferredSupplierId: null,
    buyUnit: 'bag',
    usageUnit: 'kg',
    conversionFactor: '25',
    packSize: '25',
    departmentTags: [],
    category: { id: 'cat-dry-goods', name: 'Dry goods' },
    preferredSupplier: null,
    currentCost: '145',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-coffee-beans',
    name: 'Coffee beans',
    type: 'STOCKED',
    categoryId: 'cat-beverages',
    preferredSupplierId: 'sup-highland',
    buyUnit: 'kg',
    usageUnit: 'kg',
    conversionFactor: null,
    packSize: '1',
    departmentTags: dept('BARISTA'),
    category: { id: 'cat-beverages', name: 'Beverages' },
    preferredSupplier: { id: 'sup-highland', name: 'Highland Roasters' },
    currentCost: '1180',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-chicken-stock',
    name: 'Chicken stock',
    type: 'PREPPED',
    categoryId: 'cat-dry-goods',
    preferredSupplierId: null,
    buyUnit: 'litres',
    usageUnit: 'litres',
    conversionFactor: null,
    packSize: null,
    departmentTags: dept('KITCHEN'),
    category: { id: 'cat-dry-goods', name: 'Prepped bases' },
    preferredSupplier: null,
    currentCost: '240',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-milk',
    name: 'Milk',
    type: 'STOCKED',
    categoryId: 'cat-dairy',
    preferredSupplierId: 'sup-samrat',
    buyUnit: 'crate',
    usageUnit: 'L',
    conversionFactor: '12',
    packSize: '12',
    departmentTags: dept('KITCHEN', 'BARISTA'),
    category: { id: 'cat-dairy', name: 'Dairy' },
    preferredSupplier: { id: 'sup-samrat', name: 'Samrat Ltd' },
    currentCost: '65',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-cooking-oil',
    name: 'Cooking oil',
    type: 'STOCKED',
    categoryId: 'cat-dry-goods',
    preferredSupplierId: null,
    buyUnit: 'jerrican',
    usageUnit: 'L',
    conversionFactor: '20',
    packSize: '20',
    departmentTags: dept('KITCHEN'),
    category: { id: 'cat-dry-goods', name: 'Dry goods' },
    preferredSupplier: null,
    currentCost: '320',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-tomatoes',
    name: 'Tomatoes',
    type: 'RAW_INGREDIENT',
    categoryId: 'cat-produce',
    preferredSupplierId: 'sup-freshmarket',
    buyUnit: 'kg',
    usageUnit: 'kg',
    conversionFactor: null,
    packSize: null,
    departmentTags: [],
    category: { id: 'cat-produce', name: 'Produce' },
    preferredSupplier: { id: 'sup-freshmarket', name: 'Fresh Market Produce' },
    currentCost: '90',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-flour',
    name: 'Flour',
    type: 'RAW_INGREDIENT',
    categoryId: 'cat-dry-goods',
    preferredSupplierId: null,
    buyUnit: 'bag',
    usageUnit: 'kg',
    conversionFactor: null,
    packSize: null,
    departmentTags: [],
    category: { id: 'cat-dry-goods', name: 'Dry goods' },
    preferredSupplier: null,
    currentCost: '78',
    retiredAt: null,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'item-vanilla-syrup',
    name: 'Vanilla syrup',
    type: 'STOCKED',
    categoryId: 'cat-beverages',
    preferredSupplierId: null,
    buyUnit: 'bottle',
    usageUnit: 'ml',
    conversionFactor: '750',
    packSize: '750',
    departmentTags: dept('BARISTA'),
    category: { id: 'cat-beverages', name: 'Beverages' },
    preferredSupplier: null,
    currentCost: '850',
    retiredAt: '2026-08-04T00:00:00.000Z',
    createdAt: now,
    updatedAt: now,
  },
];

/** Restock-levels (Central Store) — `T52-0`'s two visible rows plus one extra for a fuller demo. */
export const RESTOCK_LEVEL_SEED: RestockLevelRow[] = [
  {
    inventoryItemId: 'item-coffee-beans',
    itemName: 'Coffee beans',
    usageUnit: 'kg',
    onHandQty: '12',
    level: '30',
    isBelowLevel: true,
  },
  {
    inventoryItemId: 'item-milk',
    itemName: 'Milk',
    usageUnit: 'litres',
    onHandQty: '128',
    level: '80',
    isBelowLevel: false,
  },
  {
    inventoryItemId: 'item-cooking-oil',
    itemName: 'Cooking oil',
    usageUnit: 'L',
    onHandQty: '46',
    level: '40',
    isBelowLevel: false,
  },
];

/** Department restock levels — mobile-only screen (`TD1-0`), Barista department. */
export const DEPARTMENT_RESTOCK_LEVEL_SEED: RestockLevelRow[] = [
  {
    inventoryItemId: 'item-coffee-beans',
    itemName: 'Coffee beans',
    usageUnit: 'kg',
    onHandQty: '4',
    level: '8',
    isBelowLevel: true,
  },
  {
    inventoryItemId: 'item-milk',
    itemName: 'Milk',
    usageUnit: 'L',
    onHandQty: '18',
    level: '15',
    isBelowLevel: false,
  },
  {
    inventoryItemId: 'item-vanilla-syrup',
    itemName: 'Vanilla syrup',
    usageUnit: 'ml',
    onHandQty: '1200',
    level: '1500',
    isBelowLevel: true,
  },
];
