/**
 * Suppliers — hand-mirrored from `backend/src/modules/inventory/supplier-validators.ts`
 * (API_CONTRACT.md §27, §28, §29.3, §30.3, §30.9–§30.11). Decimals cross the wire as strings.
 * Named `Supplier*` throughout; the old `Supplier` in `./index` is the Milestone One shape and goes in Session 7.
 */

export type SupplierStatus = 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';
export type SupplierType = 'REGULAR' | 'OCCASIONAL' | 'ONE_OFF' | 'MARKET';
export type SupplierContactRole = 'SALES_REP' | 'ACCOUNTS' | 'DELIVERY' | 'OWNER' | 'OTHER';
export type SupplierPayMethodType = 'BANK_TRANSFER' | 'MPESA_PAYBILL' | 'MPESA_TILL' | 'MPESA_SEND_MONEY' | 'CASH' | 'CHEQUE';
export type SupplierDocType = 'INVOICE' | 'DELIVERY_NOTE' | 'RECEIPT' | 'PRICE_LIST' | 'CONTRACT' | 'TAX_DOCUMENT' | 'OTHER';
export type SupplierTerms = 'INVOICE_TO_FOLLOW' | 'PAY_NOW';

export interface SupplierContact {
  id: string;
  name: string;
  role: SupplierContactRole;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPrimaryContact {
  id: string;
  name: string;
  role: SupplierContactRole;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
}

/** A row of the suppliers list (SM, ACC, DIR). `profileDone` is how many of the 7 profile checks pass. */
export interface SupplierListRow {
  id: string;
  code: string;
  name: string;
  tradingName: string | null;
  status: SupplierStatus;
  type: SupplierType;
  category: { id: string; name: string } | null;
  address: string;
  primaryContact: SupplierPrimaryContact | null;
  defaultPaymentTerms: SupplierTerms;
  paymentDays: number;
  profileDone: number;
  /** KES, decimal string. */
  owedAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayMethod {
  id: string;
  type: SupplierPayMethodType;
  isDefault: boolean;
  bankName: string | null;
  bankBranch: string | null;
  accountName: string | null;
  /** "••••4821". The full number only comes from `getPayMethod` (the Show action). */
  accountNumberMasked: string | null;
  paybillNumber: string | null;
  accountReference: string | null;
  tillNumber: string | null;
  phone: string | null;
  /** Cheque: payable to. Send money: the registered name. */
  registeredName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayMethodDetail extends SupplierPayMethod {
  accountNumber: string | null;
}

/** The detail read: the list row without the two list-only figures (profile and owed come from the checklist and the AP read). */
export interface SupplierDetail extends Omit<SupplierListRow, 'profileDone' | 'owedAmount'> {
  mapUrl: string | null;
  kraPin: string | null;
  vatRegistered: boolean;
  notes: string | null;
  creditLimit: string | null;
  contacts: SupplierContact[];
  paymentMethods: SupplierPayMethod[];
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
}

export interface SupplierPayMethodChange {
  id: string;
  at: string;
  action: 'PAY_METHOD_CREATED' | 'PAY_METHOD_UPDATED' | 'PAY_METHOD_DELETED' | 'PAY_METHOD_DEFAULT_CHANGED';
  summary: string;
  reason: string | null;
  actor: { id: string; name: string };
}

export interface SupplierCatalogLine {
  /** The pack line's id; a supplier may have several lines for one item. */
  id: string;
  inventoryItemId: string;
  itemName: string;
  itemBuyUnit: string;
  itemUsageUnit: string;
  itemConversionFactor: string | null;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string | null;
  packSize: string | null;
  lastPrice: string | null;
  lastPriceAt: string | null;
  lastPriceSetBy: { id: string; name: string } | null;
  isPreferred: boolean;
  preferredNeedsConfirm: boolean;
  lastReceipt: { id: string; reference: string } | null;
  priceAlert: { pct: string; previousPrice: string | null; previousAt: string | null } | null;
}

export interface SupplierPackMismatch {
  receiptLineId: string;
  goodsReceiptId: string;
  reference: string;
  signedAt: string | null;
  inventoryItemId: string;
  itemName: string;
  packBuyUnit: string | null;
  packSize: string | null;
  unitPrice: string;
}

export interface SupplierDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: SupplierDocType;
  docDate: string | null;
  note: string | null;
  goodsReceiptId: string | null;
  supplierInvoiceId: string | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
}

interface TimelineBase {
  id: string;
  occurredAt: string;
  title: string;
  reference: string | null;
  amount: string | null;
  /** Who signed the receipt or recorded the invoice or payment; null for uploads (see `document.uploadedBy`) and disputes. */
  actor: { id: string; name: string } | null;
}

export type SupplierTimelineEntry =
  | (TimelineBase & { kind: 'RECEIPT' | 'INVOICE' | 'PAYMENT' | 'DISPUTE' })
  | (TimelineBase & { kind: 'UPLOAD'; document: SupplierDocument });

export interface SupplierDownload {
  url: string;
  expiresAt: string;
  fileName: string;
}

/** The Overview strip's numbers (§27.7). */
export interface SupplierSummary {
  totalSpend: string;
  lastPurchaseAt: string | null;
  receiptsCount: number;
  averageDaysToPay: number | null;
  priceAlerts: number;
  shortDeliveries: number;
}

/** The four numbers above the suppliers list (§29.3). */
export interface SupplierListSummary {
  active: number;
  onHold: number;
  profileNotFinished: number;
  owedAmount: string;
  suppliersOwed: number;
}

/** The four numbers on a supplier's Catalog tab (§29.3). */
export interface SupplierCatalogSummary {
  itemsTheySell: number;
  priceAlerts: number;
  lastReceiptAt: string | null;
  spend90Days: string;
}

// ─── Requests ───────────────────────────────────────────────────────────────

export interface ListSuppliersParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: SupplierStatus;
  type?: SupplierType;
  categoryId?: string;
  profileNotFinished?: boolean;
}

export interface CreateSupplierBody {
  name: string;
  address: string;
  type: SupplierType;
  /** The business's own phone goes on a contact named for the business, until a person is added (the profile counts that as "no contact person yet"). */
  contacts?: SupplierContactBody[];
  categoryId?: string;
  defaultPaymentTerms: SupplierTerms;
  paymentDays?: number;
  confirmDuplicate?: boolean;
}

export interface UpdateSupplierBody {
  name?: string;
  address?: string;
  tradingName?: string | null;
  type?: SupplierType;
  categoryId?: string | null;
  kraPin?: string | null;
  vatRegistered?: boolean;
  notes?: string | null;
  defaultPaymentTerms?: SupplierTerms;
  paymentDays?: number;
  creditLimit?: string | null;
  confirmDuplicate?: boolean;
}

export interface SupplierContactBody {
  name: string;
  role: SupplierContactRole;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  isPrimary?: boolean;
}

export type CreatePayMethodBody = { reason: string; isDefault?: boolean } & (
  | { type: 'BANK_TRANSFER'; bankName: string; bankBranch?: string; accountName: string; accountNumber: string }
  | { type: 'MPESA_PAYBILL'; paybillNumber: string; accountReference?: string }
  | { type: 'MPESA_TILL'; tillNumber: string }
  | { type: 'MPESA_SEND_MONEY'; phone: string; registeredName: string }
  | { type: 'CASH' }
  | { type: 'CHEQUE'; registeredName: string; bankName: string; note?: string }
);

export interface UpdatePayMethodBody {
  bankName?: string | null;
  bankBranch?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  paybillNumber?: string | null;
  accountReference?: string | null;
  tillNumber?: string | null;
  phone?: string | null;
  registeredName?: string | null;
  note?: string | null;
  isDefault?: boolean;
  /** Required whenever a detail above is sent. */
  reason?: string;
}

/** Add or edit one pack line (§28.3, §30.3). `price` is per the line's buy unit. */
export interface PutSupplierLineBody {
  lineId?: string;
  supplierItemName?: string | null;
  supplierItemCode?: string | null;
  buyUnit?: string | null;
  packSize?: string | null;
  isPreferred?: boolean;
  price?: string;
}

export interface UploadSupplierDocumentInput {
  file: File;
  docType: SupplierDocType;
  docDate?: string;
  note?: string;
}
