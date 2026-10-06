import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { owingOf, statementCsv, statementOf } from './supplier-account-logic';

const D = (v: number | string) => new Prisma.Decimal(v);
const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00Z`);
const who = { id: 'u', name: 'Margaret', role: 'ACCOUNTANT' };

const inv = (over: Record<string, unknown>) => ({
  id: 'i1', number: 'INV-1', invoiceDate: dateOnly('2026-09-06'), dueDate: dateOnly('2026-09-20'), amount: D(10000), status: 'OPEN', disputed: false, varianceAmount: null,
  settledAt: null, voidedAt: null, enteredAt: at('2026-09-06'), ...over,
});
const pay = (over: Record<string, unknown>) => ({
  id: 'p1', reference: 'PAY-0001', kind: 'INVOICE', status: 'RECORDED', amount: D(4000), paidOn: dateOnly('2026-09-25'), recordedAt: at('2026-09-25'), reverseReason: null, note: null, recordedBy: who, ...over,
});
const order = (id: string, invoices: unknown[], payments: unknown[]) => ({ id, reference: `LPO-${id}`, invoices, payments }) as never;

const supplier = { id: 's', name: 'Samrat', code: 'SUPPLIER-0001', address: 'Nyeri', contactName: 'Ravi', termsDays: 14 };

describe('owingOf', () => {
  const orders = [
    order('1', [inv({})], [pay({ kind: 'ADVANCE', reference: 'PAY-0000', amount: D(2500) })]), // 7,500 owing, 16 days late on 6 Oct
    order('2', [inv({ id: 'i2', number: 'INV-2', amount: D(3000), dueDate: dateOnly('2026-10-20'), disputed: true, varianceAmount: D(-200) })], []), // disputed, not due
    order('3', [inv({ id: 'i3', number: 'INV-3', amount: D(500), status: 'PAID' })], [pay({ id: 'p3', amount: D(500) })]), // paid in full: not open
  ];

  it('adds up open invoices after advances and payments, with the late buckets', () => {
    const o = owingOf(orders, '2026-10-06');
    expect(o).toMatchObject({ owing: '10500.00', overdue: '7500.00', overdueCount: 1, openInvoices: 2, disputedAmount: '200.00', nextDueDate: '2026-09-20' });
    expect(o.late).toEqual({ days1To30: '7500.00', days31To60: '0.00', days61To90: '0.00', days90Plus: '0.00' });
    expect(o.invoices.map((i) => i.invoiceNumber)).toEqual(['INV-1', 'INV-2']);
    expect(o.invoices[0]?.outstanding).toBe('7500.00');
  });

  it('holds an advance that no invoice has used as credit', () => {
    expect(owingOf([order('4', [], [pay({ kind: 'ADVANCE', amount: D(1000) })])], '2026-10-06').creditHeld).toBe('1000.00');
  });
});

describe('statementOf', () => {
  const orders = [
    order(
      '1',
      [inv({ status: 'VOIDED', voidedAt: at('2026-09-07') }), inv({ id: 'i1b', number: 'INV-1B', amount: D(9000), invoiceDate: dateOnly('2026-09-08'), dueDate: dateOnly('2026-09-22'), enteredAt: at('2026-09-08') })],
      [
        pay({ kind: 'ADVANCE', reference: 'PAY-0000', amount: D(1000), paidOn: dateOnly('2026-08-30'), recordedAt: at('2026-08-30') }),
        pay({ status: 'REVERSED' }),
        pay({ id: 'r1', reference: 'PAY-0001-R', kind: 'REVERSAL', amount: D(-4000), paidOn: dateOnly('2026-09-26'), recordedAt: at('2026-09-26'), reverseReason: 'WRONG_AMOUNT' }),
      ],
    ),
  ];

  it('reads as the supplier does: invoices credit, payments debit, a void and a reversal cancel without erasing', () => {
    const s = statementOf(supplier, orders, { from: '2026-09-01', to: '2026-09-30' }, at('2026-10-06'));
    expect(s.openingBalance).toBe('-1000.00'); // the August advance is credit held
    expect(s.lines.map((l) => [l.kind, l.reference, l.superseded, l.balance])).toEqual([
      ['INVOICE', 'INV-1', true, '9000.00'],
      ['VOID', 'INV-1', false, '-1000.00'],
      ['INVOICE', 'INV-1B', false, '8000.00'],
      ['PAYMENT', 'PAY-0001', true, '4000.00'],
      ['REVERSAL', 'PAY-0001-R', false, '8000.00'],
    ]);
    expect(s).toMatchObject({ totalDebit: '14000.00', totalCredit: '23000.00', closingBalance: '8000.00' });
    expect(s.lines[4]?.description).toBe('Payment reversed (WRONG_AMOUNT)');
  });

  it('ages open invoices by days past due at the closing date', () => {
    const s = statementOf(supplier, orders, { from: '2026-09-01', to: '2026-10-30' }, at('2026-10-06'));
    expect(s.ageing).toEqual({ current: '0.00', days1to30: '0.00', days31to60: '8000.00', days61to90: '0.00', days90plus: '0.00' });
  });

  it('writes a CSV with opening and closing rows and quotes commas', () => {
    const s = statementOf({ ...supplier, name: 'Samrat, Ltd' }, orders, { from: '2026-09-01', to: '2026-09-30' }, at('2026-10-06'));
    const csv = statementCsv(s);
    expect(csv.split('\n')[0]).toBe('Statement of account,"Samrat, Ltd",SUPPLIER-0001');
    expect(csv).toContain('Opening balance');
    expect(csv).toContain('2026-09-30,,Closing balance,14000.00,23000.00,8000.00,');
    expect(csv).toContain('Superseded');
  });
});
