import { Prisma } from '@prisma/client';
import { ageingBucketOf, invoiceFigures, paidTotal, toMoney, type AgeingBucket, type PaymentFacts } from '../_shared/money';
import { dayDiff } from '../_shared/order-state';
import type { OrderRecord } from '../_shared/order-record';
import { liveInvoiceOf } from '../_shared/order-view';
import type { StatementLine, SupplierOwing, SupplierStatement } from './supplier-account.types';

/** The rules of the supplier page and the statement (backend-rules.md §6, Q-14, Q-15), as pure functions over loaded orders. */
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const ZERO = D(0);
const day = (d: Date): string => d.toISOString().slice(0, 10);
const factsOf = (o: OrderRecord): PaymentFacts[] => o.payments.map((p) => ({ kind: p.kind, status: p.status, amount: p.amount }));

interface OpenInvoice {
  order: OrderRecord;
  invoice: OrderRecord['invoices'][number];
  balance: Prisma.Decimal;
}

/** Live invoices with something left to pay, or in dispute. */
const openInvoicesOf = (orders: readonly OrderRecord[]): OpenInvoice[] =>
  orders.flatMap((order) => {
    const invoice = liveInvoiceOf(order);
    if (!invoice) return [];
    const figures = invoiceFigures(invoice.amount, factsOf(order), invoice.disputed);
    return figures.paidInFull ? [] : [{ order, invoice, balance: figures.balance }];
  });

const sum = (values: readonly Prisma.Decimal[]): Prisma.Decimal => values.reduce((t, v) => t.plus(v), ZERO);

/** Money paid on an order that no invoice has used: the whole advance when there is no invoice, else what exceeds the invoice. */
const creditOf = (o: OrderRecord): Prisma.Decimal => {
  const paid = paidTotal(factsOf(o));
  const invoice = liveInvoiceOf(o);
  return invoice ? Prisma.Decimal.max(paid.minus(invoice.amount), 0) : paid;
};

export const owingOf = (orders: readonly OrderRecord[], todayIso: string): SupplierOwing => {
  const open = openInvoicesOf(orders);
  const past = (o: OpenInvoice): number => -dayDiff(day(o.invoice.dueDate), todayIso);
  const overdue = open.filter((o) => past(o) > 0);
  const bucket = (b: AgeingBucket): string => toMoney(sum(open.filter((o) => ageingBucketOf(past(o)) === b).map((o) => o.balance)));
  const sorted = [...open].sort((a, b) => a.invoice.dueDate.getTime() - b.invoice.dueDate.getTime());
  return {
    owing: toMoney(sum(open.map((o) => o.balance))),
    overdue: toMoney(sum(overdue.map((o) => o.balance))),
    overdueCount: overdue.length,
    openInvoices: open.length,
    disputedAmount: toMoney(sum(open.filter((o) => o.invoice.disputed).map((o) => D(o.invoice.varianceAmount ?? 0).abs()))),
    creditHeld: toMoney(sum(orders.map(creditOf))),
    nextDueDate: sorted[0] ? day(sorted[0].invoice.dueDate) : null,
    late: { days1To30: bucket('days1to30'), days31To60: bucket('days31to60'), days61To90: bucket('days61to90'), days90Plus: bucket('days90plus') },
    invoices: sorted.map((o) => ({ id: o.invoice.id, orderId: o.order.id, invoiceNumber: o.invoice.number, invoiceDate: day(o.invoice.invoiceDate), dueDate: day(o.invoice.dueDate), outstanding: toMoney(o.balance) })),
  };
};

type RawLine = Omit<StatementLine, 'balance'>;

const net = (l: Pick<StatementLine, 'debit' | 'credit'>): Prisma.Decimal => D(l.credit || 0).minus(l.debit || 0);

/**
 * The supplier's statement as the supplier reads it: an invoice is a Credit, a payment, advance or voided invoice is a Debit. A
 * voided invoice and a reversed payment stay on it, struck through, with a line that cancels them: nothing is erased.
 */
export const statementOf = (
  supplier: { id: string; name: string; code: string; address: string; contactName: string | null; termsDays: number | null },
  orders: readonly OrderRecord[],
  range: { from: string; to: string },
  now: Date,
): SupplierStatement => {
  const raw: RawLine[] = [];
  for (const o of orders) {
    const ref = o.reference ?? '';
    for (const inv of o.invoices) {
      const voided = inv.status === 'VOIDED';
      const suffix = inv.disputed ? ' (disputed)' : inv.settledAt ? ' (dispute settled)' : '';
      raw.push({ at: inv.enteredAt.toISOString(), date: day(inv.invoiceDate), kind: 'INVOICE', reference: inv.number, description: `Invoice for ${ref}${suffix}`, debit: '', credit: toMoney(inv.amount), superseded: voided, orderId: o.id });
      if (voided && inv.voidedAt) raw.push({ at: inv.voidedAt.toISOString(), date: day(inv.voidedAt), kind: 'VOID', reference: inv.number, description: `Invoice ${inv.number} voided`, debit: toMoney(inv.amount), credit: '', superseded: false, orderId: o.id });
    }
    for (const p of o.payments) {
      if (p.kind === 'REVERSAL') {
        const why = p.reverseReason ? (p.note ? `${p.reverseReason}: ${p.note}` : p.reverseReason) : null;
        raw.push({ at: p.recordedAt.toISOString(), date: day(p.paidOn), kind: 'REVERSAL', reference: p.reference, description: `Payment reversed${why ? ` (${why})` : ''}`, debit: '', credit: toMoney(D(p.amount).neg()), superseded: false, orderId: o.id });
      } else {
        raw.push({ at: p.recordedAt.toISOString(), date: day(p.paidOn), kind: p.kind === 'ADVANCE' ? 'ADVANCE' : 'PAYMENT', reference: p.reference, description: `${p.kind === 'ADVANCE' ? 'Advance' : 'Payment'} for ${ref}`, debit: toMoney(p.amount), credit: '', superseded: p.status === 'REVERSED', orderId: o.id });
      }
    }
  }
  // A statement reads in document-date order; entry time breaks ties.
  raw.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at));
  const opening = sum(raw.filter((l) => l.date < range.from).map(net));
  let balance = opening;
  const inPeriod = raw.filter((l) => l.date >= range.from && l.date <= range.to);
  const lines: StatementLine[] = inPeriod.map((l) => {
    balance = balance.plus(net(l));
    return { ...l, balance: toMoney(balance) };
  });
  // Ageing: open invoices by how many days past their due date they are on the closing day.
  const ageing: Record<AgeingBucket, Prisma.Decimal> = { current: ZERO, days1to30: ZERO, days31to60: ZERO, days61to90: ZERO, days90plus: ZERO };
  for (const o of openInvoicesOf(orders)) {
    const b = ageingBucketOf(-dayDiff(day(o.invoice.dueDate), range.to));
    ageing[b] = ageing[b].plus(o.balance);
  }
  return {
    supplier,
    from: range.from,
    to: range.to,
    openingBalance: toMoney(opening),
    lines,
    totalDebit: toMoney(sum(inPeriod.map((l) => D(l.debit || 0)))),
    totalCredit: toMoney(sum(inPeriod.map((l) => D(l.credit || 0)))),
    closingBalance: toMoney(balance),
    ageing: { current: toMoney(ageing.current), days1to30: toMoney(ageing.days1to30), days31to60: toMoney(ageing.days31to60), days61to90: toMoney(ageing.days61to90), days90plus: toMoney(ageing.days90plus) },
    generatedAt: now.toISOString(),
  };
};

const cell = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The statement as CSV for the accountant's spreadsheet: one row per line, opening and closing balance rows around them. */
export const statementCsv = (s: SupplierStatement): string => {
  const rows: string[][] = [
    ['Statement of account', s.supplier.name, s.supplier.code],
    ['Period', s.from, s.to],
    [],
    ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance', 'Note'],
    [s.from, '', 'Opening balance', '', '', s.openingBalance, ''],
    ...s.lines.map((l) => [l.date, l.reference, l.description, l.debit, l.credit, l.balance, l.superseded ? 'Superseded' : '']),
    [s.to, '', 'Closing balance', s.totalDebit, s.totalCredit, s.closingBalance, ''],
  ];
  return `${rows.map((r) => r.map(cell).join(',')).join('\n')}\n`;
};
