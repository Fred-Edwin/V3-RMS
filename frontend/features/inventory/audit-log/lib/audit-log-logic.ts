import type { DateRange } from '@/components/ui2/date-range-picker';
import type { AuditArea, AuditRecordLink } from '../types/audit-log';

export const AREA_LABEL: Record<AuditArea, string> = {
  CATALOG: 'Catalog',
  SUPPLIERS: 'Suppliers',
  RESTOCK_LEVELS: 'Restock levels',
  PURCHASING: 'Purchasing',
  PAYMENTS: 'Payments',
  PREP: 'Prep',
  STOCK_COUNTS: 'Stock counts',
  WASTE: 'Waste',
  STOCK_ADJUSTMENTS: 'Stock adjustments',
  REQUISITIONS: 'Requisitions',
  DISPATCH: 'Dispatch',
  DISCREPANCIES: 'Discrepancies',
  BRANCH_DAY: 'Branch day',
  BRANCH_WASTE: 'Branch waste',
};

/** The value in the URL (`?area=`) that opens the purchase file's own log instead of filtering the list. */
export const PURCHASING_VIEW = 'PURCHASING';

/** The Area menu (Paper step 58): Central Store areas, then Branches areas. "Purchasing and payments" opens the purchase file's log. */
export interface AreaMenuItem {
  /** An API area, or `PURCHASING_VIEW` for "Purchasing and payments". */
  value: AuditArea | typeof PURCHASING_VIEW;
  label: string;
}
export const AREA_MENU: ReadonlyArray<{ heading: string; items: readonly AreaMenuItem[] }> = [
  {
    heading: 'Central Store',
    items: [
      { value: 'CATALOG', label: AREA_LABEL.CATALOG },
      { value: 'SUPPLIERS', label: AREA_LABEL.SUPPLIERS },
      { value: 'RESTOCK_LEVELS', label: AREA_LABEL.RESTOCK_LEVELS },
      { value: PURCHASING_VIEW, label: 'Purchasing and payments' },
      { value: 'PREP', label: AREA_LABEL.PREP },
      { value: 'STOCK_COUNTS', label: AREA_LABEL.STOCK_COUNTS },
      { value: 'WASTE', label: AREA_LABEL.WASTE },
      { value: 'STOCK_ADJUSTMENTS', label: AREA_LABEL.STOCK_ADJUSTMENTS },
    ],
  },
  {
    heading: 'Branches',
    items: [
      { value: 'REQUISITIONS', label: AREA_LABEL.REQUISITIONS },
      { value: 'DISPATCH', label: AREA_LABEL.DISPATCH },
      { value: 'DISCREPANCIES', label: AREA_LABEL.DISCREPANCIES },
      { value: 'BRANCH_DAY', label: AREA_LABEL.BRANCH_DAY },
      { value: 'BRANCH_WASTE', label: AREA_LABEL.BRANCH_WASTE },
    ],
  },
];

const AREA_VALUES: readonly string[] = AREA_MENU.flatMap((g) => g.items.map((i) => i.value));
/** An `?area=` value from the URL, or null when it is not one the menu lists (a hand-edited address). */
export const parseArea = (raw: string | undefined): AuditArea | typeof PURCHASING_VIEW | null => (raw && AREA_VALUES.includes(raw) ? (raw as AuditArea | typeof PURCHASING_VIEW) : null);

/** The label on the Area button: "All areas", or the chosen area. */
export const areaButtonLabel = (area: AuditArea | typeof PURCHASING_VIEW | null): string =>
  area === null ? 'All areas' : (AREA_MENU.flatMap((g) => g.items).find((i) => i.value === area)?.label ?? 'All areas');

const DAY_MS = 86_400_000;
const NAIROBI = '+03:00';

const nextDay = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/**
 * The picker's Nairobi days as the API's timestamps: `from` is the start of the first day, `to` is the start of the day after
 * the last one (the API's `to` is exclusive), so both days are whole.
 */
export function rangeToApi(range: DateRange): { from: string; to: string } {
  return { from: new Date(`${range.from}T00:00:00${NAIROBI}`).toISOString(), to: new Date(`${nextDay(range.to)}T00:00:00${NAIROBI}`).toISOString() };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number): string => String(n).padStart(2, '0');
const parts = (day: string): { y: number; m: number; d: number; weekday: number } => {
  const date = new Date(`${day}T00:00:00Z`);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate(), weekday: date.getUTCDay() };
};
const fullDay = (day: string): string => {
  const p = parts(day);
  return `${WEEKDAYS[p.weekday]} ${p.d} ${MONTHS[p.m]} ${p.y}`;
};
const shortDay = (day: string): string => {
  const p = parts(day);
  return `${p.d} ${MONTHS[p.m]}`;
};

/** "Showing today, Sat 3 Oct 2026." / "Showing 29 Sep to 5 Oct 2026." / "Showing Sat 3 Oct 2026." */
export function rangeSentence(range: DateRange, today: string): string {
  if (range.from === range.to) return range.to === today ? `Showing today, ${fullDay(today)}.` : `Showing ${fullDay(range.to)}.`;
  return `Showing ${shortDay(range.from)} to ${fullDay(range.to)}.`;
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "11:15" for today, "12 Oct 11:15" for any other day. */
export function whenLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const time = `${two(d.getHours())}:${two(d.getMinutes())}`;
  return startOfDay(d).getTime() === startOfDay(now).getTime() ? time : `${d.getDate()} ${MONTHS[d.getMonth()]} ${time}`;
}

const ledger = '/app/inventory/stock/ledger';
/** Where a record link goes: the count, one item's stock card on that day, or the ledger searched for an ADJ number on that day. */
export function recordHref(record: AuditRecordLink): string {
  const day = record.day ? `from=${record.day}&to=${record.day}` : '';
  switch (record.kind) {
    case 'COUNT':
      return `/app/inventory/stock/counts/${record.id}`;
    case 'STOCK_CARD':
      return `${ledger}/${record.id}${day ? `?${day}` : ''}`;
    case 'LEDGER_SEARCH':
      return `${ledger}?search=${encodeURIComponent(record.id)}${day ? `&${day}` : ''}`;
  }
}
