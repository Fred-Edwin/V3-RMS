import type { DepartmentTag, InventoryItemType } from '@prisma/client';

/**
 * Plain-language sentences for the item history (API_CONTRACT.md §30.4). Every sentence is written
 * without the actor — the screen shows "{name} {summary}" — and uses the names the screens use
 * (Stocked / Raw ingredient / Prepped, Kitchen, "1 bag = 50 kg").
 */

export const ITEM_TYPE_LABEL: Record<InventoryItemType, string> = {
  STOCKED: 'Stocked',
  RAW_INGREDIENT: 'Raw ingredient',
  PREPPED: 'Prepped',
};

const DEPARTMENT_LABEL: Record<DepartmentTag, string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

/** The fields of an item the history compares, with decimals already as strings. */
export interface ItemFields {
  name: string;
  type: InventoryItemType;
  buyUnit: string;
  usageUnit: string;
  conversionFactor: string | null;
  packSize: string | null;
  daysOfCover: string | null;
  categoryName: string | null;
  departmentTags: DepartmentTag[];
}

/** "25.0000" → "25", "12.5000" → "12.5". */
export const trimDecimal = (value: string): string => (/^\d+\.\d+$/.test(value) ? value.replace(/\.?0+$/, '') : value);

/** "KES 8,900" / "KES 178.5" — a money amount as the screens write it. */
export const formatKes = (value: string | number): string =>
  `KES ${Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const packText = (f: Pick<ItemFields, 'buyUnit' | 'usageUnit' | 'conversionFactor' | 'packSize'>): string => {
  const perBuyUnit = f.conversionFactor ?? f.packSize;
  return perBuyUnit ? `1 ${f.buyUnit} = ${trimDecimal(perBuyUnit)} ${f.usageUnit}` : `1 ${f.buyUnit}, no size`;
};

const departmentsText = (tags: DepartmentTag[]): string =>
  tags.length === 0 ? 'Central Store only' : tags.map((t) => DEPARTMENT_LABEL[t]).join(', ');

const sameTags = (a: DepartmentTag[], b: DepartmentTag[]): boolean => [...a].sort().join(',') === [...b].sort().join(',');

export interface ItemUpdateDescription {
  summary: string;
  /** Only the fields that changed. */
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/** What an edit changed, or `null` when nothing the history tracks moved. */
const sameNumber = (a: string | null, b: string | null): boolean => a !== null && b !== null && Number(a) === Number(b);

export function describeItemUpdate(before: ItemFields, after: ItemFields): ItemUpdateDescription | null {
  const parts: string[] = [];
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};

  if (before.name !== after.name) {
    parts.push(`renamed it from ${before.name} to ${after.name}`);
    b.name = before.name;
    a.name = after.name;
  }
  if (before.type !== after.type) {
    parts.push(`changed the type from ${ITEM_TYPE_LABEL[before.type]} to ${ITEM_TYPE_LABEL[after.type]}`);
    b.type = before.type;
    a.type = after.type;
  }
  const packChanged =
    before.buyUnit !== after.buyUnit ||
    before.usageUnit !== after.usageUnit ||
    (before.conversionFactor ?? '') !== (after.conversionFactor ?? '') ||
    (before.packSize ?? '') !== (after.packSize ?? '');
  if (packChanged && packText(before) !== packText(after)) {
    parts.push(`changed the pack from ${packText(before)} to ${packText(after)}`);
    Object.assign(b, { buyUnit: before.buyUnit, usageUnit: before.usageUnit, conversionFactor: before.conversionFactor, packSize: before.packSize });
    Object.assign(a, { buyUnit: after.buyUnit, usageUnit: after.usageUnit, conversionFactor: after.conversionFactor, packSize: after.packSize });
  }
  if ((before.daysOfCover ?? '') !== (after.daysOfCover ?? '') && !sameNumber(before.daysOfCover, after.daysOfCover)) {
    parts.push(
      after.daysOfCover === null
        ? 'cleared the days of cover (back to 15)'
        : before.daysOfCover === null
          ? `set the days of cover to ${trimDecimal(after.daysOfCover)}`
          : `changed the days of cover from ${trimDecimal(before.daysOfCover)} to ${trimDecimal(after.daysOfCover)}`,
    );
    b.daysOfCover = before.daysOfCover;
    a.daysOfCover = after.daysOfCover;
  }
  if (before.categoryName !== after.categoryName) {
    parts.push(
      after.categoryName === null
        ? 'removed the category'
        : before.categoryName === null
          ? `set the category to ${after.categoryName}`
          : `moved it from ${before.categoryName} to ${after.categoryName}`,
    );
    b.category = before.categoryName;
    a.category = after.categoryName;
  }
  if (!sameTags(before.departmentTags, after.departmentTags)) {
    parts.push(`changed used-by from ${departmentsText(before.departmentTags)} to ${departmentsText(after.departmentTags)}`);
    b.departmentTags = before.departmentTags;
    a.departmentTags = after.departmentTags;
  }

  if (parts.length === 0) return null;
  return { summary: parts.join('; '), before: b, after: a };
}

export interface SupplierLineFacts {
  supplierName: string;
  buyUnit: string | null;
  packSize: string | null;
  usageUnit: string;
}

const linePack = (l: SupplierLineFacts): string | null =>
  l.buyUnit ? `${l.buyUnit}${l.packSize ? ` of ${trimDecimal(l.packSize)} ${l.usageUnit}` : ''}` : null;

/** "added Samrat Supermarket Ltd (bag of 50 kg) at KES 8,900 per bag, preferred" */
export function describeSupplierAdded(l: SupplierLineFacts, price: string | null, preferred: boolean): string {
  const pack = linePack(l);
  return (
    `added ${l.supplierName}${pack ? ` (${pack})` : ''}` +
    (price !== null ? ` at ${formatKes(price)} per ${l.buyUnit ?? 'unit'}` : '') +
    (preferred ? ', preferred' : '')
  );
}

/** "set Samrat Supermarket Ltd's price to KES 9,100 per bag (was KES 8,900)" */
export function describePriceSet(l: SupplierLineFacts, price: string, previous: string | null): string {
  return (
    `set ${l.supplierName}'s price to ${formatKes(price)} per ${l.buyUnit ?? 'unit'}` +
    (previous !== null ? ` (was ${formatKes(previous)})` : '')
  );
}
