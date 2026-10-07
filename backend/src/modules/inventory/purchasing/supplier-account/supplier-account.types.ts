import type { OrderRowView } from '../_shared/purchasing.types';

export interface SupplierOwing {
  /** What we owe on open invoices after advances and payments. */
  owing: string;
  overdue: string;
  overdueCount: number;
  openInvoices: number;
  disputedAmount: string;
  /** Advances held that no invoice has used yet, plus any left over from a short delivery. */
  creditHeld: string;
  nextDueDate: string | null;
  late: { days1To30: string; days31To60: string; days61To90: string; days90Plus: string };
  invoices: Array<{ id: string; orderId: string; invoiceNumber: string; invoiceDate: string; dueDate: string; outstanding: string }>;
}

export interface SupplierPurchasing {
  owing: SupplierOwing;
  orders: OrderRowView[];
}

/**
 * One line of the supplier's view of our account: `credit` adds to what we owe (an invoice, a reversed payment), `debit`
 * reduces it (a payment, an advance, a voided invoice). `balance` is what we owe after the line.
 */
export interface StatementLine {
  at: string;
  date: string;
  kind: 'INVOICE' | 'ADVANCE' | 'PAYMENT' | 'REVERSAL' | 'VOID';
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  /** Struck through: a voided invoice, or a payment that was reversed. */
  superseded: boolean;
  orderId: string;
}

export interface SupplierStatement {
  supplier: { id: string; name: string; code: string; address: string; contactName: string | null; termsDays: number | null };
  from: string;
  to: string;
  openingBalance: string;
  lines: StatementLine[];
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  ageing: { current: string; days1to30: string; days31to60: string; days61to90: string; days90plus: string };
  generatedAt: string;
}
