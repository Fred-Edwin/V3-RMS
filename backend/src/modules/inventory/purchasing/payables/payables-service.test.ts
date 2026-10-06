import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { purchasingPin } from '../_shared/pin';
import { purchasingAudit } from '../_shared/purchasing-audit';
import { ordersRepository } from '../orders/orders-repository';
import { payablesRepository } from './payables-repository';
import payablesRouter from './payables-routes';
import { payablesService } from './payables-service';

vi.mock('../orders/orders-repository', () => ({ ordersRepository: { findOrder: vi.fn(), findOrderInTx: vi.fn(), transition: vi.fn() } }));
vi.mock('./payables-repository', () => ({
  payablesRepository: {
    findOrderByInvoice: vi.fn(), findOrderByPayment: vi.fn(), findDuplicateInvoice: vi.fn(), createInvoice: vi.fn(), setInvoiceStatus: vi.fn(),
    settleInvoice: vi.fn(), voidInvoice: vi.fn(), createPayment: vi.fn(), markPaymentReversed: vi.fn(), createDocument: vi.fn(),
  },
}));
vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({}) } }));
vi.mock('../../../../middleware/authenticate', () => ({ authenticate: (_r: unknown, _s: unknown, next: () => void) => next() }));
vi.mock('../../_shared/reference-counter', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../_shared/pin', () => ({ purchasingPin: { verifyOwn: vi.fn(), verifyReversalApprover: vi.fn() } }));
vi.mock('../_shared/purchasing-audit', async (orig) => ({ ...(await orig<object>()), purchasingAudit: { record: vi.fn() } }));
vi.mock('../files/files-service', () => ({ purchaseFileService: { resolve: vi.fn().mockResolvedValue(null) } }));

const HUB = 'hub-1';
const D = (v: number | string) => new Prisma.Decimal(v);
const NOW = new Date('2026-10-06T08:00:00Z');
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const person = (id: string, role: string) => ({ id, name: id, role });

const invoice = (over: Record<string, unknown> = {}) => ({
  id: 'i1', number: 'INV-1', invoiceDate: NOW, dueDate: NOW, amount: D(10000), status: 'OPEN', disputed: false, varianceAmount: null, varianceReason: null,
  settledAmount: null, settledNote: null, settledById: null, settledAt: null, settledBy: null, voidReason: null, voidedById: null, voidedAt: null, voidedBy: null,
  file: null, enteredBy: person('acc', 'ACCOUNTANT'), enteredAt: NOW, ...over,
});
const payment = (over: Record<string, unknown> = {}) => ({
  id: 'p1', reference: 'PAY-0001', kind: 'INVOICE', status: 'RECORDED', amount: D(4000), paidOn: NOW, method: 'BANK_TRANSFER', methodRef: 'TX1', chequeNo: null, note: null,
  reversesId: null, reverseReason: null, invoiceId: 'i1', proofFile: null, approvedBy: null, recordedBy: person('acc', 'ACCOUNTANT'), recordedAt: NOW, ...over,
});
const order = (over: Record<string, unknown> = {}) =>
  ({
    id: 'o1', reference: 'LPO-0001', supplierId: 'sup', status: 'DELIVERED', termsDays: 14, expectedDate: null, supplierNote: null, attendantNote: null, raisedById: 'att',
    submittedAt: NOW, approvedById: null, approvedAt: null, returnedNote: null, returnedById: null, returnedAt: null, sentAt: NOW, sentVia: 'WHATSAPP',
    cancelReason: null, cancelNote: null, cancelledById: null, cancelledAt: null, createdAt: NOW, updatedAt: NOW,
    supplier: { id: 'sup', name: 'Samrat', code: 'S1', address: 'Nyeri', kraPin: 'P0001', defaultPaymentTerms: 'INVOICE_TO_FOLLOW', paymentDays: 14, contacts: [{ name: 'Ravi', phone: '1', whatsapp: '2' }], payMethods: [{ type: 'BANK_TRANSFER', bankName: 'KCB', accountNumber: '1234567890', paybillNumber: null, tillNumber: null, phone: null, registeredName: null, isDefault: true }] },
    raisedBy: person('att', 'STORE_ATTENDANT'), approvedBy: null, returnedBy: null, cancelledBy: null,
    lines: [{ id: 'l1', inventoryItemId: 'sugar', lineOrder: 1, supplierItemName: null, supplierItemCode: null, buyUnit: 'kg', packSize: D(1), orderedQty: D(100), unitPrice: D(100), previousPrice: null, receivedQty: D(100), deliveredPrice: null, confirmedPrice: D(100), result: 'AS_ORDERED', inventoryItem: { name: 'Sugar' } }],
    delivery: { id: 'd1', reference: 'GRN-0001', deliveryNoteNo: 'DN1', deliveryNoteFile: null, receivedBy: person('att', 'STORE_ATTENDANT'), receivedAt: NOW, deliveredTotal: D(10000), notSuppliedTotal: D(0), lines: [] },
    invoices: [], payments: [], documents: [], audit: [], ...over,
  }) as never;

const invoiced = (payments: unknown[] = [], inv: Record<string, unknown> = {}) => order({ status: 'INVOICED', invoices: [invoice(inv)], payments });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(ordersRepository.transition).mockResolvedValue(true);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('PAY-0002');
  vi.mocked(payablesRepository.createPayment).mockResolvedValue('p2');
  vi.mocked(payablesRepository.findDuplicateInvoice).mockResolvedValue(null);
  vi.mocked(payablesRepository.settleInvoice).mockResolvedValue(true);
  vi.mocked(payablesRepository.voidInvoice).mockResolvedValue(true);
  vi.mocked(payablesRepository.markPaymentReversed).mockResolvedValue(true);
});

const found = (o: unknown) => {
  vi.mocked(ordersRepository.findOrder).mockResolvedValue(o as never);
  vi.mocked(ordersRepository.findOrderInTx).mockResolvedValue(o as never);
  vi.mocked(payablesRepository.findOrderByInvoice).mockResolvedValue(o as never);
  vi.mocked(payablesRepository.findOrderByPayment).mockResolvedValue(o as never);
};

const deposit = { amount: '2500', paidOn: '2026-10-06', method: 'BANK_TRANSFER' as const, methodRef: 'TX', chequeNo: null, note: null };

describe('recordDeposit', () => {
  it('records an advance numbered PAY-nnnn with a PAYMENTS audit row', async () => {
    found(order({ status: 'SENT' }));
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(order({ status: 'SENT', payments: [payment({ id: 'p2', kind: 'ADVANCE', invoiceId: null })] }));
    const r = await payablesService.recordDeposit(accountant, 'o1', deposit, NOW);
    expect(payablesRepository.createPayment).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'ADVANCE', invoiceId: null, reference: 'PAY-0002', amount: D(2500) }));
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ area: 'PAYMENTS', action: 'Recorded advance payment' }), NOW);
    expect(r.payment.kind).toBe('ADVANCE');
  });

  it('refuses an advance above the order total, a cheque with no number, and a draft order', async () => {
    found(order({ status: 'SENT' }));
    await expect(payablesService.recordDeposit(accountant, 'o1', { ...deposit, amount: '10001' }, NOW)).rejects.toMatchObject({ code: 'DEPOSIT_EXCEEDS_ORDER', statusCode: 422 });
    await expect(payablesService.recordDeposit(accountant, 'o1', { ...deposit, method: 'CHEQUE' }, NOW)).rejects.toMatchObject({ code: 'CHEQUE_NUMBER_REQUIRED' });
    found(order({ status: 'DRAFT' }));
    await expect(payablesService.recordDeposit(accountant, 'o1', deposit, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });
});

describe('addInvoice', () => {
  const input = { number: 'INV-9', date: '2026-10-06', amount: '10000', photoId: null, varianceReason: null, differentInvoice: false };

  it('saves a matching invoice with the due date from the order terms', async () => {
    found(order());
    await payablesService.addInvoice(accountant, 'o1', input, NOW).catch(() => undefined);
    expect(payablesRepository.createInvoice).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ number: 'INV-9', disputed: false, varianceAmount: null, dueDate: new Date('2026-10-20T00:00:00Z'), amount: D(10000) }));
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', { from: ['DELIVERED'], status: 'INVOICED' });
  });

  it('needs a reason when the amount differs and then saves it as disputed', async () => {
    found(order());
    await expect(payablesService.addInvoice(accountant, 'o1', { ...input, amount: '10500' }, NOW)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
    await payablesService.addInvoice(accountant, 'o1', { ...input, amount: '10500', varianceReason: 'Sugar price up' }, NOW).catch(() => undefined);
    expect(payablesRepository.createInvoice).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ disputed: true, varianceAmount: D(500), varianceReason: 'Sugar price up' }));
  });

  it('warns about a duplicate number until the person says it is a different invoice', async () => {
    found(order());
    vi.mocked(payablesRepository.findDuplicateInvoice).mockResolvedValue({ orderId: 'o0', reference: 'LPO-0009' });
    await expect(payablesService.addInvoice(accountant, 'o1', input, NOW)).rejects.toMatchObject({ code: 'DUPLICATE_INVOICE_NUMBER', details: { existingOrderId: 'o0' } });
    await payablesService.addInvoice(accountant, 'o1', { ...input, differentInvoice: true }, NOW).catch(() => undefined);
    expect(payablesRepository.createInvoice).toHaveBeenCalledTimes(1);
  });

  it('allows one live invoice per order and only after delivery', async () => {
    found(invoiced());
    await expect(payablesService.addInvoice(accountant, 'o1', input, NOW)).rejects.toMatchObject({ code: 'INVOICE_EXISTS' });
    found(order({ status: 'SENT', delivery: null }));
    await expect(payablesService.addInvoice(accountant, 'o1', input, NOW)).rejects.toMatchObject({ code: 'ORDER_WRONG_STATE' });
  });
});

describe('settleDispute and voidInvoice', () => {
  it('settles a disputed invoice at the agreed amount', async () => {
    found(invoiced([], { disputed: true }));
    await payablesService.settleDispute(accountant, 'i1', { agreedAmount: '10200', note: 'Agreed by phone' }, NOW);
    expect(payablesRepository.settleInvoice).toHaveBeenCalledWith(expect.anything(), HUB, 'i1', expect.objectContaining({ amount: D(10200), settledNote: 'Agreed by phone', settledById: 'acc' }));
  });

  it('refuses to settle an invoice that is not in dispute', async () => {
    found(invoiced());
    await expect(payablesService.settleDispute(accountant, 'i1', { agreedAmount: '1', note: 'x' }, NOW)).rejects.toMatchObject({ code: 'INVOICE_NOT_DISPUTED' });
  });

  it('voids with a PIN and sends the order back to Delivered, but not once a payment stands', async () => {
    found(invoiced());
    await payablesService.voidInvoice(accountant, 'i1', { reason: 'WRONG_AMOUNT', pin: '1234' }, NOW);
    expect(purchasingPin.verifyOwn).toHaveBeenCalled();
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', { from: ['INVOICED'], status: 'DELIVERED' });
    vi.mocked(purchasingPin.verifyOwn).mockClear();
    found(invoiced([payment()]));
    await expect(payablesService.voidInvoice(accountant, 'i1', { reason: 'WRONG_AMOUNT', pin: '1234' }, NOW)).rejects.toMatchObject({ code: 'INVOICE_HAS_PAYMENTS' });
    expect(purchasingPin.verifyOwn).not.toHaveBeenCalled();
  });
});

describe('recordPayment', () => {
  const pay = { amount: '10000', paidOn: '2026-10-06', method: 'BANK_TRANSFER' as const, methodRef: 'TX9', chequeNo: null, proofPhotoId: null, confirmOverpay: false };

  it('closes the order when the invoice is paid in full', async () => {
    found(invoiced());
    vi.mocked(ordersRepository.findOrderInTx).mockResolvedValue(invoiced([payment({ id: 'p2', amount: D(10000) })]));
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(invoiced([payment({ id: 'p2', amount: D(10000) })]));
    await payablesService.recordPayment(accountant, 'i1', pay, NOW);
    expect(payablesRepository.setInvoiceStatus).toHaveBeenCalledWith(expect.anything(), HUB, 'i1', 'PAID');
    expect(ordersRepository.transition).toHaveBeenCalledWith(expect.anything(), HUB, 'o1', { from: ['INVOICED', 'CLOSED'], status: 'CLOSED' });
  });

  it('keeps it in To pay on a part payment', async () => {
    found(invoiced());
    vi.mocked(ordersRepository.findOrderInTx).mockResolvedValue(invoiced([payment({ id: 'p2', amount: D(4000) })]));
    vi.mocked(ordersRepository.findOrder).mockResolvedValue(invoiced([payment({ id: 'p2', amount: D(4000) })]));
    await payablesService.recordPayment(accountant, 'i1', { ...pay, amount: '4000' }, NOW);
    expect(payablesRepository.setInvoiceStatus).toHaveBeenCalledWith(expect.anything(), HUB, 'i1', 'OPEN');
  });

  it('asks before paying more than is owed (an advance counts)', async () => {
    found(invoiced([payment({ kind: 'ADVANCE', invoiceId: null, amount: D(2500) })]));
    await expect(payablesService.recordPayment(accountant, 'i1', { ...pay, amount: '8000' }, NOW)).rejects.toMatchObject({ code: 'PAYMENT_EXCEEDS_BALANCE', details: { balance: '7500.00' } });
    expect(payablesRepository.createPayment).not.toHaveBeenCalled();
    await payablesService.recordPayment(accountant, 'i1', { ...pay, amount: '8000', confirmOverpay: true }, NOW).catch(() => undefined);
    expect(payablesRepository.createPayment).toHaveBeenCalledTimes(1);
  });

  it('refuses a disputed invoice and a cheque with no number', async () => {
    found(invoiced([], { disputed: true }));
    await expect(payablesService.recordPayment(accountant, 'i1', pay, NOW)).rejects.toMatchObject({ code: 'INVOICE_DISPUTED' });
    found(invoiced());
    await expect(payablesService.recordPayment(accountant, 'i1', { ...pay, method: 'CHEQUE' }, NOW)).rejects.toMatchObject({ code: 'CHEQUE_NUMBER_REQUIRED' });
  });
});

describe('reversePayment', () => {
  const reverse = { reason: 'WRONG_AMOUNT' as const, note: 'Typed 4,000 not 40,000', approverPin: '9999' };

  it('adds a linked negative -R line approved by a manager and marks the original reversed', async () => {
    found(invoiced([payment()]));
    vi.mocked(purchasingPin.verifyReversalApprover).mockResolvedValue({ id: 'sm', name: 'Joseph', role: 'STORE_MANAGER', pinHash: 'h' });
    await payablesService.reversePayment(accountant, 'p1', reverse, NOW).catch(() => undefined);
    expect(payablesRepository.markPaymentReversed).toHaveBeenCalledWith(expect.anything(), HUB, 'p1');
    expect(payablesRepository.createPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reference: 'PAY-0001-R', kind: 'REVERSAL', amount: D(-4000), reversesId: 'p1', approvedById: 'sm', reverseReason: 'WRONG_AMOUNT' }),
    );
    expect(purchasingAudit.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'Reversed payment', area: 'PAYMENTS' }), NOW);
  });

  it('refuses a wrong approver PIN before anything is written, and a second reversal', async () => {
    found(invoiced([payment()]));
    vi.mocked(purchasingPin.verifyReversalApprover).mockRejectedValueOnce(Object.assign(new Error('pin'), { code: 'INVALID_PIN' }));
    await expect(payablesService.reversePayment(accountant, 'p1', reverse, NOW)).rejects.toMatchObject({ code: 'INVALID_PIN' });
    expect(payablesRepository.markPaymentReversed).not.toHaveBeenCalled();
    found(invoiced([payment({ status: 'REVERSED' })]));
    await expect(payablesService.reversePayment(accountant, 'p1', reverse, NOW)).rejects.toMatchObject({ code: 'PAYMENT_ALREADY_REVERSED' });
  });

  it('will not reverse an advance through this route', async () => {
    found(invoiced([payment({ kind: 'ADVANCE', invoiceId: null })]));
    await expect(payablesService.reversePayment(accountant, 'p1', reverse, NOW)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('getAdvice', () => {
  it('prints the advice with advance applied, words and the supplier account detail for a caller who may see it', async () => {
    found(invoiced([payment({ id: 'a1', reference: 'PAY-0000', kind: 'ADVANCE', invoiceId: null, amount: D(2500) }), payment({ amount: D(4000) })]));
    const advice = await payablesService.getAdvice(accountant, 'p1', NOW);
    expect(advice).toMatchObject({ reference: 'PAY-0001', invoiceNumber: 'INV-1', advanceApplied: '2500.00', paidBefore: '2500.00', amountPaid: '4000.00', balanceAfter: '3500.00', methodDetail: 'KCB · ····7890', amountInWords: 'Four thousand shillings only' });
    expect(advice.supplier.kraPin).toBe('P0001');
  });

  it('hides the account detail from the Branch Manager', async () => {
    found(invoiced([payment()]));
    const advice = await payablesService.getAdvice({ id: 'bm', role: 'MANAGER', siteId: 'branch-1' } as never, 'p1', NOW);
    expect(advice.methodDetail).toBeNull();
  });
});

describe('route matrix', () => {
  const allowed = (method: string, path: string, role: string): boolean => {
    const layer = (payablesRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...a: unknown[]) => void }> } }> }).stack.find((l) => l.route?.path === path && l.route.methods[method]);
    let ok = false;
    try {
      layer?.route?.stack[0]?.handle({ user: { id: 'u', role, siteId: HUB } }, {}, () => { ok = true; });
    } catch {
      ok = false;
    }
    return ok;
  };

  it.each([
    ['post', '/orders/:id/deposits', 'ACCOUNTANT', true],
    ['post', '/orders/:id/deposits', 'STORE_ATTENDANT', false],
    ['post', '/orders/:id/invoice', 'STORE_MANAGER', true],
    ['post', '/orders/:id/invoice', 'MANAGER', false],
    ['post', '/invoices/:id/payments', 'ACCOUNTANT', true],
    ['post', '/invoices/:id/payments', 'DIRECTOR', false],
    ['post', '/payments/:id/reverse', 'ACCOUNTANT', true],
    ['get', '/payments/:id/advice', 'STORE_ATTENDANT', false],
    ['get', '/payments/:id/advice', 'MANAGER', true],
  ])('%s %s as %s -> %s', (method, path, role, expected) => {
    expect(allowed(method, path, role)).toBe(expected);
  });
});
