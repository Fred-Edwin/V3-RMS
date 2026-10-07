import type {
  AuditRow,
  CancelReason,
  CatalogResult,
  DepositInput,
  DocumentInput,
  FileDocument,
  FileLink,
  FileRef,
  Invoice,
  InvoiceInput,
  LpoPrint,
  NeedsQuery,
  NeedsRestocking,
  Order,
  OrderInput,
  OrderRow,
  OrdersQuery,
  Payment,
  PaymentAdvice,
  PaymentInput,
  PaymentResult,
  PurchaseFile,
  ReceiveInput,
  ReverseReason,
  SendVia,
  Summary,
  SupplierPurchasing,
  SupplierStatement,
  VoidReason,
  WhatsappMessage,
} from '../types';

/**
 * The ONE interface the Purchasing screens use (docs/API_CONTRACT.md §31). `purchasing-api-service.ts` implements it over HTTP.
 * Screens import this file (and the hook that supplies it), never the API client.
 */
export interface PurchasingService {
  getSummary: () => Promise<Summary>;
  getNeedsRestocking: (query?: NeedsQuery) => Promise<NeedsRestocking>;
  listOrders: (query?: OrdersQuery) => Promise<{ orders: OrderRow[]; total: number; valueTotal: string }>;
  getOrder: (id: string) => Promise<PurchaseFile>;
  getLpo: (id: string) => Promise<LpoPrint>;
  getWhatsapp: (id: string) => Promise<WhatsappMessage>;
  getCatalog: (query: { supplierId: string; q?: string; filter?: 'low' | 'all' | 'selected' }) => Promise<CatalogResult>;

  createOrder: (input: OrderInput) => Promise<Order>;
  updateOrder: (id: string, input: Partial<OrderInput>) => Promise<Order>;
  discardOrder: (id: string) => Promise<void>;
  submitOrder: (id: string) => Promise<Order>;
  approveOrder: (id: string, pin: string) => Promise<Order>;
  returnOrder: (id: string, note: string) => Promise<Order>;
  sendOrder: (id: string, via: SendVia) => Promise<Order>;
  cancelOrder: (id: string, input: { reason: CancelReason; note: string | null; pin: string }) => Promise<Order>;

  recordDeposit: (id: string, input: DepositInput) => Promise<Payment>;
  upload: (file: File) => Promise<FileRef>;
  /** A short-lived link to open an uploaded photo or PDF (`GET /uploads/:id/url`); refused for money files when the caller is blind to money. */
  getFileUrl: (fileId: string) => Promise<FileLink>;
  receiveOrder: (id: string, input: ReceiveInput) => Promise<Order>;

  // Invoice and payment (§31.5). Invoice and payment ids come from the order's `invoice` and `payments`.
  addInvoice: (orderId: string, input: InvoiceInput) => Promise<Invoice>;
  settleDispute: (invoiceId: string, input: { agreedAmount: string; note: string }) => Promise<Invoice>;
  voidInvoice: (invoiceId: string, input: { reason: VoidReason; pin: string }) => Promise<Order>;
  recordPayment: (invoiceId: string, input: PaymentInput) => Promise<PaymentResult>;
  reversePayment: (paymentId: string, input: { reason: ReverseReason; note: string | null; approverPin: string }) => Promise<PaymentResult>;
  getPaymentAdvice: (paymentId: string) => Promise<PaymentAdvice>;

  getSupplierPurchasing: (supplierId: string) => Promise<SupplierPurchasing>;
  getSupplierStatement: (supplierId: string, range?: { from?: string; to?: string }) => Promise<SupplierStatement>;
  getAuditLog: () => Promise<AuditRow[]>;

  /** "+ Add a document" on the purchase file: attach an uploaded photo or PDF with a name. */
  addDocument: (orderId: string, input: DocumentInput) => Promise<FileDocument>;
}
