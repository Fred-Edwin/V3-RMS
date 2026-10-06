import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ForbiddenError } from '../../../../utils/errors';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { amountInWords } from '../_shared/amount-in-words';
import { advancesTotal, dueDateOf, invoiceFigures, invoicePaymentsTotal, orderedTotal, toMoney, varianceOf, type PaymentFacts } from '../_shared/money';
import { canMove } from '../_shared/order-state';
import type { OrderRecord } from '../_shared/order-record';
import { extraDocumentView, invoiceView, liveInvoiceOf, METHOD_WORD, payMethodView, paymentView, roleLabel, viewOrder } from '../_shared/order-view';
import { purchasingPin } from '../_shared/pin';
import { kes, purchasingAudit } from '../_shared/purchasing-audit';
import { purchasingError, wrongStateError } from '../_shared/purchasing-errors';
import type { FileDocumentView, InvoiceView, OrderView, PayMethod } from '../_shared/purchasing.types';
import { purchaseFileService } from '../files/files-service';
import { ordersRepository } from '../orders/orders-repository';
import { payablesRepository } from './payables-repository';
import type { DepositInput, DocumentInput, InvoiceInput, PaymentInput, ReverseInput, SettleInput, VoidInput } from './payables-validators';
import type { PaymentAdvice, PaymentResult } from './payables.types';

type Actor = NonNullable<Request['user']>;
type Tx = Prisma.TransactionClient;

const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const dateOf = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const day = (d: Date): string => d.toISOString().slice(0, 10);

const REVERSE_WORD = { WRONG_AMOUNT: 'Wrong amount', WRONG_REFERENCE: 'Wrong reference number', WRONG_INVOICE: 'Wrong invoice', PAYMENT_BOUNCED: 'Payment bounced', OTHER: 'Other' } as const;
const VOID_WORD = { WRONG_AMOUNT: 'Wrong amount entered', WRONG_SUPPLIER_OR_ORDER: 'Wrong supplier or order', DUPLICATE: 'Duplicate', OTHER: 'Other' } as const;

const loadOrder = async (siteId: string, id: string): Promise<OrderRecord> => {
  const order = await ordersRepository.findOrder(siteId, id);
  if (!order) throw purchasingError('ORDER_NOT_FOUND', 'That order does not exist.');
  return order;
};

const loadByInvoice = async (siteId: string, invoiceId: string): Promise<{ order: OrderRecord; invoice: NonNullable<ReturnType<typeof liveInvoiceOf>> }> => {
  const order = await payablesRepository.findOrderByInvoice(siteId, invoiceId);
  const invoice = order?.invoices.find((i) => i.id === invoiceId && i.status !== 'VOIDED');
  if (!order || !invoice) throw purchasingError('INVOICE_NOT_FOUND', 'That invoice does not exist, or it was voided.');
  return { order, invoice };
};

const loadByPayment = async (siteId: string, paymentId: string): Promise<{ order: OrderRecord; payment: OrderRecord['payments'][number] }> => {
  const order = await payablesRepository.findOrderByPayment(siteId, paymentId);
  const payment = order?.payments.find((p) => p.id === paymentId);
  if (!order || !payment) throw purchasingError('PAYMENT_NOT_FOUND', 'That payment does not exist.');
  return { order, payment };
};

const factsOf = (o: Pick<OrderRecord, 'payments'>): PaymentFacts[] => o.payments.map((p) => ({ kind: p.kind, status: p.status, amount: p.amount }));
const orderTotal = (o: OrderRecord): Prisma.Decimal => orderedTotal(o.lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice })));

const needAmount = (value: string): Prisma.Decimal => {
  const amount = D(value);
  if (!amount.gt(0)) throw purchasingError('VALIDATION', 'Enter an amount more than zero.');
  return amount;
};

const needCheque = (method: string, chequeNo: string | null): string | null => {
  if (method !== 'CHEQUE') return null;
  const number = chequeNo?.trim();
  if (!number) throw purchasingError('CHEQUE_NUMBER_REQUIRED', 'Enter the cheque number.');
  return number;
};

/**
 * Bring the invoice and the order in line with what has been paid, after anything that changes an advance, a payment, a dispute
 * or the invoice. An advance is applied up to the invoice amount; fully paid and not disputed moves the order to CLOSED.
 */
const refresh = async (tx: Tx, siteId: string, orderId: string): Promise<void> => {
  const order = await ordersRepository.findOrderInTx(tx, siteId, orderId);
  const live = order ? liveInvoiceOf(order) : null;
  if (!order || !live) return;
  const paidInFull = invoiceFigures(live.amount, factsOf(order), live.disputed).paidInFull;
  await payablesRepository.setInvoiceStatus(tx, siteId, live.id, paidInFull ? 'PAID' : 'OPEN');
  await ordersRepository.transition(tx, siteId, order.id, { from: ['INVOICED', 'CLOSED'], status: paidInFull ? 'CLOSED' : 'INVOICED' });
};

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export const payablesService = {
  /** An advance against an approved order, before or after the invoice. More than the order total is refused. */
  recordDeposit: async (actor: Actor, orderId: string, input: DepositInput, now: Date = new Date()): Promise<PaymentResult> => {
    const siteId = await requireHubActor(actor);
    const order = await loadOrder(siteId, orderId);
    if (!canMove(order.status, 'deposit')) throw wrongStateError(order.status);
    const amount = needAmount(input.amount);
    const chequeNo = needCheque(input.method, input.chequeNo);
    if (advancesTotal(factsOf(order)).plus(amount).gt(orderTotal(order).plus('0.001'))) {
      throw purchasingError('DEPOSIT_EXCEEDS_ORDER', 'An advance cannot be more than the order total.');
    }
    const paymentId = await prisma.$transaction(async (tx) => {
      const reference = await referenceCounterRepository.nextReference(tx, siteId, 'PAY');
      const id = await payablesRepository.createPayment(tx, {
        siteId, orderId: order.id, invoiceId: null, supplierId: order.supplierId, reference, kind: 'ADVANCE', amount, paidOn: dateOf(input.paidOn),
        method: input.method, methodRef: input.methodRef, chequeNo, note: input.note, proofFileId: null, recordedById: actor.id,
      });
      await refresh(tx, siteId, order.id);
      await purchasingAudit.record(
        tx,
        {
          siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Recorded advance payment', document: reference,
          detail: `KES ${kes(amount)} · ${METHOD_WORD[input.method]}${input.methodRef ? ` ${input.methodRef}` : ''} · for ${order.reference}`,
          what: `recorded an advance of KES ${kes(amount)} (${reference})`,
        },
        now,
      );
      return id;
    });
    return resultOf(actor, siteId, order.id, paymentId, now);
  },

  /** The supplier's invoice (one per order). An amount that differs from the delivered value needs a reason and is saved as disputed. */
  addInvoice: async (actor: Actor, orderId: string, input: InvoiceInput, now: Date = new Date()): Promise<InvoiceView> => {
    const siteId = await requireHubActor(actor);
    const order = await loadOrder(siteId, orderId);
    if (liveInvoiceOf(order)) throw purchasingError('INVOICE_EXISTS', 'This order already has an invoice.');
    if (!canMove(order.status, 'invoice') || !order.delivery) throw wrongStateError(order.status);
    const number = input.number.trim();
    const amount = needAmount(input.amount);
    const dup = await payablesRepository.findDuplicateInvoice(siteId, order.supplierId, number, order.id);
    if (dup && !input.differentInvoice) {
      throw purchasingError('DUPLICATE_INVOICE_NUMBER', `${order.supplier.name} already has an invoice ${number} on ${dup.reference}.`, { existingOrderId: dup.orderId, existingReference: dup.reference });
    }
    const variance = varianceOf(amount, order.delivery.deliveredTotal);
    const reason = input.varianceReason?.trim() || null;
    if (variance.differs && !reason) throw purchasingError('REASON_REQUIRED', 'Say why the invoice differs from what was delivered.');
    const file = await purchaseFileService.resolve(siteId, input.photoId);
    try {
      await prisma.$transaction(async (tx) => {
        await payablesRepository.createInvoice(tx, {
          siteId, orderId: order.id, supplierId: order.supplierId, number, invoiceDate: dateOf(input.date), dueDate: dateOf(dueDateOf(input.date, order.termsDays)),
          amount, disputed: variance.differs, varianceAmount: variance.differs ? variance.amount : null, varianceReason: variance.differs ? reason : null, fileId: file?.id ?? null, enteredById: actor.id,
        });
        if (!(await ordersRepository.transition(tx, siteId, order.id, { from: ['DELIVERED'], status: 'INVOICED' }))) throw wrongStateError('changed by someone else');
        await refresh(tx, siteId, order.id);
        const gap = kes(variance.amount.abs());
        await purchasingAudit.record(
          tx,
          {
            siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Added invoice', document: number,
            detail: `KES ${kes(amount)}${variance.differs ? ` · KES ${gap} ${variance.amount.gt(0) ? 'above' : 'below'} delivery: ${reason}` : ' · matches delivery'} · for ${order.reference}`,
            what: variance.differs ? `added invoice ${number}, disputed for KES ${gap}` : `added invoice ${number} for KES ${kes(amount)}`,
          },
          now,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw purchasingError('INVOICE_EXISTS', 'This order already has an invoice.');
      throw error;
    }
    const fresh = await loadOrder(siteId, order.id);
    return invoiceView(fresh, liveInvoiceOf(fresh) as NonNullable<ReturnType<typeof liveInvoiceOf>>);
  },

  /** Agree the figure with the supplier, then record it: the invoice takes the agreed amount and the dispute clears. */
  settleDispute: async (actor: Actor, invoiceId: string, input: SettleInput, now: Date = new Date()): Promise<InvoiceView> => {
    const siteId = await requireHubActor(actor);
    const { order, invoice } = await loadByInvoice(siteId, invoiceId);
    if (!invoice.disputed) throw purchasingError('INVOICE_NOT_DISPUTED', 'This invoice is not in dispute.');
    if (order.status !== 'INVOICED') throw wrongStateError(order.status);
    const agreed = needAmount(input.agreedAmount);
    await prisma.$transaction(async (tx) => {
      const settled = await payablesRepository.settleInvoice(tx, siteId, invoice.id, { amount: agreed, settledAmount: agreed, settledNote: input.note, settledById: actor.id, settledAt: now });
      if (!settled) throw purchasingError('INVOICE_NOT_DISPUTED', 'This invoice is not in dispute.');
      await refresh(tx, siteId, order.id);
      await purchasingAudit.record(
        tx,
        {
          siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Settled invoice dispute', document: invoice.number,
          detail: `Agreed KES ${kes(agreed)} · ${input.note}`, what: `settled the dispute on invoice ${invoice.number} at KES ${kes(agreed)}: ${input.note}`,
        },
        now,
      );
    });
    const fresh = await loadOrder(siteId, order.id);
    return invoiceView(fresh, fresh.invoices.find((i) => i.id === invoice.id) as OrderRecord['invoices'][number]);
  },

  /** Void a wrong invoice (reason and own PIN), only while nothing is paid against it. The order goes back to Delivered. */
  voidInvoice: async (actor: Actor, invoiceId: string, input: VoidInput, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const { order, invoice } = await loadByInvoice(siteId, invoiceId);
    if (order.status !== 'INVOICED') throw wrongStateError(order.status);
    if (invoicePaymentsTotal(factsOf(order)).gt(0)) throw purchasingError('INVOICE_HAS_PAYMENTS', 'A payment has been recorded against this invoice. Reverse the payment first.');
    await purchasingPin.verifyOwn(actor, input.pin);
    await prisma.$transaction(async (tx) => {
      if (!(await payablesRepository.voidInvoice(tx, siteId, invoice.id, { voidReason: input.reason, voidedById: actor.id, voidedAt: now }))) throw wrongStateError('changed by someone else');
      if (!(await ordersRepository.transition(tx, siteId, order.id, { from: ['INVOICED'], status: 'DELIVERED' }))) throw wrongStateError('changed by someone else');
      await purchasingAudit.record(
        tx,
        {
          siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Voided invoice', document: invoice.number,
          detail: `KES ${kes(invoice.amount)} · ${VOID_WORD[input.reason]} · ${order.reference} back to awaiting invoice`, what: `voided invoice ${invoice.number}`,
        },
        now,
      );
    });
    return viewOrder(actor, await loadOrder(siteId, order.id), now);
  },

  /** Record a payment against the live invoice. More than the balance needs `confirmOverpay`; the extra stays as credit. */
  recordPayment: async (actor: Actor, invoiceId: string, input: PaymentInput, now: Date = new Date()): Promise<PaymentResult> => {
    const siteId = await requireHubActor(actor);
    const { order, invoice } = await loadByInvoice(siteId, invoiceId);
    if (order.status !== 'INVOICED') throw wrongStateError(order.status);
    if (invoice.disputed) throw purchasingError('INVOICE_DISPUTED', 'This invoice is in dispute. Settle it with the supplier before paying.');
    const amount = needAmount(input.amount);
    const chequeNo = needCheque(input.method, input.chequeNo);
    const balance = invoiceFigures(invoice.amount, factsOf(order), invoice.disputed).balance;
    if (amount.gt(balance.plus('0.005')) && !input.confirmOverpay) {
      throw purchasingError('PAYMENT_EXCEEDS_BALANCE', `That is more than the KES ${toMoney(balance)} owed.`, { balance: toMoney(balance) });
    }
    const proof = await purchaseFileService.resolve(siteId, input.proofPhotoId);
    const paymentId = await prisma.$transaction(async (tx) => {
      const reference = await referenceCounterRepository.nextReference(tx, siteId, 'PAY');
      const id = await payablesRepository.createPayment(tx, {
        siteId, orderId: order.id, invoiceId: invoice.id, supplierId: order.supplierId, reference, kind: 'INVOICE', amount, paidOn: dateOf(input.paidOn),
        method: input.method, methodRef: input.methodRef, chequeNo, note: null, proofFileId: proof?.id ?? null, recordedById: actor.id,
      });
      await refresh(tx, siteId, order.id);
      const after = await ordersRepository.findOrderInTx(tx, siteId, order.id);
      const left = after ? invoiceFigures(invoice.amount, factsOf(after), false).balance : D(0);
      await purchasingAudit.record(
        tx,
        {
          siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Recorded payment', document: reference,
          detail: `KES ${kes(amount)} · ${METHOD_WORD[input.method]}${chequeNo ? ` ${chequeNo}` : input.methodRef ? ` ${input.methodRef}` : ''} · applied to ${invoice.number} · ${left.lt('0.005') ? 'balance nil' : `balance KES ${kes(left)}`}`,
          what: `paid KES ${kes(amount)} on invoice ${invoice.number} (${reference})${left.lt('0.005') ? ', paid in full' : ''}`,
        },
        now,
      );
      return id;
    });
    return resultOf(actor, siteId, order.id, paymentId, now);
  },

  /**
   * The Accountant records the request and a Store Manager or System Admin approves it with their PIN in the same drawer. The
   * payment stays on the statement marked Reversed and a linked negative line (`<reference>-R`) is added.
   */
  reversePayment: async (actor: Actor, paymentId: string, input: ReverseInput, now: Date = new Date()): Promise<PaymentResult> => {
    const siteId = await requireHubActor(actor);
    const { order, payment } = await loadByPayment(siteId, paymentId);
    if (payment.kind !== 'INVOICE') throw purchasingError('VALIDATION', 'Only a payment against an invoice can be reversed.');
    if (payment.status === 'REVERSED') throw purchasingError('PAYMENT_ALREADY_REVERSED', 'That payment has already been reversed.');
    const approver = await purchasingPin.verifyReversalApprover(actor, siteId, input.approverPin);
    const reversalId = await prisma.$transaction(async (tx) => {
      if (!(await payablesRepository.markPaymentReversed(tx, siteId, payment.id))) throw purchasingError('PAYMENT_ALREADY_REVERSED', 'That payment has already been reversed.');
      const id = await payablesRepository.createPayment(tx, {
        siteId, orderId: order.id, invoiceId: payment.invoiceId, supplierId: order.supplierId, reference: `${payment.reference}-R`, kind: 'REVERSAL', amount: payment.amount.neg(),
        paidOn: dateOf(day(now)), method: payment.method, methodRef: payment.methodRef, chequeNo: payment.chequeNo, note: input.note, proofFileId: null,
        reversesId: payment.id, reverseReason: input.reason, approvedById: approver.id, recordedById: actor.id,
      });
      await refresh(tx, siteId, order.id);
      await purchasingAudit.record(
        tx,
        {
          siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, area: 'PAYMENTS', action: 'Reversed payment', document: payment.reference,
          detail: `KES ${kes(payment.amount)} · ${REVERSE_WORD[input.reason]} · approved by ${approver.name}`,
          what: `reversed payment ${payment.reference} (KES ${kes(payment.amount)}), approved by ${approver.name}`,
        },
        now,
      );
      return id;
    });
    return resultOf(actor, siteId, order.id, reversalId, now);
  },

  /** "+ Add a document": any extra photo or PDF with a name, on a purchase file that is past draft. */
  addDocument: async (actor: Actor, orderId: string, input: DocumentInput, now: Date = new Date()): Promise<FileDocumentView> => {
    const siteId = await requireHubActor(actor);
    const order = await loadOrder(siteId, orderId);
    if (!viewOrder(actor, order, now).can.addDocument) throw new ForbiddenError('You do not have permission to perform this action');
    const file = await purchaseFileService.resolve(siteId, input.fileId);
    if (!file) throw purchasingError('VALIDATION', 'Add the photo or PDF first.');
    await prisma.$transaction(async (tx) => {
      await payablesRepository.createDocument(tx, { siteId, orderId: order.id, title: input.title, fileId: file.id, addedById: actor.id });
      await purchasingAudit.record(
        tx,
        { siteId, orderId: order.id, supplierId: order.supplierId, actorId: actor.id, action: 'Added document', document: order.reference, detail: `${input.title} · ${file.fileName}`, what: `added the document "${input.title}"` },
        now,
      );
    });
    const fresh = await loadOrder(siteId, order.id);
    return extraDocumentView(fresh, fresh.documents[fresh.documents.length - 1] as OrderRecord['documents'][number]);
  },

  /** The printed payment advice. The supplier's account detail shows only to a caller who may read payment details. */
  getAdvice: async (actor: Actor, paymentId: string, now: Date = new Date()): Promise<PaymentAdvice> => {
    const siteId = await requireHubReader(actor);
    const { order, payment } = await loadByPayment(siteId, paymentId);
    const invoice = order.invoices.find((i) => i.id === payment.invoiceId);
    if (payment.kind !== 'INVOICE' || !invoice) throw purchasingError('PAYMENT_NOT_FOUND', 'There is no payment advice for that payment.');
    const facts = factsOf(order);
    const figures = invoiceFigures(invoice.amount, facts, invoice.disputed);
    // Payments are kept in the order they were made, so "before" is whatever sits earlier in the list.
    const earlierInvoice = order.payments.slice(0, order.payments.indexOf(payment)).filter((p) => p.kind === 'INVOICE' && p.status === 'RECORDED');
    const before = earlierInvoice.reduce((t, p) => t.plus(p.amount), D(0));
    const balanceAfter = Prisma.Decimal.max(D(invoice.amount).minus(figures.advanceApplied).minus(before).minus(payment.amount), 0);
    const advances = order.payments.filter((p) => p.kind === 'ADVANCE' && p.status === 'RECORDED');
    const contact = order.supplier.contacts[0];
    const method = order.supplier.payMethods.find((m) => m.type === payment.method);
    return {
      reference: payment.reference,
      date: day(payment.paidOn),
      supplier: { name: order.supplier.name, address: order.supplier.address, contact: contact?.name ?? null, kraPin: order.supplier.kraPin },
      orderReference: order.reference ?? '',
      invoiceNumber: invoice.number,
      invoiceDate: day(invoice.invoiceDate),
      invoiceAmount: toMoney(invoice.amount),
      advanceApplied: toMoney(figures.advanceApplied),
      paidBefore: toMoney(before.plus(figures.advanceApplied)),
      amountPaid: toMoney(payment.amount),
      amountInWords: amountInWords(payment.amount),
      balanceAfter: toMoney(balanceAfter),
      method: payment.method as PayMethod,
      methodDetail: actorCan(actor, 'suppliers.read_payment_details') && method ? payMethodView(method).detail || null : null,
      methodRef: payment.methodRef,
      chequeNo: payment.chequeNo,
      earlier: [...advances, ...earlierInvoice].map((p) => ({ reference: p.reference, kind: p.kind as 'ADVANCE' | 'INVOICE', amount: toMoney(p.amount), paidOn: day(p.paidOn), method: p.method as PayMethod, methodRef: p.methodRef })),
      preparedBy: { name: payment.recordedBy.name, role: roleLabel(payment.recordedBy.role), signedAt: payment.recordedAt.toISOString() },
      generatedAt: now.toISOString(),
    };
  },
};

const resultOf = async (actor: Actor, siteId: string, orderId: string, paymentId: string, now: Date): Promise<PaymentResult> => {
  const fresh = await loadOrder(siteId, orderId);
  const payment = fresh.payments.find((p) => p.id === paymentId) as OrderRecord['payments'][number];
  return { payment: paymentView(payment), order: viewOrder(actor, fresh, now) };
};
