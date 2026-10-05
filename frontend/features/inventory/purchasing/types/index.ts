/**
 * Purchasing and Receiving types: the shapes in `docs/API_CONTRACT.md` §31. Decimals cross the wire as strings; the screens
 * format them, the engine does the arithmetic. The mock returns exactly these, so wiring the real back-end swaps the data
 * source and not the screens.
 */
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
  varianceAmount: string | null;
  varianceReason: string | null;
  advanceApplied: string;
  balance: string;
  photo: FileRef | null;
  enteredBy: Person;
  enteredAt: string;
}

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

export interface PurchaseFile extends Order {
  documents: Array<{ kind: 'LPO' | 'DELIVERY_NOTE' | 'INVOICE' | 'PAYMENT_ADVICE'; title: string; at: string; fileRef: FileRef | null }>;
  activity: Array<{ at: string; actor: { id: string; name: string }; what: string }>;
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
  | 'PAYMENT_EXCEEDS_BALANCE'
  | 'CHEQUE_NUMBER_REQUIRED'
  | 'VALIDATION'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_BAD_TYPE'
  | 'UPLOAD_FAILED'
  | 'FORBIDDEN';

export class PurchasingError extends Error {
  constructor(
    readonly code: PurchasingErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PurchasingError';
  }
}
