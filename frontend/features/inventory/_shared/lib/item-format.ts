import type { DepartmentTag, InventoryItem } from '../../types';
import { DEPARTMENT_LABEL } from '../components/stock-format';

/** "25.0000" → "25", "12.5000" → "12.5". Same number without trailing zeros. */
export function trimDecimal(value: string): string {
  return /^\d+\.\d+$/.test(value) ? value.replace(/\.?0+$/, '') : value;
}

const sameUnit = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The "How we buy it" line: `bag = 50 kg`, `sold by the kg`, or just the unit
 * for a Prepped item (nothing is bought). One shared reading of the item's
 * pack and conversion so the table, item page and review step agree.
 */
export function formatHowWeBuy(item: Pick<InventoryItem, 'type' | 'buyUnit' | 'usageUnit' | 'conversionFactor' | 'packSize'>): string {
  if (item.type === 'PREPPED') return item.usageUnit;
  const perBuyUnit = item.conversionFactor ?? item.packSize;
  if (perBuyUnit && !sameUnit(item.buyUnit, item.usageUnit)) {
    return `${item.buyUnit} = ${trimDecimal(perBuyUnit)} ${item.usageUnit}`;
  }
  if (sameUnit(item.buyUnit, item.usageUnit)) return `sold by the ${item.usageUnit}`;
  return `${item.buyUnit} · ${item.usageUnit}`;
}

/** The Pack row on the item page: `1 bag = 50 kg`, or `1 kg, no size` when nothing is set. */
export function formatPackLine(item: Pick<InventoryItem, 'buyUnit' | 'usageUnit' | 'conversionFactor' | 'packSize'>): string {
  const perBuyUnit = item.conversionFactor ?? item.packSize;
  if (perBuyUnit) return `1 ${item.buyUnit} = ${trimDecimal(perBuyUnit)} ${item.usageUnit}`;
  return `1 ${item.buyUnit}, no size`;
}

export function formatUsedBy(item: Pick<InventoryItem, 'type' | 'departmentTags'>): string {
  if (item.type === 'RAW_INGREDIENT') return 'Prep only';
  if (item.departmentTags.length === 0) return 'Central Store only';
  return item.departmentTags.map((tag: DepartmentTag) => DEPARTMENT_LABEL[tag]).join(', ');
}

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'Africa/Nairobi' });

/** "04 Aug" */
export function formatDayMonthShort(iso: string): string {
  return DAY_MONTH.format(new Date(iso));
}

/** Placeholder units from seeding (§29.3): usage unit = buy unit, no pack size, no conversion. */
export function itemNeedsSetup(item: Pick<InventoryItem, 'buyUnit' | 'usageUnit' | 'conversionFactor' | 'packSize'>): boolean {
  return sameUnit(item.buyUnit, item.usageUnit) && !item.packSize && !item.conversionFactor;
}
