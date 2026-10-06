import { describe, expect, it } from 'vitest';
import { actorCan, type Capability } from '../../_shared/central-store-access';
import { canMove, canOf, dayDiff, dueInDaysOf, dueLabelOf, OPEN_STATUSES, ORDER_STATUSES, stageOf, trackerOf, type OrderFacts, type Caller } from './order-state';
import { invalidPinError, purchasingError, wrongStateError } from './purchasing-errors';

const caller = (role: string, id = 'u1'): Caller => ({ id, can: (c: Capability) => actorCan({ role } as never, c) });
const facts = (over: Partial<OrderFacts> = {}): OrderFacts => ({ status: 'DRAFT', raisedById: 'u1', hasInvoice: false, invoiceDisputed: false, invoicePaid: false, ...over });

describe('stageOf', () => {
  it('maps every status to its tab', () => {
    expect(ORDER_STATUSES.map(stageOf)).toEqual(['APPROVAL', 'APPROVAL', 'APPROVAL', 'RECEIVE', 'RECEIVE', 'INVOICE', 'PAY', 'CLOSED', 'CLOSED']);
  });
  it('holds the supplier slot only until goods arrive', () => {
    expect(OPEN_STATUSES).toEqual(['DRAFT', 'AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT']);
  });
});

describe('canMove', () => {
  it('lets a draft be approved straight away and a delivered order be invoiced', () => {
    expect(canMove('DRAFT', 'approve')).toBe(true);
    expect(canMove('DELIVERED', 'invoice')).toBe(true);
  });
  it('refuses to cancel once goods have arrived', () => {
    for (const s of ['DELIVERED', 'INVOICED', 'CLOSED', 'CANCELLED', 'DRAFT'] as const) expect(canMove(s, 'cancel')).toBe(false);
    for (const s of ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'] as const) expect(canMove(s, 'cancel')).toBe(true);
  });
  it('allows an advance from approval until the invoice is paid', () => {
    expect(canMove('APPROVED', 'deposit')).toBe(true);
    expect(canMove('INVOICED', 'deposit')).toBe(true);
    expect(canMove('CLOSED', 'deposit')).toBe(false);
    expect(canMove('AWAITING_APPROVAL', 'deposit')).toBe(false);
  });
});

describe('canOf by role', () => {
  it('lets the Attendant edit and submit their own draft but never approve', () => {
    const can = canOf(facts(), caller('STORE_ATTENDANT'));
    expect(can).toMatchObject({ edit: true, submit: true, approve: false, cancel: false, recordDeposit: false });
  });
  it('stops the Attendant editing someone else’s draft', () => {
    expect(canOf(facts({ raisedById: 'other' }), caller('STORE_ATTENDANT')).edit).toBe(false);
  });
  it('lets an approver edit and approve a draft someone else raised', () => {
    expect(canOf(facts({ raisedById: 'other' }), caller('STORE_MANAGER'))).toMatchObject({ edit: true, approve: true });
  });
  it('lets the Attendant receive an approved or sent order', () => {
    expect(canOf(facts({ status: 'SENT' }), caller('STORE_ATTENDANT')).receive).toBe(true);
    expect(canOf(facts({ status: 'DELIVERED' }), caller('STORE_ATTENDANT')).receive).toBe(false);
  });
  it('lets the Accountant record an advance but not raise or approve', () => {
    expect(canOf(facts({ status: 'APPROVED' }), caller('ACCOUNTANT'))).toMatchObject({ recordDeposit: true, submit: false, approve: false, send: false });
  });
  it('lets Director and Branch Manager read but do nothing', () => {
    for (const role of ['DIRECTOR', 'MANAGER']) {
      const can = canOf(facts({ status: 'INVOICED', hasInvoice: true }), caller(role));
      expect(Object.values(can).every((v) => v === false)).toBe(true);
    }
  });
  it('blocks payment on a disputed invoice and offers settle instead', () => {
    const can = canOf(facts({ status: 'INVOICED', hasInvoice: true, invoiceDisputed: true }), caller('ACCOUNTANT'));
    expect(can).toMatchObject({ recordPayment: false, settleDispute: true });
  });
  it('allows void only while nothing is paid, and reverse only once something is', () => {
    const open = canOf(facts({ status: 'INVOICED', hasInvoice: true }), caller('ACCOUNTANT'));
    expect(open).toMatchObject({ voidInvoice: true, reversePayment: false });
    const paid = canOf(facts({ status: 'INVOICED', hasInvoice: true, invoicePaid: true }), caller('ACCOUNTANT'));
    expect(paid).toMatchObject({ voidInvoice: false, reversePayment: true });
  });
  it('lets a payment be reversed on a closed file', () => {
    expect(canOf(facts({ status: 'CLOSED', hasInvoice: true, invoicePaid: true }), caller('ACCOUNTANT')).reversePayment).toBe(true);
  });
});

describe('trackerOf', () => {
  const base = { status: 'SENT' as const, raisedAt: 'a', submittedAt: 'b', approvedAt: 'c', sentAt: 'd', sentVia: 'WHATSAPP' as const, deliveredAt: null, deliveredShort: false, invoicedAt: null, invoiceNote: null, paidAt: null };
  it('marks the first undone step current', () => {
    const t = trackerOf(base);
    expect(t.map((x) => x.state)).toEqual(['DONE', 'DONE', 'DONE', 'CURRENT', 'TODO', 'TODO']);
    expect(t[2]).toMatchObject({ at: 'd', note: 'WhatsApp' }); // toMatchObject on an index is safe under strict mode
  });
  it('notes a short delivery and a disputed invoice', () => {
    const t = trackerOf({ ...base, status: 'INVOICED', deliveredAt: 'e', deliveredShort: true, invoicedAt: 'f', invoiceNote: 'disputed' });
    expect(t[3]?.note).toBe('short');
    expect(t[4]?.note).toBe('disputed');
    expect(t[5]?.state).toBe('CURRENT');
  });
  it('has no current step on a cancelled order', () => {
    expect(trackerOf({ ...base, status: 'CANCELLED' }).some((x) => x.state === 'CURRENT')).toBe(false);
  });
  it('marks every step done once closed', () => {
    const t = trackerOf({ ...base, status: 'CLOSED', deliveredAt: 'e', invoicedAt: 'f', paidAt: 'g' });
    expect(t.every((x) => x.state === 'DONE')).toBe(true);
    expect(t[5]?.at).toBe('g');
  });
});

describe('due labels', () => {
  it('counts days between dates', () => {
    expect(dayDiff('2026-10-08', '2026-10-06')).toBe(2);
    expect(dayDiff('2026-10-05', '2026-10-06')).toBe(-1);
  });
  it('labels overdue, due today and upcoming', () => {
    expect(dueLabelOf(-1)).toBe('OVERDUE');
    expect(dueLabelOf(0)).toBe('DUE_TODAY');
    expect(dueLabelOf(3)).toBe('UPCOMING');
    expect(dueLabelOf(null)).toBeNull();
  });
  it('uses the expected date before delivery and the invoice due date once invoiced', () => {
    expect(dueInDaysOf({ status: 'SENT', expectedDate: '2026-10-05', invoiceDueDate: null }, '2026-10-06')).toBe(-1);
    expect(dueInDaysOf({ status: 'INVOICED', expectedDate: null, invoiceDueDate: '2026-10-20' }, '2026-10-06')).toBe(14);
    expect(dueInDaysOf({ status: 'DELIVERED', expectedDate: '2026-10-05', invoiceDueDate: null }, '2026-10-06')).toBeNull();
  });
});

describe('purchasing errors', () => {
  it('carries the contract status for each code', () => {
    expect(purchasingError('INVALID_PIN', 'x').statusCode).toBe(401);
    expect(purchasingError('ORDER_NOT_FOUND', 'x').statusCode).toBe(404);
    expect(purchasingError('SUPPLIER_ORDER_OPEN', 'x').statusCode).toBe(409);
    expect(purchasingError('RECEIVED_EXCEEDS_ORDERED', 'x').statusCode).toBe(422);
    expect(purchasingError('UPLOAD_FAILED', 'x').statusCode).toBe(503);
  });
  it('words the wrong-state and wrong-PIN messages as the contract says', () => {
    expect(wrongStateError('AWAITING_APPROVAL').message).toBe('This order is awaiting approval, so you cannot do that.');
    expect(invalidPinError().message).toBe('That PIN is not right.');
    expect(invalidPinError().code).toBe('INVALID_PIN');
  });
});
