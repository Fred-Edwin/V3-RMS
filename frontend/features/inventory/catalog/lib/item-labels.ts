import type { DepartmentTag, InventoryItemType } from '../../types';

/**
 * One label map for the three item types, used everywhere in the inventory UI
 * (owner decision, 1 Oct 2026). The database and API values stay `STOCKED`,
 * `RAW_INGREDIENT` and `PREPPED`; only the words change.
 */
export const ITEM_TYPE_LABEL: Record<InventoryItemType, string> = {
  STOCKED: 'Stocked',
  RAW_INGREDIENT: 'Raw ingredient',
  PREPPED: 'Prepped',
};

/** Phone screens say "Raw" where there is no room for "Raw ingredient". */
export const ITEM_TYPE_LABEL_SHORT: Record<InventoryItemType, string> = {
  STOCKED: 'Stocked',
  RAW_INGREDIENT: 'Raw',
  PREPPED: 'Prepped',
};

/** The one-line explainer for each type, shown under the type chips in the add / edit drawer. */
export const ITEM_TYPE_EXPLAINER: Record<InventoryItemType, string> = {
  STOCKED: 'sold or issued exactly as bought, like milk or cooking oil.',
  RAW_INGREDIENT: 'bought only to go into Prep, like flour or raw chicken.',
  PREPPED: 'made in a Prep run from raw ingredients, like chapati dough.',
};

/** Order the types are offered in. */
export const ITEM_TYPE_ORDER: readonly InventoryItemType[] = ['STOCKED', 'RAW_INGREDIENT', 'PREPPED'];

/** Colour of the small dot beside a type label (info / neutral / success tokens). */
export const ITEM_TYPE_DOT_CLASS: Record<InventoryItemType, string> = {
  STOCKED: 'bg-wds-info-fg',
  RAW_INGREDIENT: 'bg-wds-neutral-500',
  PREPPED: 'bg-wds-success-fg',
};

/** Departments an item can be used by, in the order the drawer offers them. */
export const DEPARTMENT_ORDER: readonly DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];

/** Units offered in the "I buy it by the / I use it in" pickers. A unit not listed can be typed and added. */
export const COMMON_UNITS: readonly string[] = [
  'kg',
  'g',
  'L',
  'ml',
  'bag',
  'sack',
  'carton',
  'box',
  'crate',
  'tray',
  'tin',
  'bottle',
  'jerrican',
  'packet',
  'sachet',
  'piece',
  'dozen',
  'roll',
  'bunch',
  'portion',
];
