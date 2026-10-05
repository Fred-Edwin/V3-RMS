import type {
  CancelReason,
  CatalogResult,
  DepositInput,
  FileRef,
  LpoPrint,
  NeedsQuery,
  NeedsRestocking,
  Order,
  OrderInput,
  OrderRow,
  OrdersQuery,
  Payment,
  PurchaseFile,
  ReceiveInput,
  SendVia,
  Summary,
  WhatsappMessage,
} from '../types';

/**
 * The ONE interface the Purchasing screens use (docs/API_CONTRACT.md §31). Today `mock/mock-service.ts` implements it in
 * the browser; the back-end session writes an HTTP implementation of the same interface and nothing in a screen changes.
 * Screens import this file (and the hook that supplies it), never the mock folder.
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
  receiveOrder: (id: string, input: ReceiveInput) => Promise<Order>;
}
