import type { StatusTone } from '@/components/ui2/status-dot';
import type { InventoryItemTypeValue, InventoryTransactionTypeValue } from '../../stock/types/stock';
import type { WasteReasonValue } from '../../waste/department/types/waste';

/**
 * Display formatting for the Milestone Six stock screens, matching Paper's
 * literal output: a true minus sign (U+2212) on negatives ("−4 kg",
 * "−KES 360"), thousands separators, whole numbers where the value is whole.
 */
const MINUS = '−';

function toNumber(value: string | number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** 1180 → "1,180"; 2.5 → "2.5"; up to 2 decimals, no trailing zeros. */
export function formatNumber(value: string | number): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return n < 0 ? `${MINUS}${abs}` : abs;
}

/** Signed with an explicit plus: "+25 kg" / "−6 kg" — ledger qty column. */
export function formatSignedQty(value: string | number, unit: string): string {
  const n = toNumber(value);
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${n < 0 ? MINUS : '+'}${abs} ${unit}`;
}

export function formatQty(value: string | number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}

/** "KES 8,320" / "−KES 360" — whole shillings. */
export function formatKes(value: string | number): string {
  const n = Math.round(toNumber(value));
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `${MINUS}KES ${abs}` : `KES ${abs}`;
}

/** KPI compact form: "KES 486K", "KES 1.68M". */
export function formatKesCompact(value: string | number): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (abs >= 1_000_000) return `${sign}KES ${(abs / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
  if (abs >= 10_000) return `${sign}KES ${Math.round(abs / 1000).toLocaleString('en-US')}K`;
  return `${sign}KES ${Math.round(abs).toLocaleString('en-US')}`;
}

export const ITEM_TYPE_LABEL: Record<InventoryItemTypeValue, string> = {
  STOCKED: 'Stocked',
  PREPPED: 'Prepped',
  RAW_INGREDIENT: 'Raw ingredient',
};

/** Paper `1B27-0`: Stocked = info dot, Prepped = success dot, Raw = neutral-400 dot. */
export const ITEM_TYPE_DOT_CLASS: Record<InventoryItemTypeValue, string> = {
  STOCKED: 'bg-wds-info-fg',
  PREPPED: 'bg-wds-success-fg',
  RAW_INGREDIENT: 'bg-wds-neutral-400',
};

export const TRANSACTION_TYPE_LABEL: Record<InventoryTransactionTypeValue, string> = {
  RECEIVE: 'Receive',
  PREP_CONSUME: 'Prep (used)',
  PREP_PRODUCE: 'Prep (made)',
  WASTE: 'Waste',
  ADJUSTMENT: 'Adjustment',
  DISPATCH_OUT: 'Dispatch out',
  DISPATCH_IN: 'Dispatch in',
  MARKET_RECEIVE: 'Market receive',
  SALE: 'Sale',
};

/** Ledger type dot + label colour, `197U-0`: receive green, dispatch blue, waste caramel, adjustment red. */
export const TRANSACTION_TYPE_TONE: Record<InventoryTransactionTypeValue, { dot: string; text: string }> = {
  RECEIVE: { dot: 'bg-wds-success-fg', text: 'text-wds-success-fg' },
  MARKET_RECEIVE: { dot: 'bg-wds-success-fg', text: 'text-wds-success-fg' },
  PREP_PRODUCE: { dot: 'bg-wds-success-fg', text: 'text-wds-success-fg' },
  DISPATCH_OUT: { dot: 'bg-wds-info-fg', text: 'text-wds-info-fg' },
  DISPATCH_IN: { dot: 'bg-wds-info-fg', text: 'text-wds-info-fg' },
  PREP_CONSUME: { dot: 'bg-wds-neutral-400', text: 'text-wds-text-copy-muted' },
  SALE: { dot: 'bg-wds-neutral-400', text: 'text-wds-text-copy-muted' },
  WASTE: { dot: 'bg-wds-warning-fg', text: 'text-wds-warning-fg' },
  ADJUSTMENT: { dot: 'bg-wds-error-fg', text: 'text-wds-error-fg' },
};

export const WASTE_REASON_LABEL: Record<WasteReasonValue, string> = {
  SPOILAGE: 'Spoilage',
  EXPIRY: 'Expiry',
  DAMAGE_IN_STORE: 'Damage in store',
  PREP_ERROR: 'Prep error',
};

/** Lower-case form used in the hub's waste rows ("spoilage", "prep error"). */
export function wasteReasonShort(reason: WasteReasonValue): string {
  return reason === 'DAMAGE_IN_STORE' ? 'damage' : WASTE_REASON_LABEL[reason].toLowerCase();
}

export type { StatusTone };

export const DEPARTMENT_LABEL: Record<'KITCHEN' | 'PASTRY' | 'BARISTA' | 'SERVICE' | 'HOUSEKEEPING', string> = {
  KITCHEN: 'Kitchen',
  PASTRY: 'Pastry',
  BARISTA: 'Barista',
  SERVICE: 'Service',
  HOUSEKEEPING: 'Housekeeping',
};

// en-US month names ("Sep", not en-GB's "Sept"), assembled day-first as Paper draws them.
const DAY = new Intl.DateTimeFormat('en-US', { day: '2-digit' });
const DAY_NUMERIC = new Intl.DateTimeFormat('en-US', { day: 'numeric' });
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' });
const YEAR = new Intl.DateTimeFormat('en-US', { year: 'numeric' });

/** "08 Sep" — ledger date column. */
export function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${DAY.format(d)} ${MONTH.format(d)}`;
}

/** "12 Sep 2026". */
export function formatDayMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${DAY.format(d)} ${MONTH.format(d)} ${YEAR.format(d)}`;
}

/** "8 Sep" — prose ("latest-price, set 8 Sep"). */
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NUMERIC.format(d)} ${MONTH.format(d)}`;
}

const NAIROBI = 'Africa/Nairobi';
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: NAIROBI });
const MONTH_LONG = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });
const MONTH_SHORT_UTC = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const DAY_UTC = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' });
const DAY_NAIROBI = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: NAIROBI });
const MONTH_NAIROBI = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: NAIROBI });

const dateOnlyToUtc = (dateOnly: string): Date => new Date(`${dateOnly}T00:00:00Z`);

/** "07:10" — Nairobi wall clock, always 24h. */
export function formatClock(iso: string): string {
  return CLOCK.format(new Date(iso));
}

/** "12 Sep" — an instant's Nairobi calendar day. */
export function formatNairobiDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAIROBI.format(d)} ${MONTH_NAIROBI.format(d)}`;
}

/** "12 Sep · 07:10" — a signing moment. */
export function formatDayMonthClock(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAIROBI.format(d)} ${MONTH_NAIROBI.format(d)} · ${CLOCK.format(d)}`;
}

/** "Tue 8 Sep" — a business date (YYYY-MM-DD). */
export function formatWeekdayDate(dateOnly: string): string {
  const d = dateOnlyToUtc(dateOnly);
  return `${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(d)} ${DAY_UTC.format(d)} ${MONTH_SHORT_UTC.format(d)}`;
}

/** "12 September" — a business date. */
export function formatCountDateLong(dateOnly: string): string {
  const d = dateOnlyToUtc(dateOnly);
  return `${DAY_UTC.format(d)} ${MONTH_LONG.format(d)}`;
}

/** "12 Sep" — a business date, short. */
export function formatCountDateShort(dateOnly: string): string {
  const d = dateOnlyToUtc(dateOnly);
  return `${DAY_UTC.format(d)} ${MONTH_SHORT_UTC.format(d)}`;
}

/** "12 September 2026" — a business date with year (print). */
export function formatCountDateFull(dateOnly: string): string {
  return `${formatCountDateLong(dateOnly)} ${dateOnlyToUtc(dateOnly).getUTCFullYear()}`;
}

/** Signed variance in the item's unit: "−9 kg" / "+2 kg". */
export function formatVariance(value: string, unit: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${n < 0 ? MINUS : '+'}${abs}${unit ? ` ${unit}` : ''}`;
}

/** Signed KES: "−KES 810" / "+KES 220". */
export function formatSignedKes(value: string | number): string {
  const n = Math.round(typeof value === 'number' ? value : Number.parseFloat(value));
  if (!Number.isFinite(n) || n === 0) return 'KES 0';
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `${MINUS}KES ${abs}` : `+KES ${abs}`;
}

export const COUNT_REASON_LABEL: Record<import('../../counting/types/count').CountReasonValue, string> = {
  SUSPECTED_MISCOUNT: 'Suspected miscount',
  UNLOGGED_SPOILAGE: 'Unlogged spoilage',
  SUSPECTED_LOSS: 'Suspected loss',
  WITHIN_NORMAL_RANGE: 'Within normal range',
  OTHER: 'Other (describe)',
};

/** "Joseph Mwangi" → "J. Mwangi" (ledger / list style). */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name.trim() : `${parts[0]!.charAt(0)}. ${parts[parts.length - 1]}`;
}
