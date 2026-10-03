/**
 * Pure rules for the supplier pages: the profile checklist, how a pack and its price read, the price-alert wording,
 * cheque numbers and the Documents tab's filters. No React, no fetching, so each rule has a test.
 */
import type {
  SupplierCatalogLine,
  SupplierDetail,
  SupplierDocType,
  SupplierListRow,
  SupplierStatus,
  SupplierTerms,
  SupplierTimelineEntry,
  SupplierType,
} from '../types/supplier';
import { trimDecimal } from '../../_shared/lib/item-format';
import { pricePerUsageUnit } from '../../catalog/lib/item-price';

// ─── Labels ─────────────────────────────────────────────────────────────────

export const SUPPLIER_TYPE_LABEL: Record<SupplierType, string> = {
  REGULAR: 'Regular',
  OCCASIONAL: 'Occasional',
  ONE_OFF: 'One-off',
  MARKET: 'Market',
};
export const SUPPLIER_TYPE_ORDER: readonly SupplierType[] = ['REGULAR', 'OCCASIONAL', 'ONE_OFF', 'MARKET'];

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = { ACTIVE: 'Active', ON_HOLD: 'On hold', ARCHIVED: 'Archived' };

/** "Invoice · 14 days", "Pay now". */
export function termsLabel(terms: SupplierTerms, paymentDays: number): string {
  return terms === 'PAY_NOW' ? 'Pay now' : `Invoice · ${paymentDays} ${paymentDays === 1 ? 'day' : 'days'}`;
}

/** "Invoice to follow · 14 days" for the page header line. */
export function termsLongLabel(terms: SupplierTerms, paymentDays: number): string {
  return terms === 'PAY_NOW' ? 'Pay now' : `Invoice to follow · ${paymentDays} ${paymentDays === 1 ? 'day' : 'days'}`;
}

/** An amount for display: thousands separators, up to two decimals, none when whole. A decimal string in, a string out. */
export function formatAmount(value: string): string {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value;
}

/** "08 Oct" from an ISO date or timestamp, in Nairobi time. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAIROBI_DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Nairobi' });
function nairobiParts(iso: string): { day: string; month: string; year: string } {
  const parts = Object.fromEntries(NAIROBI_DATE.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { day: parts.day ?? '', month: MONTHS[Number(parts.month) - 1] ?? '', year: parts.year ?? '' };
}
export const formatDayMonth = (iso: string): string => {
  const { day, month } = nairobiParts(iso);
  return `${day} ${month}`;
};

/** "12 Oct 2026" */
export const formatFullDate = (iso: string): string => {
  const { day, month, year } = nairobiParts(iso);
  return `${Number(day)} ${month} ${year}`;
};

// ─── Profile checklist ──────────────────────────────────────────────────────

export const PROFILE_TOTAL = 7;

export type ProfileKey = 'name' | 'phone' | 'address' | 'terms' | 'contact' | 'payment' | 'kra';

export interface ProfileRow {
  key: ProfileKey;
  label: string;
  done: boolean;
}

const filled = (v: string | null | undefined): boolean => !!v && v.trim().length > 0;

/**
 * The seven points behind "Profile 4 of 7", in the order Paper draws them. The count equals the backend's (name, type, phone,
 * address, contact person, payment details, KRA PIN): Paper joins name and type in one row and adds "How we pay them", which a
 * supplier always has, so the two sets move together.
 */
export function profileChecklist(s: Pick<SupplierDetail, 'name' | 'address' | 'kraPin' | 'contacts' | 'paymentMethods'>): { rows: ProfileRow[]; done: number } {
  const hasPhone = s.contacts.some((c) => filled(c.phone));
  const hasPerson = s.contacts.some((c) => filled(c.name) && c.name.trim().toLowerCase() !== s.name.trim().toLowerCase());
  const rows: ProfileRow[] = [
    { key: 'name', label: 'Business name and type', done: filled(s.name) },
    { key: 'phone', label: 'Phone', done: hasPhone },
    { key: 'address', label: 'Address', done: filled(s.address) && s.address.trim() !== '—' },
    { key: 'terms', label: 'How we pay them', done: true },
    { key: 'contact', label: 'Contact person', done: hasPerson },
    { key: 'payment', label: 'Bank or M-Pesa details', done: s.paymentMethods.length > 0 },
    { key: 'kra', label: 'KRA PIN', done: filled(s.kraPin) },
  ];
  return { rows, done: rows.filter((r) => r.done).length };
}

/** "7 of 7" */
export const profileLabel = (done: number): string => `${done} of ${PROFILE_TOTAL}`;

// ─── Catalog lines ──────────────────────────────────────────────────────────

type PackLine = Pick<SupplierCatalogLine, 'buyUnit' | 'packSize' | 'itemBuyUnit' | 'itemUsageUnit' | 'itemConversionFactor'>;

/** How many usage units one of the line's packs holds: its own pack size, else the item's own conversion when it is the item's own buy unit. */
export function packHolds(line: PackLine): string | null {
  if (line.packSize) return line.packSize;
  const sameUnit = !line.buyUnit || line.buyUnit === line.itemBuyUnit;
  return sameUnit ? line.itemConversionFactor : null;
}

/** "50 kg bag", "2 kg packet", "jerrican" when nothing is known about its size. */
export function packLabel(line: PackLine): string {
  const unit = line.buyUnit || line.itemBuyUnit;
  const holds = packHolds(line);
  // An item still counted in its buying unit (seeded, "Needs setup") has no "1 can can" to say.
  return holds && !sameUnit(unit, line.itemUsageUnit) ? `${trimDecimal(holds)} ${line.itemUsageUnit} ${unit}` : unit;
}

/** How an item's own pack reads in a picker: "25 kg bag", "jerrican" when it has no size or is still counted in its buying unit. */
export function itemPackLabel(item: { buyUnit: string; usageUnit: string; conversionFactor: string | null; packSize: string | null }): string {
  const holds = item.conversionFactor ?? item.packSize;
  return holds && !sameUnit(item.buyUnit, item.usageUnit) ? `${trimDecimal(holds)} ${item.usageUnit} ${item.buyUnit}` : item.buyUnit;
}

const sameUnit = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The price per usage unit ("178 / kg"), or null when it cannot be worked out. */
export function perUnitText(line: PackLine & Pick<SupplierCatalogLine, 'lastPrice'>): string | null {
  if (!line.lastPrice) return null;
  const holds = packHolds(line);
  if (!holds || sameUnit(line.buyUnit || line.itemBuyUnit, line.itemUsageUnit)) return null;
  const per = pricePerUsageUnit(line.lastPrice, holds);
  return per === null ? null : `${Math.round(per).toLocaleString('en-US')} / ${line.itemUsageUnit}`;
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "12 Oct · set by hand by Isabel", "08 Oct · from receipt GRN-1042", "—" when no price yet. */
export function lastUpdateText(line: Pick<SupplierCatalogLine, 'lastPriceAt' | 'lastPriceSetBy' | 'lastReceipt'>): string {
  if (!line.lastPriceAt) return '—';
  const when = formatDayMonth(line.lastPriceAt);
  if (line.lastPriceSetBy) return `${when} · set by hand by ${firstName(line.lastPriceSetBy.name)}`;
  return line.lastReceipt ? `${when} · from receipt ${line.lastReceipt.reference}` : `${when} · from a receipt`;
}

/** "6" / "6.00" / "6.4" → "6%" / "6.4%". */
export function percentText(pct: string): string {
  const n = Number.parseFloat(pct);
  if (!Number.isFinite(n)) return pct;
  return `${Number.parseFloat(n.toFixed(1))}%`;
}

/** The tag beside the item: "6% since 28 Sep" (just "6%" when the earlier date is not known). */
export function priceAlertTag(alert: NonNullable<SupplierCatalogLine['priceAlert']>): string {
  return alert.previousAt ? `${percentText(alert.pct)} since ${formatDayMonth(alert.previousAt)}` : percentText(alert.pct);
}

/** The strip's line under the alert count: "Sugar, white is up 6%", "Sugar, white is up 6% and 2 more". */
export function priceAlertSentence(lines: Pick<SupplierCatalogLine, 'itemName' | 'priceAlert'>[]): string {
  const alerted = lines.filter((l) => l.priceAlert);
  const first = alerted[0];
  if (!first?.priceAlert) return 'no price rises';
  const more = alerted.length - 1;
  return `${first.itemName} is up ${percentText(first.priceAlert.pct)}${more > 0 ? ` and ${more} more` : ''}`;
}

/** "price lines, 1 in its own pack": lines in a pack other than the item's own. */
export function ownPackCount(lines: Pick<SupplierCatalogLine, 'buyUnit' | 'itemBuyUnit' | 'packSize' | 'itemConversionFactor'>[]): number {
  return lines.filter((l) => (l.buyUnit && l.buyUnit !== l.itemBuyUnit) || (l.packSize !== null && l.itemConversionFactor !== null && Number(l.packSize) !== Number(l.itemConversionFactor))).length;
}

// ─── Cheque numbers ─────────────────────────────────────────────────────────

/** A cheque number is required when paying by cheque; the bank prints it, so it is kept as typed (trimmed). */
export function validateChequeNumber(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return 'Enter the cheque number.';
  if (value.length > 40) return 'A cheque number is shorter than that.';
  return null;
}

// ─── Documents tab ──────────────────────────────────────────────────────────

export type DocGroup = 'RECEIPT' | 'INVOICE' | 'DELIVERY_NOTE' | 'PRICE_LIST' | 'CONTRACT' | 'OTHER';
export const DOC_GROUP_ORDER: readonly DocGroup[] = ['RECEIPT', 'INVOICE', 'DELIVERY_NOTE', 'PRICE_LIST', 'CONTRACT', 'OTHER'];
export const DOC_GROUP_CHIP: Record<DocGroup, string> = {
  RECEIPT: 'Receipts',
  INVOICE: 'Invoices',
  DELIVERY_NOTE: 'Delivery notes',
  PRICE_LIST: 'Price lists',
  CONTRACT: 'Contracts',
  OTHER: 'Other',
};
export const DOC_TYPE_LABEL: Record<SupplierDocType, string> = {
  INVOICE: 'Invoice',
  DELIVERY_NOTE: 'Delivery note',
  RECEIPT: 'Receipt',
  PRICE_LIST: 'Price list',
  CONTRACT: 'Contract',
  TAX_DOCUMENT: 'Tax document',
  OTHER: 'Other',
};

/** Payments and disputes have no chip of their own in the design, so they count under Other. */
export function docGroup(entry: SupplierTimelineEntry): DocGroup {
  const type: SupplierDocType | 'PAYMENT' | 'DISPUTE' = entry.kind === 'UPLOAD' ? entry.document.docType : entry.kind;
  switch (type) {
    case 'RECEIPT':
    case 'INVOICE':
    case 'DELIVERY_NOTE':
    case 'PRICE_LIST':
    case 'CONTRACT':
      return type;
    default:
      return 'OTHER';
  }
}

export function docTypeLabel(entry: SupplierTimelineEntry): string {
  if (entry.kind === 'UPLOAD') return DOC_TYPE_LABEL[entry.document.docType];
  return { RECEIPT: 'Receipt', INVOICE: 'Invoice', PAYMENT: 'Payment', DISPUTE: 'Dispute' }[entry.kind];
}

/** The date shown and sorted on: an upload's own document date when it has one, else when it happened. */
export const docDate = (entry: SupplierTimelineEntry): string => (entry.kind === 'UPLOAD' && entry.document.docDate ? `${entry.document.docDate}T12:00:00+03:00` : entry.occurredAt);

export const isAutomatic = (entry: SupplierTimelineEntry): boolean => entry.kind !== 'UPLOAD';

/** "Isabel Njoki · uploaded" or "Automatic". */
const AUTOMATIC_VERB: Record<'RECEIPT' | 'INVOICE' | 'PAYMENT' | 'DISPUTE', string> = { RECEIPT: 'signed by', INVOICE: 'recorded by', PAYMENT: 'recorded by', DISPUTE: '' };

/** "Sarah Achieng · uploaded", "Automatic · signed by Sarah Achieng", or plain "Automatic" when no one is named. */
export const docAddedBy = (entry: SupplierTimelineEntry): string => {
  if (entry.kind === 'UPLOAD') return `${entry.document.uploadedBy.name} · uploaded`;
  return entry.actor && AUTOMATIC_VERB[entry.kind] ? `Automatic · ${AUTOMATIC_VERB[entry.kind]} ${entry.actor.name}` : 'Automatic';
};

export type DocRange = 'ALL' | '12M' | '6M' | '3M' | '30D';
export const DOC_RANGE_LABEL: Record<DocRange, string> = { ALL: 'Any time', '12M': 'Last 12 months', '6M': 'Last 6 months', '3M': 'Last 3 months', '30D': 'Last 30 days' };
const RANGE_DAYS: Record<Exclude<DocRange, 'ALL'>, number> = { '12M': 365, '6M': 183, '3M': 92, '30D': 30 };

export type DocSource = 'ALL' | 'UPLOADED' | 'AUTOMATIC';
export type DocSort = 'NEWEST' | 'OLDEST' | 'NAME';
export const DOC_SORT_LABEL: Record<DocSort, string> = { NEWEST: 'Newest first', OLDEST: 'Oldest first', NAME: 'Name A to Z' };

export interface DocFilters {
  search: string;
  range: DocRange;
  /** Uploader's user id, or null for anyone. */
  addedBy: string | null;
  source: DocSource;
  group: DocGroup | null;
  sort: DocSort;
}

export const DEFAULT_DOC_FILTERS: DocFilters = { search: '', range: '12M', addedBy: null, source: 'ALL', group: null, sort: 'NEWEST' };

/** Everything but the type chip, so the chips can count what each would show. */
function passesOtherFilters(entry: SupplierTimelineEntry, f: DocFilters, now: number): boolean {
  const q = f.search.trim().toLowerCase();
  if (q && !`${entry.title} ${entry.reference ?? ''}`.toLowerCase().includes(q)) return false;
  if (f.range !== 'ALL' && new Date(docDate(entry)).getTime() < now - RANGE_DAYS[f.range] * 86_400_000) return false;
  if (f.source === 'UPLOADED' && isAutomatic(entry)) return false;
  if (f.source === 'AUTOMATIC' && !isAutomatic(entry)) return false;
  if (f.addedBy && !(entry.kind === 'UPLOAD' && entry.document.uploadedBy.id === f.addedBy)) return false;
  return true;
}

export function applyDocFilters(entries: SupplierTimelineEntry[], f: DocFilters, now: number): SupplierTimelineEntry[] {
  const shown = entries.filter((e) => passesOtherFilters(e, f, now) && (f.group === null || docGroup(e) === f.group));
  const byDate = (a: SupplierTimelineEntry, b: SupplierTimelineEntry) => new Date(docDate(b)).getTime() - new Date(docDate(a)).getTime();
  if (f.sort === 'NAME') return shown.sort((a, b) => a.title.localeCompare(b.title));
  return shown.sort(f.sort === 'OLDEST' ? (a, b) => byDate(b, a) : byDate);
}

/** Per-chip counts under the other filters (the chip "All types" is the sum). */
export function docGroupCounts(entries: SupplierTimelineEntry[], f: DocFilters, now: number): Record<DocGroup, number> & { ALL: number } {
  const counts = { ALL: 0, RECEIPT: 0, INVOICE: 0, DELIVERY_NOTE: 0, PRICE_LIST: 0, CONTRACT: 0, OTHER: 0 };
  for (const entry of entries) {
    if (!passesOtherFilters(entry, f, now)) continue;
    counts.ALL += 1;
    counts[docGroup(entry)] += 1;
  }
  return counts;
}

/** People who uploaded something, for the "Added by" menu. */
export function uploaders(entries: SupplierTimelineEntry[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const e of entries) if (e.kind === 'UPLOAD') seen.set(e.document.uploadedBy.id, e.document.uploadedBy.name);
  return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Suppliers list ─────────────────────────────────────────────────────────

/** The supplier's primary contact line under the name: "Rajesh Samrat · +254 722 118 340", or just the phone. */
export function contactLine(row: Pick<SupplierListRow, 'primaryContact' | 'name'>): string {
  const c = row.primaryContact;
  if (!c) return '';
  const person = c.name.trim().toLowerCase() === row.name.trim().toLowerCase() ? null : c.name;
  return [person, c.phone].filter(Boolean).join(' · ');
}

// ─── What we owe ────────────────────────────────────────────────────────────

/** "KES 16,000 is 1 to 30 days late." from the ageing buckets; "Nothing is late." when every late bucket is empty. */
export function lateSentence(buckets: { days1To30: string; days31To60: string; days61To90: string; days90Plus: string }): string {
  const late: Array<[string, string]> = [
    [buckets.days1To30, '1 to 30 days'],
    [buckets.days31To60, '31 to 60 days'],
    [buckets.days61To90, '61 to 90 days'],
    [buckets.days90Plus, 'over 90 days'],
  ];
  const parts = late.filter(([amount]) => Number.parseFloat(amount) > 0).map(([amount, range]) => `KES ${formatAmount(amount)} is ${range} late`);
  if (parts.length === 0) return 'Nothing is late.';
  return `${parts.join(', ')}.`;
}
