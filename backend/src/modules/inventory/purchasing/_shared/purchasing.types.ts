/**
 * The wire shapes of Purchasing and Receiving. They mirror `frontend/features/inventory/purchasing/types/index.ts`, which
 * wins over `docs/API_CONTRACT.md` §31 where the two differ. Decimals are strings; dates are ISO strings.
 */
import type { LineResult } from './money';
import type { OrderCan, OrderStatus, SendVia, Stage, TrackerItem } from './order-state';

export type PayMethod = 'BANK_TRANSFER' | 'MPESA_PAYBILL' | 'MPESA_TILL' | 'MPESA_SEND_MONEY' | 'CHEQUE' | 'CASH';
export type CancelReason = 'ORDERED_BY_MISTAKE' | 'SUPPLIER_CANNOT_SUPPLY' | 'NO_LONGER_NEEDED' | 'OTHER' | 'WITHDRAWN';
export type CollectedByKind = 'SUPPLIER_DELIVERS' | 'CARRIER' | 'STAFF' | 'OTHER';
export type VoidReason = 'WRONG_AMOUNT' | 'WRONG_SUPPLIER_OR_ORDER' | 'DUPLICATE' | 'OTHER';
export type ReverseReason = 'WRONG_AMOUNT' | 'WRONG_REFERENCE' | 'WRONG_INVOICE' | 'PAYMENT_BOUNCED' | 'OTHER';
export type AuditArea = 'Purchasing' | 'Payments';

export interface Person {
  id: string;
  name: string;
  role: string;
}

export interface FileRef {
  id: string;
  fileName: string;
  size: number;
  thumbnail: string | null;
}

export interface OrderLineView {
  id: string;
  inventoryItemId: string;
  itemName: string;
  supplierItemName: string | null;
  supplierItemCode: string | null;
  buyUnit: string;
  packSize: string | null;
  orderedQty: string;
  unitPrice: string;
  lineTotal: string;
  previousPrice: string | null;
  /** What the receiver typed when the supplier's price differed from the order's. */
  deliveryPrice: string | null;
  priceChanged: boolean;
  receivedQty: string | null;
  confirmedPrice: string | null;
  result: LineResult | null;
}

export interface DeliveryView {
  id: string;
  reference: string;
  deliveryNoteNo: string;
  photo: FileRef | null;
  receivedBy: Person;
  receivedAt: string;
  deliveredTotal: string;
  notSuppliedTotal: string;
}

export interface InvoiceView {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: string;
  status: 'OPEN' | 'PAID' | 'VOIDED';
  disputed: boolean;
  varianceAmount: string | null;
  varianceReason: string | null;
  settled: { agreedAmount: string; note: string; by: { id: string; name: string }; at: string } | null;
  voided: { reason: VoidReason; by: { id: string; name: string }; at: string } | null;
  advanceApplied: string;
  balance: string;
  photo: FileRef | null;
  enteredBy: Person;
  enteredAt: string;
}

export interface PaymentView {
  id: string;
  reference: string;
  kind: 'ADVANCE' | 'INVOICE' | 'REVERSAL';
  amount: string;
  paidOn: string;
  method: PayMethod;
  methodRef: string | null;
  chequeNo: string | null;
  status: 'RECORDED' | 'REVERSED';
  reversesId: string | null;
  reason: string | null;
  invoiceId: string | null;
  proof: FileRef | null;
  approvedBy: { id: string; name: string } | null;
  recordedBy: Person;
  recordedAt: string;
}

export interface SupplierPayMethodView {
  method: PayMethod;
  label: string;
  detail: string;
  isDefault: boolean;
}

/** "Who is getting it?" (Paper 28D): "Sent, collected by {label}" or "Sent, supplier delivers". */
export interface CollectedByView {
  kind: CollectedByKind;
  /** The carrier's, person's or typed name; "Supplier delivers" for that kind. */
  label: string;
  /** "collected by Wendo van KCB 214K" or "supplier delivers": what follows "Sent, ". */
  summary: string;
  carrierId: string | null;
  userId: string | null;
  /** Who chose it ("Set by Joseph (Store Manager)", Paper 28D) and when. */
  setBy: Person | null;
  setAt: string | null;
}

export interface SupplierCardView {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  /** The number to call: the contact's phone, else their WhatsApp number (Call supplier, Paper 28J and 28M). */
  phone: string | null;
  whatsapp: string | null;
  termsDays: number | null;
  /** Empty for a caller without `suppliers.read_payment_details`. */
  payMethods: SupplierPayMethodView[];
}

export interface OrderMoney {
  ordered: string;
  delivered: string | null;
  invoiced: string | null;
  paid: string;
  stillToPay: string;
}

export interface OrderView {
  id: string;
  reference: string | null;
  status: OrderStatus;
  stage: Stage;
  supplier: SupplierCardView;
  raisedBy: Person;
  raisedAt: string;
  submittedAt: string | null;
  approvedBy: (Person & { signedAt: string }) | null;
  returnedNote: string | null;
  returnedBy: { id: string; name: string } | null;
  sentAt: string | null;
  sentVia: SendVia | null;
  /** Set on an approved order; null until someone says who is getting it. */
  collectedBy: CollectedByView | null;
  expectedDate: string | null;
  supplierNote: string | null;
  attendantNote: string | null;
  lines: OrderLineView[];
  orderedTotal: string;
  deliveredTotal: string | null;
  delivery: DeliveryView | null;
  /** Null for a caller blind to financial data (the Store Attendant). */
  invoice: InvoiceView | null;
  payments: PaymentView[];
  money: OrderMoney | null;
  dueLabel: 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING' | null;
  dueInDays: number | null;
  cancelled: { reason: CancelReason; note: string | null; by: { id: string; name: string }; at: string } | null;
  tracker: TrackerItem[];
  can: OrderCan;
}

export interface OrderRowView extends Omit<OrderView, 'lines'> {
  itemSummary: string;
  itemNames: string;
  deliverySummary: string | null;
}

export interface ActivityEntryView {
  at: string;
  actor: Person;
  what: string;
  action: string;
  area: AuditArea;
  document: string | null;
  detail: string;
}

export interface FileDocumentView {
  kind: 'LPO' | 'DELIVERY_NOTE' | 'GOODS_RECEIPT' | 'INVOICE' | 'ADVANCE_ADVICE' | 'PAYMENT_ADVICE' | 'OTHER';
  title: string;
  subtitle: string;
  step: 'Ordered' | 'Delivered' | 'Invoiced' | 'Paid';
  at: string;
  addedBy: string;
  fileRef: FileRef | null;
  action: 'Print' | 'View' | 'Open';
  paymentId: string | null;
}

export interface PurchaseFileView extends OrderView {
  documents: FileDocumentView[];
  activity: ActivityEntryView[];
}
