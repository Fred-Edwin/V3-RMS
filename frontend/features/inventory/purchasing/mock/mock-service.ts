import type { PurchasingService } from '../services/purchasing-service';
import * as engine from './engine';
import type { Ctx, State } from './engine';
import type { MockStore } from './store';

interface Options {
  /** Pretend network time so in-flight states are visible in the demo. Tests use 0. */
  latencyMs?: number;
  now?: () => Date;
}

/** The mock implementation of `PurchasingService`: the engine behind the contract's operations, for one caller. */
export function createMockPurchasingService(store: MockStore, ctx: Ctx, options: Options = {}): PurchasingService {
  const { latencyMs = 0, now = () => new Date() } = options;
  const wait = (): Promise<void> => (latencyMs > 0 ? new Promise((r) => setTimeout(r, latencyMs)) : Promise.resolve());

  const read = async <T>(fn: (s: State) => T): Promise<T> => {
    await wait();
    return fn(store.get());
  };
  /** A write works on a copy and keeps it only if nothing threw, so a refused action leaves no trace. */
  const write = async <T>(fn: (s: State) => T): Promise<T> => {
    await wait();
    const draft = structuredClone(store.get());
    const result = fn(draft);
    store.set(draft);
    return result;
  };

  return {
    getSummary: () => read((s) => engine.getSummary(s, ctx, now())),
    getNeedsRestocking: (q = {}) => read((s) => engine.needsRestocking(s, ctx, q)),
    listOrders: (q = {}) => read((s) => engine.listOrders(s, ctx, q, now())),
    getOrder: (id) => read((s) => engine.getOrder(s, ctx, id, now())),
    getLpo: (id) => read((s) => engine.lpoPrint(s, ctx, id, now())),
    getWhatsapp: (id) => read((s) => engine.whatsappMessage(s, ctx, id)),
    getCatalog: (q) => read((s) => engine.catalog(s, ctx, q)),

    createOrder: (input) => write((s) => engine.createOrder(s, ctx, input, now())),
    updateOrder: (id, input) => write((s) => engine.updateOrder(s, ctx, id, input, now())),
    discardOrder: (id) => write((s) => engine.discardOrder(s, ctx, id)),
    submitOrder: (id) => write((s) => engine.submitOrder(s, ctx, id, now())),
    approveOrder: (id, pin) => write((s) => engine.approveOrder(s, ctx, id, pin, now())),
    returnOrder: (id, note) => write((s) => engine.returnOrder(s, ctx, id, note, now())),
    sendOrder: (id, via) => write((s) => engine.sendOrder(s, ctx, id, via, now())),
    cancelOrder: (id, input) => write((s) => engine.cancelOrder(s, ctx, id, input, now())),

    recordDeposit: (id, input) => write((s) => engine.recordDeposit(s, ctx, id, input, now())),
    upload: (file) => write((s) => engine.addUpload(s, { fileName: file.name, size: file.size, mime: file.type, thumbnail: null })),
    receiveOrder: (id, input) => write((s) => engine.receiveOrder(s, ctx, id, input, now())),

    addInvoice: (orderId, input) => write((s) => engine.addInvoice(s, ctx, orderId, input, now())),
    settleDispute: (invoiceId, input) => write((s) => engine.settleDispute(s, ctx, invoiceId, input, now())),
    voidInvoice: (invoiceId, input) => write((s) => engine.voidInvoice(s, ctx, invoiceId, input, now())),
    recordPayment: (invoiceId, input) => write((s) => engine.recordPayment(s, ctx, invoiceId, input, now())),
    reversePayment: (paymentId, input) => write((s) => engine.reversePayment(s, ctx, paymentId, input, now())),
    getPaymentAdvice: (paymentId) => read((s) => engine.paymentAdvice(s, ctx, paymentId, now())),

    getSupplierPurchasing: (supplierId) => read((s) => engine.supplierPurchasing(s, ctx, supplierId, now())),
    getSupplierStatement: (supplierId, range) => read((s) => engine.supplierStatement(s, ctx, supplierId, now(), range)),
    getAuditLog: () => read((s) => engine.auditLog(s, ctx)),
    addDocument: (orderId, input) => write((s) => engine.addDocument(s, ctx, orderId, input, now())),
  };
}
