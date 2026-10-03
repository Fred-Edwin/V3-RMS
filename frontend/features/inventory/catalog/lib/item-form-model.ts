import type { CreateItemInput, DepartmentTag, InventoryItem, InventoryItemType, UpdateItemInput } from '../../types';
import { itemNeedsSetup, trimDecimal } from '../../_shared/lib/item-format';
import { ITEM_TYPE_LABEL } from './item-labels';
import { normalizePriceInput, validateOptionalPrice } from './item-price';

/**
 * The Add / Edit item form as plain data, kept out of the .tsx so it can be
 * unit-tested. One entry, "One holds N", feeds both the conversion factor and
 * the pack size (owner decision: pack size and conversion are one entry).
 */
export interface ItemFormValues {
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  /** How many usage units one buy unit holds. Numeric text. */
  holds: string;
  usageUnit: string;
  /** Category id, or — when `categoryIsNew` — a name to create. */
  category: string;
  categoryIsNew: boolean;
  departmentTags: DepartmentTag[];
  restockLevel: string;
  /** Days of cover for the suggested level, as typed. Empty = the default of 15. */
  daysOfCover: string;
  /** Add only: the usual price per buy unit, as typed ("8,900"). Empty = none. */
  usualPrice: string;
}

export const EMPTY_FORM_VALUES: ItemFormValues = {
  name: '',
  type: 'STOCKED',
  buyUnit: '',
  holds: '',
  usageUnit: '',
  category: '',
  categoryIsNew: false,
  departmentTags: [],
  restockLevel: '',
  daysOfCover: '',
  usualPrice: '',
};

export type ItemFormSource = Pick<
  InventoryItem,
  'name' | 'type' | 'buyUnit' | 'usageUnit' | 'conversionFactor' | 'packSize' | 'categoryId' | 'departmentTags' | 'centralStoreRestockLevel' | 'daysOfCover'
>;

export function itemToFormValues(item: ItemFormSource): ItemFormValues {
  // "One holds" only means something when the units differ; a stored conversion of 1 for the same unit both ways is "no pack".
  const sameUnits = item.type === 'PREPPED' || item.buyUnit.trim().toLowerCase() === item.usageUnit.trim().toLowerCase();
  const holds = sameUnits ? null : (item.conversionFactor ?? item.packSize);
  return {
    name: item.name,
    type: item.type,
    buyUnit: item.buyUnit,
    holds: holds ? trimDecimal(holds) : '',
    usageUnit: item.usageUnit,
    category: item.categoryId ?? '',
    categoryIsNew: false,
    departmentTags: item.departmentTags,
    restockLevel: item.centralStoreRestockLevel ? trimDecimal(item.centralStoreRestockLevel) : '',
    daysOfCover: item.daysOfCover ? trimDecimal(item.daysOfCover) : '',
    usualPrice: '',
  };
}

const sameUnit = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A Prepped item is not bought, so its buying fields are hidden and its buy unit is its usage unit. */
export const isBought = (type: InventoryItemType): boolean => type !== 'PREPPED';

/** "One holds" only means something when the buy unit differs from the usage unit. */
export function holdsApplies(values: Pick<ItemFormValues, 'type' | 'buyUnit' | 'usageUnit'>): boolean {
  return isBought(values.type) && values.buyUnit.trim() !== '' && values.usageUnit.trim() !== '' && !sameUnit(values.buyUnit, values.usageUnit);
}

/** Raw ingredients never carry a department. */
export const usesDepartments = (type: InventoryItemType): boolean => type !== 'RAW_INGREDIENT';

const DECIMAL = /^\d{1,8}(\.\d{1,4})?$/;
const DAYS = /^\d{1,3}(\.\d{1,2})?$/;

export interface ItemFormErrors {
  name?: string;
  buyUnit?: string;
  usageUnit?: string;
  holds?: string;
  restockLevel?: string;
  daysOfCover?: string;
  usualPrice?: string;
}

export function validateItemForm(values: ItemFormValues): ItemFormErrors {
  const errors: ItemFormErrors = {};
  if (values.name.trim() === '') errors.name = 'Give the item a name.';
  if (values.usageUnit.trim() === '') errors.usageUnit = 'Choose the unit you use it in.';
  if (isBought(values.type) && values.buyUnit.trim() === '') errors.buyUnit = 'Choose how you buy it.';
  if (holdsApplies(values)) {
    const holds = values.holds.trim();
    if (holds === '') errors.holds = 'How many does one hold?';
    else if (!DECIMAL.test(holds) || Number.parseFloat(holds) <= 0) errors.holds = 'Enter a number like 25 or 12.5.';
  }
  const level = values.restockLevel.trim();
  if (level !== '' && (!DECIMAL.test(level) || Number.parseFloat(level) < 0)) errors.restockLevel = 'Enter a number like 100.';
  const days = values.daysOfCover.trim();
  if (days !== '' && (!DAYS.test(days) || Number.parseFloat(days) <= 0 || Number.parseFloat(days) > 365)) errors.daysOfCover = 'Enter days like 5 or 1.5 (up to 365).';
  const priceError = isBought(values.type) ? validateOptionalPrice(values.usualPrice) : null;
  if (priceError) errors.usualPrice = priceError;
  return errors;
}

export const hasErrors = (errors: ItemFormErrors): boolean => Object.keys(errors).length > 0;

interface UnitFields {
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string;
  packSize: string | null;
}

function unitFields(values: ItemFormValues): UnitFields {
  const usageUnit = values.usageUnit.trim();
  const buyUnit = isBought(values.type) ? values.buyUnit.trim() : usageUnit;
  if (holdsApplies(values)) {
    const holds = values.holds.trim();
    return { buyUnit, usageUnit, conversionFactor: holds, packSize: holds };
  }
  // Same unit both ways: a conversion of 1 states it outright, which takes the item out of "Needs setup".
  return { buyUnit, usageUnit, conversionFactor: '1', packSize: null };
}

const categoryFields = (values: ItemFormValues) => ({
  categoryId: values.categoryIsNew ? null : values.category || null,
  categoryName: values.categoryIsNew ? values.category.trim() : null,
});

export function toCreateInput(values: ItemFormValues): CreateItemInput {
  const units = unitFields(values);
  const level = values.restockLevel.trim();
  return {
    name: values.name.trim(),
    type: values.type,
    ...categoryFields(values),
    ...units,
    departmentTags: usesDepartments(values.type) ? values.departmentTags : [],
    centralStoreRestockLevel: level === '' ? null : level,
    ...(values.daysOfCover.trim() !== '' ? { daysOfCover: values.daysOfCover.trim() } : {}),
    // A Prepped item is made, not bought, so it has no price to buy it at.
    ...(isBought(values.type) && normalizePriceInput(values.usualPrice) !== '' ? { usualPrice: normalizePriceInput(values.usualPrice) } : {}),
  };
}

export interface ChangeRow {
  what: string;
  now: string;
  after: string;
}

export interface ItemEditPlan {
  /** Only what changed. Empty means nothing to save. */
  input: UpdateItemInput;
  /** Pack / unit / type changes that must be reviewed before saving. Empty = save straight away. */
  risky: ChangeRow[];
  /** The values that will apply after the save, for the review step's sentences. */
  after: { type: InventoryItemType; buyUnit: string; usageUnit: string; holds: string | null };
}

const packText = (buyUnit: string, holds: string | null, usageUnit: string): string =>
  holds ? `1 ${buyUnit} = ${trimDecimal(holds)} ${usageUnit}` : `1 ${buyUnit}, no size`;

/**
 * What an edit changes. Anything that moves how stock is counted (type, buy
 * or usage unit, the pack) is "risky" and goes through the review step first.
 */
export function buildEditPlan(item: ItemFormSource, values: ItemFormValues): ItemEditPlan {
  const before = itemToFormValues(item);
  const units = unitFields(values);
  const input: UpdateItemInput = {};
  const risky: ChangeRow[] = [];

  if (values.name.trim() !== item.name) input.name = values.name.trim();
  if (values.type !== item.type) {
    input.type = values.type;
    risky.push({ what: 'Type', now: ITEM_TYPE_LABEL[item.type], after: ITEM_TYPE_LABEL[values.type] });
  }

  const beforeHolds = before.holds === '' ? null : before.holds;
  const afterHolds = holdsApplies(values) ? values.holds.trim() : null;
  const unitsChanged = units.usageUnit !== item.usageUnit || units.buyUnit !== item.buyUnit;
  const holdsChanged = (afterHolds ?? '') !== (beforeHolds ?? '') && (afterHolds !== null || beforeHolds !== null);

  if (units.buyUnit !== item.buyUnit) input.buyUnit = units.buyUnit;
  if (units.usageUnit !== item.usageUnit) input.usageUnit = units.usageUnit;
  if (unitsChanged || holdsChanged) {
    input.conversionFactor = units.conversionFactor;
    input.packSize = units.packSize;
    risky.push({
      what: unitsChanged && !holdsChanged ? 'Units' : 'Pack',
      now: packText(item.buyUnit, beforeHolds, item.usageUnit),
      after: packText(units.buyUnit, afterHolds, units.usageUnit),
    });
  } else if (itemNeedsSetup(item) && units.conversionFactor === '1') {
    // Saving a seeded item with the same unit both ways states "no conversion" outright, which takes it out of Needs setup.
    input.conversionFactor = '1';
  }

  const beforeCategory = item.categoryId ?? '';
  if (values.categoryIsNew) {
    input.categoryName = values.category.trim();
  } else if (values.category !== beforeCategory) {
    input.categoryId = values.category || null;
  }

  const tagsBefore = [...item.departmentTags].sort().join(',');
  const afterTags = usesDepartments(values.type) ? values.departmentTags : [];
  if ([...afterTags].sort().join(',') !== tagsBefore) input.departmentTags = afterTags;

  const levelBefore = before.restockLevel;
  if (values.restockLevel.trim() !== levelBefore) {
    input.centralStoreRestockLevel = values.restockLevel.trim() === '' ? null : values.restockLevel.trim();
  }

  if (values.daysOfCover.trim() !== before.daysOfCover) {
    input.daysOfCover = values.daysOfCover.trim() === '' ? null : values.daysOfCover.trim();
  }

  return { input, risky, after: { type: values.type, buyUnit: units.buyUnit, usageUnit: units.usageUnit, holds: afterHolds } };
}
