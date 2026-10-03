import { describe, expect, it } from 'vitest';
import type { SupplierCatalogLine, SupplierTimelineEntry } from '../types/supplier';
import {
  DEFAULT_DOC_FILTERS,
  applyDocFilters,
  contactLine,
  docGroupCounts,
  formatAmount,
  lateSentence,
  lastUpdateText,
  ownPackCount,
  packLabel,
  perUnitText,
  priceAlertSentence,
  priceAlertTag,
  profileChecklist,
  termsLabel,
  uploaders,
  validateChequeNumber,
} from './supplier-logic';

const contact = (over: Record<string, unknown> = {}) => ({ id: 'c', name: 'Rajesh Samrat', role: 'SALES_REP', phone: '+254722118340', whatsapp: null, email: null, isPrimary: true, createdAt: '', updatedAt: '', ...over });
const base = { name: 'Kagumo Poultry Farm', address: 'Kagumo, Nyeri', kraPin: null, contacts: [], paymentMethods: [] };

describe('profileChecklist', () => {
  it('a new supplier with a phone only on the business contact is 4 of 7 with three left to add', () => {
    const { rows, done } = profileChecklist({ ...base, contacts: [contact({ name: 'Kagumo Poultry Farm' }) as never] });
    expect(done).toBe(4);
    expect(rows.filter((r) => !r.done).map((r) => r.key)).toEqual(['contact', 'payment', 'kra']);
  });

  it('a placeholder address does not count, and a person, a payment method and a PIN make 7', () => {
    expect(profileChecklist({ ...base, address: '—' }).done).toBe(2); // name and "how we pay them" only
    const full = profileChecklist({ ...base, kraPin: 'P051234567X', contacts: [contact() as never], paymentMethods: [{} as never] });
    expect(full.done).toBe(7);
  });

  it('phone is found on any contact, not only the primary', () => {
    const { rows } = profileChecklist({ ...base, contacts: [contact({ phone: null }) as never, contact({ id: 'd', isPrimary: false }) as never] });
    expect(rows.find((r) => r.key === 'phone')?.done).toBe(true);
  });
});

const line = (over: Partial<SupplierCatalogLine> = {}): SupplierCatalogLine => ({
  id: 'l1', inventoryItemId: 'i1', itemName: 'Sugar, white', itemBuyUnit: 'bag', itemUsageUnit: 'kg', itemConversionFactor: '50',
  supplierItemName: null, supplierItemCode: null, buyUnit: 'bag', packSize: null, lastPrice: '9150', lastPriceAt: '2026-10-08T09:00:00.000Z',
  lastPriceSetBy: null, isPreferred: false, preferredNeedsConfirm: false, lastReceipt: { id: 'r', reference: 'GRN-1042' }, priceAlert: null, ...over,
});

describe('pack lines', () => {
  it('reads the item\'s own pack from its conversion and a different pack from the line', () => {
    expect(packLabel(line())).toBe('50 kg bag');
    expect(packLabel(line({ buyUnit: 'packet', packSize: '2' }))).toBe('2 kg packet');
  });
  it('a pack of unknown size is just its unit', () => {
    expect(packLabel(line({ buyUnit: 'jerrican', itemConversionFactor: null }))).toBe('jerrican');
  });
  it('works out the price per usage unit', () => {
    expect(perUnitText(line())).toBe('183 / kg');
    expect(perUnitText(line({ buyUnit: 'packet', packSize: '2', lastPrice: '380' }))).toBe('190 / kg');
    expect(perUnitText(line({ lastPrice: null }))).toBeNull();
    expect(perUnitText(line({ buyUnit: 'jerrican', itemConversionFactor: null }))).toBeNull();
  });
  it('does not say "1 can can" for an item still counted in its buying unit', () => {
    const can = line({ buyUnit: 'can', itemBuyUnit: 'can', itemUsageUnit: 'can', itemConversionFactor: '1', lastPrice: '195' });
    expect(packLabel(can)).toBe('can');
    expect(perUnitText(can)).toBeNull();
  });
  it('counts the lines in a pack other than the item\'s own', () => {
    expect(ownPackCount([line(), line({ id: 'l2', buyUnit: 'packet', packSize: '2' })])).toBe(1);
  });
});

describe('where a price came from', () => {
  it('says hand-set by whom, or which receipt', () => {
    expect(lastUpdateText(line({ lastPriceSetBy: { id: 'u', name: 'Isabel Njoki' } }))).toBe('08 Oct · set by hand by Isabel');
    expect(lastUpdateText(line())).toBe('08 Oct · from receipt GRN-1042');
    expect(lastUpdateText(line({ lastPriceAt: null }))).toBe('—');
  });
});

describe('price alerts', () => {
  const alert = { pct: '6.00', previousPrice: '8630', previousAt: '2026-09-28T09:00:00.000Z' };
  it('words the tag and the strip sentence', () => {
    expect(priceAlertTag(alert)).toBe('6% since 28 Sep');
    expect(priceAlertTag({ ...alert, pct: '6.4', previousAt: null })).toBe('6.4%');
    expect(priceAlertSentence([line({ priceAlert: alert })])).toBe('Sugar, white is up 6%');
    expect(priceAlertSentence([line({ priceAlert: alert }), line({ priceAlert: alert }), line()])).toBe('Sugar, white is up 6% and 1 more');
    expect(priceAlertSentence([line()])).toBe('no price rises');
  });
});

describe('cheque numbers', () => {
  it('are required and kept short', () => {
    expect(validateChequeNumber('   ')).toBe('Enter the cheque number.');
    expect(validateChequeNumber('000412')).toBeNull();
    expect(validateChequeNumber('9'.repeat(41))).not.toBeNull();
  });
});

describe('small formats', () => {
  it('writes terms and amounts', () => {
    expect(termsLabel('INVOICE_TO_FOLLOW', 14)).toBe('Invoice · 14 days');
    expect(termsLabel('INVOICE_TO_FOLLOW', 1)).toBe('Invoice · 1 day');
    expect(termsLabel('PAY_NOW', 0)).toBe('Pay now');
    expect(formatAmount('236540.00')).toBe('236,540');
    expect(formatAmount('27900.50')).toBe('27,900.5');
  });
  it('shows the person and phone, or just the phone when the contact is the business itself', () => {
    expect(contactLine({ name: 'Samrat', primaryContact: { id: 'c', name: 'Rajesh Samrat', role: 'SALES_REP', phone: '+254 722', whatsapp: null, email: null } })).toBe('Rajesh Samrat · +254 722');
    expect(contactLine({ name: 'Mama Njeri', primaryContact: { id: 'c', name: 'mama njeri', role: 'OTHER', phone: '+254 712', whatsapp: null, email: null } })).toBe('+254 712');
  });
});

describe('documents filters', () => {
  const now = new Date('2026-10-12T08:00:00Z').getTime();
  const auto = (id: string, kind: 'RECEIPT' | 'INVOICE', at: string, title: string, reference: string): SupplierTimelineEntry => ({ id, kind, occurredAt: at, title, reference, amount: null });
  const upload = (id: string, docType: 'PRICE_LIST' | 'CONTRACT', at: string, title: string, who = 'u1'): SupplierTimelineEntry => ({
    id, kind: 'UPLOAD', occurredAt: at, title, reference: null, amount: null,
    document: { id, fileName: title, mimeType: 'application/pdf', sizeBytes: 1, docType, docDate: null, note: null, goodsReceiptId: null, supplierInvoiceId: null, uploadedBy: { id: who, name: who === 'u1' ? 'Isabel Njoki' : 'Margaret' }, createdAt: at },
  });
  const entries = [
    upload('a', 'PRICE_LIST', '2026-10-08T07:00:00Z', 'Price list, October.pdf'),
    auto('b', 'RECEIPT', '2026-10-08T06:00:00Z', 'Signed goods receipt', 'GRN-1042'),
    auto('c', 'INVOICE', '2026-10-08T05:00:00Z', 'Supplier invoice', 'INV-05121'),
    upload('d', 'CONTRACT', '2025-06-12T07:00:00Z', 'Supply agreement 2025.pdf', 'u2'),
  ];

  it('combine, and the last 12 months leaves the old contract out', () => {
    expect(applyDocFilters(entries, DEFAULT_DOC_FILTERS, now).map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, range: 'ALL' }, now)).toHaveLength(4);
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, search: 'grn-10' }, now).map((e) => e.id)).toEqual(['b']);
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, range: 'ALL', source: 'UPLOADED', addedBy: 'u2' }, now).map((e) => e.id)).toEqual(['d']);
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, source: 'AUTOMATIC' }, now).map((e) => e.id)).toEqual(['b', 'c']);
  });
  it('sorts', () => {
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, range: 'ALL', sort: 'OLDEST' }, now)[0]?.id).toBe('d');
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, range: 'ALL', sort: 'NAME' }, now)[0]?.title).toBe('Price list, October.pdf');
  });
  it('chip counts follow the other filters but not the chip itself', () => {
    const counts = docGroupCounts(entries, { ...DEFAULT_DOC_FILTERS, group: 'INVOICE' }, now);
    expect(counts).toMatchObject({ ALL: 3, RECEIPT: 1, INVOICE: 1, PRICE_LIST: 1, CONTRACT: 0 });
    expect(applyDocFilters(entries, { ...DEFAULT_DOC_FILTERS, group: 'INVOICE' }, now)).toHaveLength(1);
  });
  it('lists who uploaded', () => {
    expect(uploaders(entries)).toEqual([{ id: 'u1', name: 'Isabel Njoki' }, { id: 'u2', name: 'Margaret' }]);
  });
});

describe('lateSentence', () => {
  it('names each late bucket and says so when none is late', () => {
    expect(lateSentence({ days1To30: '16000.00', days31To60: '0.00', days61To90: '0.00', days90Plus: '0.00' })).toBe('KES 16,000 is 1 to 30 days late.');
    expect(lateSentence({ days1To30: '16000', days31To60: '500', days61To90: '0', days90Plus: '0' })).toBe('KES 16,000 is 1 to 30 days late, KES 500 is 31 to 60 days late.');
    expect(lateSentence({ days1To30: '0', days31To60: '0', days61To90: '0', days90Plus: '0' })).toBe('Nothing is late.');
  });
});
