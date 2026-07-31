// Shared display formatting for inventory quantities and costs.
//
// `InventoryItem.currentCost` is stored per usage unit (D-7) — required so
// prep/recipe/waste costing math (which consumes in usage units: grams, ml)
// stays correct. But a person browsing or picking items thinks in buy-unit
// terms (a pouch, a bottle, a jerrican), not fractions of a gram. These
// helpers convert for display only; never use them to derive a value that
// gets sent back to the API — always send the raw usage-unit currentCost.

export const formatKes = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return `Ksh ${Number.isFinite(n) ? n.toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '0'}`
}

/**
 * Rounds a decimal string/number to 4 places — the precision the backend's
 * quantitySchema/nonNegativeQuantitySchema regex accepts (`^\d{1,8}(\.\d{1,4})?$`).
 * Required whenever a quantity is derived arithmetically (buyUnitCostValue's
 * multiplication, a stepper's increment) rather than typed by a person —
 * those can produce long floats (e.g. 365.0157000000001) that fail the
 * regex and get rejected as "Validation failed" with no field-level detail.
 */
export const roundToApiPrecision = (value: string | number): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(4).replace(/\.?0+$/, '') || '0'
}

interface CostValueInfo {
  currentCost: string
  conversionFactor: string
}

interface CostUnitInfo extends CostValueInfo {
  buyUnit: string
  usageUnit: string
}

/**
 * The per-buy-unit price as a number, e.g. 330 for an item whose
 * currentCost is 0.66/gram and conversionFactor is 500. Use this (not the
 * raw currentCost) whenever seeding a price into a form/line where the
 * paired quantity is entered in buy units — PO lines, receiving invoice
 * price defaults, etc. — so price and quantity stay in the same unit.
 */
export function buyUnitCostValue(item: CostValueInfo): number {
  const usageCost = parseFloat(item.currentCost)
  const factor = parseFloat(item.conversionFactor)
  if (!Number.isFinite(usageCost) || !Number.isFinite(factor) || factor <= 0) return usageCost
  return usageCost * factor
}

/**
 * The per-buy-unit price, e.g. "Ksh 330.00 / pouch (500g)" for an item whose
 * currentCost is stored per gram. Falls back to the raw usage-unit cost if
 * buyUnit and usageUnit are the same (conversionFactor === 1), since a
 * "per kg" or "per L" price is already buy-unit-native and needs no
 * conversion.
 */
export function formatBuyUnitCost(item: CostUnitInfo): string {
  const factor = parseFloat(item.conversionFactor)
  if (!Number.isFinite(parseFloat(item.currentCost)) || !Number.isFinite(factor) || factor <= 0) {
    return `${formatKes(item.currentCost)} / ${item.usageUnit}`
  }
  return `${formatKes(buyUnitCostValue(item))} / ${item.buyUnit}`
}

/** The raw per-usage-unit price, e.g. "Ksh 0.66 / g" — secondary detail only. */
export function formatUsageUnitCost(item: CostUnitInfo): string {
  return `${formatKes(item.currentCost)} / ${item.usageUnit}`
}

interface QuantityUnitInfo {
  conversionFactor: string
  buyUnit: string
  usageUnit: string
}

/**
 * A usage-unit on-hand quantity expressed in buy units, e.g. "5 pouch (500g)"
 * for 2500g of an item bought in 500g pouches. Falls back to the raw
 * usage-unit quantity when buyUnit and usageUnit are the same.
 */
export function formatBuyUnitQuantity(usageQty: string | number, item: QuantityUnitInfo): string {
  const qty = typeof usageQty === 'string' ? parseFloat(usageQty) : usageQty
  const factor = parseFloat(item.conversionFactor)
  if (!Number.isFinite(qty)) return `— ${item.usageUnit}`
  if (!Number.isFinite(factor) || factor <= 0 || item.buyUnit === item.usageUnit) {
    return `${qty.toLocaleString('en-KE', { maximumFractionDigits: 2 })} ${item.usageUnit}`
  }
  const buyQty = qty / factor
  return `${buyQty.toLocaleString('en-KE', { maximumFractionDigits: 2 })} ${item.buyUnit}`
}

/**
 * The unit label to show next to a quantity FIELD that accepts a buy-unit
 * value (e.g. Stock Count entry — someone physically counts cartons/boxes on
 * a shelf, not fractional grams). Falls back to usageUnit when buyUnit and
 * usageUnit are the same, matching formatBuyUnitQuantity's fallback.
 */
export function buyUnitLabel(item: QuantityUnitInfo): string {
  return item.buyUnit === item.usageUnit ? item.usageUnit : item.buyUnit
}

/**
 * Converts a buy-unit quantity typed by a person (e.g. "0.42" cartons) into
 * the raw usage-unit quantity the backend/ledger expects (D-7 — the ledger
 * is always usage-unit-denominated; countedQty/expectedQty on a
 * StockCountLine are compared directly with no conversion server-side). Use
 * this on submit for any quantity field that displayed buyUnitLabel to the
 * user. Returns the input unchanged (as a number) if conversion isn't
 * applicable (buyUnit === usageUnit, or an invalid factor).
 */
export function toUsageUnitQuantity(buyQty: string | number, item: QuantityUnitInfo): number {
  const qty = typeof buyQty === 'string' ? parseFloat(buyQty) : buyQty
  const factor = parseFloat(item.conversionFactor)
  if (!Number.isFinite(qty)) return NaN
  if (!Number.isFinite(factor) || factor <= 0 || item.buyUnit === item.usageUnit) return qty
  return qty * factor
}
