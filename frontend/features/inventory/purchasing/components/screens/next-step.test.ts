import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { OrderCan, OrderStatus, PurchaseFile } from '../../types';
import { NextStep } from './purchase-file-screen';

/**
 * Component test: the "Next step" card on the purchase file. Every button comes from the order's own `can`, which the server fills in
 * from the access table for the signed-in person; the card never looks at a role. So the test gives an order in each state a `can`
 * with one flag raised and checks that exactly that button shows, and that someone with no flags still reads the words of the step.
 */
const NONE: OrderCan = {
  edit: false,
  submit: false,
  approve: false,
  return: false,
  send: false,
  cancel: false,
  receive: false,
  recordDeposit: false,
  addInvoice: false,
  recordPayment: false,
  settleDispute: false,
  voidInvoice: false,
  reversePayment: false,
  addDocument: false,
};

function orderIn(status: OrderStatus, can: Partial<OrderCan>, patch: Partial<PurchaseFile> = {}): PurchaseFile {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    reference: 'LPO-0044',
    status,
    stage: 'NEEDS',
    supplier: { id: 's1', name: 'Samrat Wholesalers', code: 'SUP-0001', contactName: null, whatsapp: null, termsDays: 30, payMethods: [] },
    raisedBy: { id: 'u1', name: 'Store Attendant', role: 'Store Attendant' },
    raisedAt: '2026-10-05T08:00:00.000Z',
    submittedAt: '2026-10-05T08:05:00.000Z',
    approvedBy: null,
    returnedNote: null,
    returnedBy: null,
    sentAt: null,
    sentVia: null,
    expectedDate: null,
    supplierNote: null,
    attendantNote: null,
    lines: [],
    orderedTotal: '1000.00',
    deliveredTotal: null,
    delivery: null,
    invoice: null,
    payments: [],
    money: null,
    dueLabel: null,
    dueInDays: null,
    cancelled: null,
    tracker: [],
    can: { ...NONE, ...can },
    documents: [],
    activity: [],
    ...patch,
  };
}

const invoice = (disputed: boolean): NonNullable<PurchaseFile['invoice']> => ({
  id: 'i1',
  number: 'INV-05188',
  date: '2026-10-04',
  dueDate: '2026-11-03',
  amount: '1000.00',
  status: 'OPEN',
  disputed,
  varianceAmount: disputed ? '200.00' : null,
  varianceReason: null,
  settled: null,
  voided: null,
  advanceApplied: '0.00',
  balance: '1000.00',
  photo: null,
  enteredBy: { id: 'u2', name: 'Margaret', role: 'Accountant' },
  enteredAt: '2026-10-04T09:00:00.000Z',
});

/** The button and link labels the card shows for this order. */
function labels(order: PurchaseFile, canReceive = false): string[] {
  const noop = (): void => undefined;
  const html = renderToStaticMarkup(
    createElement(NextStep, { order, canReceive, onApprove: noop, onWhatsapp: noop, onPrint: noop, onCopy: noop, onAdvance: noop, onInvoice: noop, onPay: noop, onSettle: noop, onVoid: noop, busy: false })
  );
  return Array.from(html.matchAll(/<(?:button|a)[^>]*>([\s\S]*?)<\/(?:button|a)>/g)).map((m) => (m[1] as string).replace(/<[^>]+>/g, '').trim());
}

describe('the purchase file: each button shows only when the order says this person may do it', () => {
  it('Review and approve follows can.approve', () => {
    expect(labels(orderIn('AWAITING_APPROVAL', { approve: true }))).toEqual(['Review and approve']);
    expect(labels(orderIn('AWAITING_APPROVAL', {}))).toEqual([]);
  });

  it('Send on WhatsApp, Print and Copy link follow can.send', () => {
    expect(labels(orderIn('APPROVED', { send: true }))).toEqual(['Send on WhatsApp', 'Print', 'Copy link']);
    expect(labels(orderIn('APPROVED', {}))).toEqual([]);
  });

  it('Receive delivery follows can.receive, and Record advance follows can.recordDeposit', () => {
    expect(labels(orderIn('SENT', { receive: true }))).toEqual(['Receive delivery']);
    expect(labels(orderIn('SENT', { recordDeposit: true }))).toEqual(['Record advance']);
    expect(labels(orderIn('SENT', { receive: true, recordDeposit: true }))).toEqual(['Receive delivery', 'Record advance']);
    expect(labels(orderIn('SENT', {}))).toEqual([]);
  });

  it('Add invoice follows can.addInvoice', () => {
    expect(labels(orderIn('DELIVERED', { addInvoice: true }))).toEqual(['Add invoice']);
    expect(labels(orderIn('DELIVERED', {}))).toEqual([]);
  });

  it('Record payment and Void invoice follow can.recordPayment and can.voidInvoice', () => {
    expect(labels(orderIn('INVOICED', { recordPayment: true, voidInvoice: true }, { invoice: invoice(false), dueInDays: 20 }))).toEqual(['Record payment', 'Void invoice']);
    expect(labels(orderIn('INVOICED', {}, { invoice: invoice(false), dueInDays: 20 }))).toEqual([]);
  });

  it('Settle dispute replaces Record payment on a disputed invoice', () => {
    expect(labels(orderIn('INVOICED', { settleDispute: true, voidInvoice: true }, { invoice: invoice(true) }))).toEqual(['Settle dispute', 'Void invoice']);
    expect(labels(orderIn('INVOICED', { recordPayment: true }, { invoice: invoice(true) }))).toEqual([]);
  });

  it('a closed or cancelled file has no next step', () => {
    expect(labels(orderIn('CLOSED', {}))).toEqual([]);
    expect(labels(orderIn('CANCELLED', {}))).toEqual([]);
  });

  it('a reader with no flags still sees the words of the next step', () => {
    const html = renderToStaticMarkup(
      createElement(NextStep, { order: orderIn('INVOICED', {}, { invoice: invoice(false), dueInDays: 20 }), canReceive: false, onApprove: () => undefined, onWhatsapp: () => undefined, onPrint: () => undefined, onCopy: () => undefined, onAdvance: () => undefined, onInvoice: () => undefined, onPay: () => undefined, onSettle: () => undefined, onVoid: () => undefined, busy: false })
    );
    expect(html).toContain('Waiting to be paid');
    expect(html).toContain('The Accountant records the payment');
  });
});
