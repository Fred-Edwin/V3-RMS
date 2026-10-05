/**
 * Purchasing and Receiving types: the shapes in `docs/API_CONTRACT.md` §31. Decimals cross the wire as strings; the screens
 * format them, the engine does the arithmetic. The mock returns exactly these, so wiring the real back-end swaps the data
 * source and not the screens.
 */
import { ApiError } from '@/types/api';

export type OrderStatus = 'DRAFT' | 'AWAITING_APPROVAL' | 'RETURNED' | 'APPROVED' | 'SENT' | 'DELIVERED' | 'INVOICED' | 'CLOSED' | 'CANCELLED';
export type Stage = 'NEEDS' | 'APPROVAL' | 'RECEIVE' | 'INVOICE' | 'PAY' | 'CLOSED';
export type PayMethod = 'BANK_TRANSFER' | 'MPESA_PAYBILL' | 'MPESA_TILL' | 'MPESA_SEND_MONEY' | 'CHEQUE' | 'CASH';
export type LineResult = 'AS_ORDERED' | 'PRICE_CHANGED' | 'SHORT' | 'NOT_SUPPLIED';
export type SendVia = 'WHATSAPP' | 'PRINT' | 'LINK' | 'MANUAL';
export type CancelReason = 'ORDERED_BY_MISTAKE' | 'SUPPLIER_CANNOT_SUPPLY' | 'NO_LONGER_NEEDED' | 'OTHER';
export type TrackerStep = 'RAISED' | 'APPROVED' | 'SENT' | 'DELIVERED' | 'INVOICED' | 'PAID';

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

export interface OrderLine {
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
  /** The last order's price for this supplier line, for the "▲ 4% on the last order" flag. */
  previousPrice: string | null;
  /** The supplier's price on delivery when it differs from the order's (mock stand-in for the delivery note). */
  deliveryPrice: string | null;
  /** What the Store Attendant sees instead of figures (Q-02). */
  priceChanged: boolean;
  receivedQty: string | null;
  confirmedPrice: string | null;
  result: LineResult | null;
}

export interface Delivery {
  id: string;
  reference: string;
  deliveryNoteNo: string;
  photo: FileRef | null;
  receivedBy: Person;
  receivedAt: string;
  deliveredTotal: string;
  notSuppliedTotal: string;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  amount: string;
  status: 'OPEN' | 'PAID' | 'VOIDED';
  disputed: boolean;
  /** Invoice minus delivered value at the time it was added (positive = the supplier charged more). */
  varianceAmount: string | null;
  varianceReason: string | null;
  /** Set when a dispute was settled: the figure agreed with the supplier and the note. */
  settled: { agreedAmount: string; note: string; by: { id: string; name: string }; at: string } | null;
  /** Set when the invoice was voided. */
  voided: { reason: VoidReason; by: { id: string; name: string }; at: string } | null;
  advanceApplied: string;
  balance: string;
  photo: FileRef | null;
  enteredBy: Person;
  enteredAt: string;
}

export type VoidReason = 'WRONG_AMOUNT' | 'WRONG_SUPPLIER_OR_ORDER' | 'DUPLICATE' | 'OTHER';
export type ReverseReason = 'WRONG_AMOUNT' | 'WRONG_INVOICE' | 'PAYMENT_BOUNCED' | 'OTHER';

export interface Payment {
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
  /** Why a payment was reversed (on the REVERSAL line). */
  reason: string | null;
  invoiceId: string | null;
  proof: FileRef | null;
  /** On a REVERSAL line: the Store Manager or System Admin who approved it. */
  approvedBy: { id: string; name: string } | null;
  recordedBy: Person;
  recordedAt: string;
}

export interface TrackerItem {
  step: TrackerStep;
  state: 'DONE' | 'CURRENT' | 'TODO';
  at: string | null;
  note: string | null;
}

export interface SupplierCard {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  whatsapp: string | null;
  termsDays: number | null;
  /** Hidden from callers without `suppliers.read_payment_details`. */
  payMethods: SupplierPayMethod[];
}

export interface SupplierPayMethod {
  method: PayMethod;
  label: string;
  detail: string;
  isDefault: boolean;
}

export interface OrderCan {
  edit: boolean;
  submit: boolean;
  approve: boolean;
  return: boolean;
  send: boolean;
  cancel: boolean;
  receive: boolean;
  recordDeposit: boolean;
  addInvoice: boolean;
  recordPayment: boolean;
  settleDispute: boolean;
  voidInvoice: boolean;
  reversePayment: boolean;
  addDocument: boolean;
}

export interface OrderMoney {
  ordered: string;
  delivered: string | null;
  invoiced: string | null;
  paid: string;
  stillToPay: string;
}

export interface Order {
  id: string;
  reference: string | null;
  status: OrderStatus;
  stage: Stage;
  supplier: SupplierCard;
  raisedBy: Person;
  raisedAt: string;
  submittedAt: string | null;
  approvedBy: (Person & { signedAt: string }) | null;
  returnedNote: string | null;
  returnedBy: { id: string; name: string } | null;
  sentAt: string | null;
  sentVia: SendVia | null;
  expectedDate: string | null;
  supplierNote: string | null;
  attendantNote: string | null;
  lines: OrderLine[];
  orderedTotal: string;
  deliveredTotal: string | null;
  delivery: Delivery | null;
  invoice: Invoice | null;
  payments: Payment[];
  /** Omitted for callers who may not see money (the Store Attendant). */
  money: OrderMoney | null;
  dueLabel: 'DUE_TODAY' | 'OVERDUE' | 'UPCOMING' | null;
  dueInDays: number | null;
  cancelled: { reason: CancelReason; note: string | null; by: { id: string; name: string }; at: string } | null;
  tracker: TrackerItem[];
  can: OrderCan;
}

export interface OrderRow extends Omit<Order, 'lines'> {
  itemSummary: string;
}

export type AuditArea = 'Purchasing' | 'Payments';

/** One thing that happened on an order. `what` is the sentence for the file's Activity tab; the rest feed the Audit log table. */
export interface ActivityEntry {
  at: string;
  actor: { id: string; name: string; role: string };
  what: string;
  /** "Approved order", "Recorded payment": the Action column and filter. */
  action: string;
  area: AuditArea;
  /** The document it concerns (LPO-0044, INV-05188, PAY-0031). */
  document: string | null;
  /** The "What changed" column. */
  detail: string;
}

export interface FileDocument {
  kind: 'LPO' | 'DELIVERY_NOTE' | 'GOODS_RECEIPT' | 'INVOICE' | 'ADVANCE_ADVICE' | 'PAYMENT_ADVICE' | 'OTHER';
  title: string;
  /** The grey line under the title ("INV-05188 · KES 27,986 · Invoice INV-05188.pdf"). */
  subtitle: string;
  /** The stage it belongs to: Ordered, Delivered, Invoiced, Paid. */
  step: 'Ordered' | 'Delivered' | 'Invoiced' | 'Paid';
  at: string;
  addedBy: string;
  fileRef: FileRef | null;
  /** The link on the right of the row. */
  action: 'Print' | 'View' | 'Open';
  /** Where Print or Open goes: a payment advice needs the payment id. */
  paymentId: string | null;
}

export interface PurchaseFile extends Order {
  documents: FileDocument[];
  activity: ActivityEntry[];
}

export interface Summary {
  counts: Record<'needs' | 'approval' | 'receive' | 'invoice' | 'pay' | 'closed', number>;
  awaitingApprovalValue: string;
  dueToReceiveCount: number;
}

export interface SupplierOption {
  supplierId: string;
  name: string;
  lastPrice: string;
  lastBoughtAt: string | null;
  preferred: boolean;
  cheaperBy: string | null;
}

export interface NeedsLine {
  inventoryItemId: string;
  itemName: string;
  subLabel: string;
  status: 'LOW' | 'OUT';
  onHand: string;
  level: string;
  usageUnit: string;
  supplierOptions: SupplierOption[];
  chosenSupplierId: string | null;
  suggestedQty: string | null;
  buyUnit: string | null;
  lastPrice: string | null;
  estimatedTotal: string | null;
}

export interface NeedsGroup {
  supplier: { id: string; name: string; code: string } | null;
  termsLabel: string | null;
  itemCount: number;
  estimatedTotal: string;
  lines: NeedsLine[];
}

export interface NeedsRestocking {
  itemCount: number;
  supplierCount: number;
  groups: NeedsGroup[];
  /** Every supplier that can be ordered from, for the "Choose supplier" menu on an item nobody has sold us yet. */
  suppliers: Array<{ id: string; name: string; code: string; termsLabel: string }>;
}

export interface CatalogItem {
  inventoryItemId: string;
  itemName: string;
  category: string;
  status: 'LOW' | 'OUT' | 'OK';
  onHand: string;
  level: string;
  soldAs: string;
  buyUnit: string;
  price: string;
  qty: string | null;
}

export interface CatalogResult {
  items: CatalogItem[];
  shown: number;
  total: number;
  counts: { lowOrOut: number; all: number };
}

export interface LpoPrint {
  reference: string;
  date: string;
  supplier: { name: string; address: string; contact: string | null; phone: string | null };
  expectedDate: string | null;
  termsLabel: string;
  deliverTo: string;
  raisedByName: string;
  lines: Array<{ n: number; supplierItemName: string; supplierItemCode: string | null; ourItemName: string; qty: string; unit: string; price: string; total: string }>;
  total: string;
  amountInWords: string;
  note: string | null;
  raisedBy: { name: string; role: string; signedAt: string } | null;
  authorisedBy: { name: string; role: string; signedAt: string } | null;
  generatedAt: string;
}

export interface WhatsappMessage {
  to: string;
  phone: string | null;
  message: string;
  pdfFileName: string;
  pdfSizeLabel: string;
}

export interface OrderInputLine {
  inventoryItemId: string;
  qty: string;
  unitPrice: string;
}

export interface OrderInput {
  supplierId: string;
  expectedDate: string | null;
  supplierNote: string | null;
  attendantNote: string | null;
  lines: OrderInputLine[];
}

export interface ReceiveInput {
  lines: Array<{ lineId: string; receivedQty: string; priceConfirmed: boolean }>;
  deliveryNoteNo: string;
  deliveryNotePhotoId: string | null;
  pin: string;
}

export interface DepositInput {
  amount: string;
  paidOn: string;
  method: PayMethod;
  methodRef: string | null;
  chequeNo: string | null;
  note: string | null;
}

export interface InvoiceInput {
  number: string;
  date: string;
  amount: string;
  photoId: string | null;
  varianceReason: string | null;
  /** Set after the "duplicate invoice number" warning when the person says it is a different invoice. */
  differentInvoice?: boolean;
}

export interface PaymentInput {
  amount: string;
  paidOn: string;
  method: PayMethod;
  methodRef: string | null;
  chequeNo: string | null;
  proofPhotoId: string | null;
  confirmOverpay?: boolean;
}

export interface PaymentResult {
  payment: Payment;
  /** The order after the payment (CLOSED when it was the last one). */
  order: Order;
}

/** The printed payment advice (Paper `21`, `21b`). */
export interface PaymentAdvice {
  reference: string;
  date: string;
  supplier: { name: string; address: string; contact: string | null };
  orderReference: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: string;
  advanceApplied: string;
  paidBefore: string;
  amountPaid: string;
  balanceAfter: string;
  method: PayMethod;
  methodRef: string | null;
  chequeNo: string | null;
  paidBy: { name: string; role: string };
  generatedAt: string;
}

/**
 * One line of a supplier statement, as Paper draws it (the supplier's view of our account): `credit` adds to what we owe
 * (an invoice, a reversed payment), `debit` reduces it (a payment, an advance, a voided invoice). `balance` is what we owe
 * after the line; a negative balance is credit held with the supplier.
 */
export interface StatementLine {
  at: string;
  date: string;
  kind: 'INVOICE' | 'ADVANCE' | 'PAYMENT' | 'REVERSAL' | 'VOID';
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  /** The line is struck through (a voided invoice, or a payment that was reversed). */
  superseded: boolean;
  orderId: string;
}

export interface SupplierOwing {
  /** What we owe on open invoices after advances and payments. */
  owing: string;
  overdue: string;
  overdueCount: number;
  openInvoices: number;
  disputedAmount: string;
  /** Advances held that no invoice has used yet, plus any left over from a short delivery. */
  creditHeld: string;
  nextDueDate: string | null;
}

export interface SupplierPurchasing {
  owing: SupplierOwing;
  orders: OrderRow[];
}

export interface SupplierStatement {
  supplier: { id: string; name: string; code: string; address: string; contactName: string | null; termsDays: number | null };
  from: string;
  to: string;
  /** What we owed at the start of the period. */
  openingBalance: string;
  lines: StatementLine[];
  /** Totals for the period. */
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  /** Open invoices by days past due at `to`. */
  ageing: { current: string; days1to30: string; days31to60: string; days61to90: string; days90plus: string };
  generatedAt: string;
}

export interface AuditRow {
  id: string;
  at: string;
  actor: { id: string; name: string; role: string };
  action: string;
  area: AuditArea;
  document: string | null;
  detail: string;
  what: string;
  orderId: string;
  orderReference: string | null;
  supplierName: string;
}

export interface DocumentInput {
  title: string;
  fileId: string;
}

export interface OrdersQuery {
  stage?: Stage;
  supplierId?: string;
  raisedBy?: string;
  q?: string;
}

export interface NeedsQuery {
  group?: 'supplier' | 'item';
  supplierId?: string;
  q?: string;
  sort?: 'urgent' | 'name' | 'value';
}

/** Error codes of §31.6. */
export type PurchasingErrorCode =
  | 'INVALID_PIN'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_WRONG_STATE'
  | 'SUPPLIER_ORDER_OPEN'
  | 'SUPPLIER_ON_HOLD'
  | 'ITEM_SETUP_INCOMPLETE'
  | 'CANNOT_CANCEL_AFTER_DELIVERY'
  | 'PRICE_CHANGE_UNCONFIRMED'
  | 'RECEIVED_EXCEEDS_ORDERED'
  | 'DELIVERY_NOTE_REQUIRED'
  | 'DEPOSIT_EXCEEDS_ORDER'
  | 'INVOICE_EXISTS'
  | 'DUPLICATE_INVOICE_NUMBER'
  | 'REASON_REQUIRED'
  | 'INVOICE_HAS_PAYMENTS'
  | 'INVOICE_DISPUTED'
  | 'INVOICE_NOT_DISPUTED'
  | 'INVOICE_NOT_FOUND'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_REVERSED'
  | 'SUPPLIER_NOT_FOUND'
  | 'PAYMENT_EXCEEDS_BALANCE'
  | 'CHEQUE_NUMBER_REQUIRED'
  | 'VALIDATION'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_BAD_TYPE'
  | 'UPLOAD_FAILED'
  | 'FORBIDDEN';

const STATUS: Partial<Record<PurchasingErrorCode, number>> = {
  INVALID_PIN: 401,
  FORBIDDEN: 403,
  ORDER_NOT_FOUND: 404,
  INVOICE_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  SUPPLIER_NOT_FOUND: 404,
  UPLOAD_FAILED: 503,
};

/**
 * What the mock throws. It is an `ApiError` (same status/code/details shape the real server sends), so the shared loaders,
 * actions and error cards show its message exactly as they will show the real back-end's.
 */
export class PurchasingError extends ApiError {
  declare readonly code: PurchasingErrorCode;
  declare readonly details: Record<string, unknown>;
  constructor(code: PurchasingErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message, STATUS[code] ?? (code === 'VALIDATION' || code.endsWith('REQUIRED') || code.startsWith('UPLOAD') ? 422 : 409), code, details);
    this.name = 'PurchasingError';
  }
}
