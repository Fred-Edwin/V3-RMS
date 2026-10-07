import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import { isPurchasingError } from '../types';
import { createPurchasingApiService } from './purchasing-api-service';

/**
 * Contract tests for the HTTP implementation of `PurchasingService` against mocked `fetch` answers shaped like
 * docs/API_CONTRACT.md §31 and §31.9: each operation calls the right method and path with the right body, unwraps the
 * `{success, data}` envelope, and turns a refusal into an `ApiError` carrying the server's code, message and details.
 */
const ID = '4edb25d2-68c0-4f9b-9d8f-7cc5535def3d';
const SUPPLIER = 'eb2f4d41-4ee2-4497-80ca-6d104f7ee899';

interface Call {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

let calls: Call[] = [];
let answers: Response[] = [];

const ok = (data: unknown, status = 200): Response => new Response(JSON.stringify({ success: true, data }), { status, headers: { 'Content-Type': 'application/json' } });
const refuse = (status: number, code: string, message: string, details?: unknown): Response =>
  new Response(JSON.stringify({ success: false, error: { code, message, details } }), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  calls = [];
  answers = [];
  useAuthStore.setState({ accessToken: 'test-token' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({
        method: init.method ?? 'GET',
        path: url.replace(/^https?:\/\/[^/]+\/api\/v1/, ''),
        body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
        headers: (init.headers ?? {}) as Record<string, string>,
      });
      const next = answers.shift();
      if (!next) throw new Error('no answer queued');
      return next;
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAuthStore.setState({ accessToken: null });
});

const svc = createPurchasingApiService();
const last = (): Call => calls[calls.length - 1] as Call;

describe('contract: reads', () => {
  it('getSummary, getNeedsRestocking, listOrders and getOrder call their paths with the query', async () => {
    answers.push(ok({ counts: { needs: 1, approval: 0, receive: 0, invoice: 0, pay: 0, closed: 0 }, awaitingApprovalValue: '0.00', dueToReceiveCount: 0 }));
    expect((await svc.getSummary()).counts.needs).toBe(1);
    expect(last()).toMatchObject({ method: 'GET', path: '/inventory/purchasing/summary' });

    answers.push(ok({ itemCount: 0, supplierCount: 0, groups: [], suppliers: [] }));
    await svc.getNeedsRestocking({ group: 'item', sort: 'name', q: 'milk' });
    expect(last().path).toBe('/inventory/purchasing/needs-restocking?group=item&q=milk&sort=name');

    answers.push(ok({ orders: [], total: 0, valueTotal: '0.00' }));
    await svc.listOrders({ stage: 'PAY', supplierId: SUPPLIER });
    expect(last().path).toBe(`/inventory/purchasing/orders?stage=PAY&supplierId=${SUPPLIER}`);

    answers.push(ok({ id: ID, lines: [], documents: [], activity: [] }));
    expect((await svc.getOrder(ID)).id).toBe(ID);
    expect(last().path).toBe(`/inventory/purchasing/orders/${ID}`);
  });

  it('sends the signed-in person’s bearer token, and omits empty query values', async () => {
    answers.push(ok({ orders: [], total: 0, valueTotal: '0.00' }));
    await svc.listOrders({ q: '' });
    expect(last().path).toBe('/inventory/purchasing/orders');
    expect(last().headers.Authorization).toBe('Bearer test-token');
  });

  it('getLpo, getWhatsapp, getCatalog and getPaymentAdvice call their paths', async () => {
    answers.push(ok({ reference: 'LPO-0044', lines: [] }));
    expect((await svc.getLpo(ID)).reference).toBe('LPO-0044');
    expect(last().path).toBe(`/inventory/purchasing/orders/${ID}/lpo`);

    answers.push(ok({ to: 'Samrat', phone: null, message: 'Hello', pdfFileName: 'LPO-0044.pdf', pdfSizeLabel: '40 KB' }));
    expect((await svc.getWhatsapp(ID)).pdfFileName).toBe('LPO-0044.pdf');
    expect(last().path).toBe(`/inventory/purchasing/orders/${ID}/whatsapp`);

    answers.push(ok({ items: [], shown: 0, total: 0, counts: { lowOrOut: 0, all: 0 } }));
    await svc.getCatalog({ supplierId: SUPPLIER, filter: 'all' });
    expect(last().path).toBe(`/inventory/purchasing/catalog?supplierId=${SUPPLIER}&filter=all`);

    answers.push(ok({ reference: 'PAY-0031' }));
    await svc.getPaymentAdvice('pay-1');
    expect(last().path).toBe('/inventory/purchasing/payments/pay-1/advice');
  });

  it('the supplier’s orders and statement use the supplier id and the date range', async () => {
    answers.push(ok({ owing: { owing: '0.00', invoices: [] }, orders: [] }));
    await svc.getSupplierPurchasing(SUPPLIER);
    expect(last().path).toBe(`/inventory/purchasing/suppliers/${SUPPLIER}/orders`);

    answers.push(ok({ lines: [] }));
    await svc.getSupplierStatement(SUPPLIER, { from: '2026-09-01', to: '2026-09-30' });
    expect(last().path).toBe(`/inventory/purchasing/suppliers/${SUPPLIER}/statement?from=2026-09-01&to=2026-09-30`);
  });

  it('getFileUrl asks for the short-lived link', async () => {
    answers.push(ok({ url: 'https://files.example/x', expiresAt: '2026-10-06T12:00:00.000Z', fileName: 'note.jpg' }));
    expect((await svc.getFileUrl('file-1')).url).toBe('https://files.example/x');
    expect(last().path).toBe('/inventory/purchasing/uploads/file-1/url');
  });
});

describe('contract: order writes', () => {
  it('createOrder posts the lines; updateOrder patches; submit, approve, return, send and cancel post their bodies', async () => {
    const input = { supplierId: SUPPLIER, expectedDate: null, supplierNote: null, attendantNote: 'Low on chicken', lines: [{ inventoryItemId: 'item-1', qty: '5', unitPrice: '' }] };
    answers.push(ok({ id: ID, status: 'DRAFT' }));
    expect((await svc.createOrder(input)).status).toBe('DRAFT');
    expect(last()).toMatchObject({ method: 'POST', path: '/inventory/purchasing/orders', body: input });

    answers.push(ok({ id: ID }));
    await svc.updateOrder(ID, { expectedDate: '2026-10-10' });
    expect(last()).toMatchObject({ method: 'PATCH', path: `/inventory/purchasing/orders/${ID}`, body: { expectedDate: '2026-10-10' } });

    answers.push(ok({ id: ID }));
    await svc.submitOrder(ID);
    expect(last()).toMatchObject({ method: 'POST', path: `/inventory/purchasing/orders/${ID}/submit`, body: {} });

    answers.push(ok({ id: ID }));
    await svc.approveOrder(ID, '1234');
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/approve`, body: { pin: '1234' } });

    answers.push(ok({ id: ID }));
    await svc.returnOrder(ID, 'Check the quantity');
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/return`, body: { note: 'Check the quantity' } });

    answers.push(ok({ id: ID }));
    await svc.sendOrder(ID, 'WHATSAPP');
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/send`, body: { via: 'WHATSAPP' } });

    answers.push(ok({ id: ID }));
    await svc.cancelOrder(ID, { reason: 'OTHER', note: 'x', pin: '1234' });
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/cancel`, body: { reason: 'OTHER', note: 'x', pin: '1234' } });
  });

  it('discardOrder deletes a draft and accepts the empty 204 answer', async () => {
    answers.push(new Response(null, { status: 204 }));
    await expect(svc.discardOrder(ID)).resolves.toBeUndefined();
    expect(last()).toMatchObject({ method: 'DELETE', path: `/inventory/purchasing/orders/${ID}` });
  });
});

describe('contract: receiving and uploads', () => {
  it('upload sends the file as multipart and returns the FileRef', async () => {
    answers.push(ok({ id: 'file-1', fileName: 'note.jpg', size: 3, thumbnail: null }));
    const ref = await svc.upload(new File(['abc'], 'note.jpg', { type: 'image/jpeg' }));
    expect(ref.id).toBe('file-1');
    expect(last().method).toBe('POST');
    expect(last().path).toBe('/inventory/purchasing/uploads');
    expect(last().body).toBeInstanceOf(FormData);
    // The browser sets the multipart boundary itself: no JSON content type may be forced.
    expect(last().headers['Content-Type']).toBeUndefined();
  });

  it('receiveOrder sends the typed delivery price and its confirmation per line', async () => {
    const input = {
      lines: [
        { lineId: 'l1', receivedQty: '4', deliveredPrice: '2600', priceConfirmed: true },
        { lineId: 'l2', receivedQty: '10', deliveredPrice: null, priceConfirmed: false },
      ],
      deliveryNoteNo: 'DN-77120',
      deliveryNotePhotoId: 'file-1',
      pin: '1234',
    };
    answers.push(ok({ id: ID, status: 'DELIVERED' }));
    expect((await svc.receiveOrder(ID, input)).status).toBe('DELIVERED');
    expect(last()).toMatchObject({ method: 'POST', path: `/inventory/purchasing/orders/${ID}/receive`, body: input });
  });
});

describe('contract: invoice and payment', () => {
  it('recordDeposit returns the Payment; recordPayment and reversePayment return {payment, order}', async () => {
    answers.push(ok({ id: 'p1', kind: 'ADVANCE' }));
    expect((await svc.recordDeposit(ID, { amount: '5000', paidOn: '2026-10-05', method: 'CASH', methodRef: null, chequeNo: null, note: null })).kind).toBe('ADVANCE');
    expect(last().path).toBe(`/inventory/purchasing/orders/${ID}/deposits`);

    answers.push(ok({ payment: { id: 'p2', kind: 'INVOICE' }, order: { id: ID, status: 'CLOSED' } }));
    const paid = await svc.recordPayment('inv-1', { amount: '1000', paidOn: '2026-10-05', method: 'MPESA_PAYBILL', methodRef: 'QX1', chequeNo: null, proofPhotoId: null, confirmOverpay: true });
    expect(paid.order.status).toBe('CLOSED');
    expect(last()).toMatchObject({ path: '/inventory/purchasing/invoices/inv-1/payments', body: { confirmOverpay: true } });

    answers.push(ok({ payment: { id: 'p3', kind: 'REVERSAL' }, order: { id: ID } }));
    await svc.reversePayment('p2', { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' });
    expect(last()).toMatchObject({ path: '/inventory/purchasing/payments/p2/reverse', body: { reason: 'WRONG_AMOUNT', note: null, approverPin: '1234' } });
  });

  it('addInvoice carries differentInvoice after the duplicate warning; settle, void and addDocument post their bodies', async () => {
    answers.push(ok({ id: 'inv-1' }));
    await svc.addInvoice(ID, { number: 'INV-05188', date: '2026-10-04', amount: '1000', photoId: null, varianceReason: null, differentInvoice: true });
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/invoice`, body: { number: 'INV-05188', differentInvoice: true } });

    answers.push(ok({ id: 'inv-1' }));
    await svc.settleDispute('inv-1', { agreedAmount: '950', note: 'Agreed by phone' });
    expect(last().path).toBe('/inventory/purchasing/invoices/inv-1/settle-dispute');

    answers.push(ok({ id: ID }));
    await svc.voidInvoice('inv-1', { reason: 'DUPLICATE', pin: '1234' });
    expect(last()).toMatchObject({ path: '/inventory/purchasing/invoices/inv-1/void', body: { reason: 'DUPLICATE', pin: '1234' } });

    answers.push(ok({ kind: 'OTHER', title: 'Extra' }));
    await svc.addDocument(ID, { title: 'Extra', fileId: 'file-2' });
    expect(last()).toMatchObject({ path: `/inventory/purchasing/orders/${ID}/documents`, body: { title: 'Extra', fileId: 'file-2' } });
  });
});

describe('contract: the Purchasing and Payments rows of the Audit log', () => {
  it('reads both areas from /inventory/audit-log and returns one newest-first list of purchase-file rows', async () => {
    const entry = (id: string, at: string, area: string, action: string) => ({
      id,
      at,
      actor: { id: 'u1', name: 'Margaret', role: 'ACCOUNTANT' },
      area,
      what: 'did something',
      reason: null,
      purchasing: { action, document: 'LPO-0044', detail: 'KES 12,000', orderId: ID, orderReference: 'LPO-0044', supplierName: 'Samrat' },
    });
    answers.push(ok({ entries: [entry('purchasing:a', '2026-10-05T08:00:00.000Z', 'PURCHASING', 'Approved order')], actors: [], pagination: { total: 1, page: 1, perPage: 100, totalPages: 1 } }));
    answers.push(ok({ entries: [entry('purchasing:b', '2026-10-05T09:00:00.000Z', 'PAYMENTS', 'Recorded payment')], actors: [], pagination: { total: 1, page: 1, perPage: 100, totalPages: 1 } }));
    const rows = await svc.getAuditLog();
    expect(calls.map((c) => c.path).sort()).toEqual(['/inventory/audit-log?area=PAYMENTS&perPage=100', '/inventory/audit-log?area=PURCHASING&perPage=100']);
    expect(rows.map((r) => [r.id, r.area, r.action, r.actor.role, r.orderId])).toEqual([
      ['purchasing:b', 'Payments', 'Recorded payment', 'Accountant', ID],
      ['purchasing:a', 'Purchasing', 'Approved order', 'Accountant', ID],
    ]);
  });
});

describe('contract: refusals', () => {
  it('a refusal becomes an ApiError with the server’s status, code, plain message and details', async () => {
    answers.push(refuse(409, 'SUPPLIER_ORDER_OPEN', 'LPO-0043 to Samrat is still open.', { openOrderId: ID, openReference: 'LPO-0043' }));
    const error = await svc.createOrder({ supplierId: SUPPLIER, expectedDate: null, supplierNote: null, attendantNote: null, lines: [] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(409);
    expect((error as ApiError).message).toBe('LPO-0043 to Samrat is still open.');
    expect(isPurchasingError(error, 'SUPPLIER_ORDER_OPEN')).toBe(true);
    expect((error as ApiError).details).toEqual({ openOrderId: ID, openReference: 'LPO-0043' });
  });

  it('a wrong PIN, an overpayment, a duplicate invoice number and a disputed invoice carry their codes', async () => {
    answers.push(refuse(401, 'INVALID_PIN', 'That PIN is not right.'));
    expect(isPurchasingError(await svc.approveOrder(ID, '0000').catch((e: unknown) => e), 'INVALID_PIN')).toBe(true);

    answers.push(refuse(422, 'PAYMENT_EXCEEDS_BALANCE', 'That is more than the KES 500.00 owed.', { balance: '500.00' }));
    expect(isPurchasingError(await svc.recordPayment('inv-1', { amount: '900', paidOn: '2026-10-05', method: 'CASH', methodRef: null, chequeNo: null, proofPhotoId: null }).catch((e: unknown) => e), 'PAYMENT_EXCEEDS_BALANCE')).toBe(true);

    answers.push(refuse(409, 'DUPLICATE_INVOICE_NUMBER', 'Samrat already has an invoice INV-1 on LPO-0040.', { existingOrderId: ID, existingReference: 'LPO-0040' }));
    expect(isPurchasingError(await svc.addInvoice(ID, { number: 'INV-1', date: '2026-10-04', amount: '1', photoId: null, varianceReason: null }).catch((e: unknown) => e), 'DUPLICATE_INVOICE_NUMBER')).toBe(true);

    answers.push(refuse(409, 'INVOICE_DISPUTED', 'This invoice is in dispute. Settle it with the supplier before paying.'));
    expect(isPurchasingError(await svc.recordPayment('inv-1', { amount: '1', paidOn: '2026-10-05', method: 'CASH', methodRef: null, chequeNo: null, proofPhotoId: null }).catch((e: unknown) => e), 'INVOICE_DISPUTED')).toBe(true);
  });

  it('a failed upload and a refused discard keep their codes', async () => {
    answers.push(refuse(422, 'UPLOAD_TOO_LARGE', 'That file is too large. The limit is 10 MB.'));
    expect(isPurchasingError(await svc.upload(new File(['abc'], 'big.jpg', { type: 'image/jpeg' })).catch((e: unknown) => e), 'UPLOAD_TOO_LARGE')).toBe(true);

    answers.push(refuse(409, 'ORDER_WRONG_STATE', 'This order is sent, so you cannot do that.'));
    expect(isPurchasingError(await svc.discardOrder(ID).catch((e: unknown) => e), 'ORDER_WRONG_STATE')).toBe(true);
  });
});
