/** Wire shapes of "Needs restocking" and the New-order catalog (docs/API_CONTRACT.md §31.2; the mock's `types/index.ts` wins). */
export interface SupplierOption {
  supplierId: string;
  name: string;
  /** Null when the supplier's line has never been priced. */
  lastPrice: string | null;
  lastBoughtAt: string | null;
  preferred: boolean;
  /** How much cheaper than the chosen supplier, when it is. */
  cheaperBy: string | null;
}

export interface NeedsLine {
  inventoryItemId: string;
  itemName: string;
  subLabel: string;
  status: 'LOW' | 'OUT';
  /** Stock figures: left out for a caller who may not see them (the Store Attendant), per the blind rule. */
  onHand?: string;
  level?: string;
  usageUnit: string;
  supplierOptions: SupplierOption[];
  chosenSupplierId: string | null;
  suggestedQty: string | null;
  buyUnit: string | null;
  lastPrice: string | null;
  estimatedTotal: string | null;
}

export interface NeedsGroup {
  supplier: { id: string; name: string; code: string } | null;
  termsLabel: string | null;
  itemCount: number;
  estimatedTotal: string;
  lines: NeedsLine[];
}

export interface NeedsRestocking {
  itemCount: number;
  supplierCount: number;
  groups: NeedsGroup[];
  /** Every supplier that can be ordered from, for the "Choose supplier" menu on an item nobody has sold us yet. */
  suppliers: Array<{ id: string; name: string; code: string; termsLabel: string }>;
}

export interface CatalogItem {
  inventoryItemId: string;
  itemName: string;
  category: string;
  status: 'LOW' | 'OUT' | 'OK';
  onHand?: string;
  level?: string;
  soldAs: string;
  buyUnit: string;
  price: string | null;
  qty: string | null;
}

export interface CatalogResult {
  items: CatalogItem[];
  shown: number;
  total: number;
  counts: { lowOrOut: number; all: number };
}

export interface NeedsQuery {
  group?: 'supplier' | 'item';
  supplierId?: string;
  q?: string;
  sort?: 'urgent' | 'name' | 'value';
}

export interface CatalogQuery {
  supplierId: string;
  q?: string;
  category?: string;
  filter?: 'low' | 'all' | 'selected';
}
