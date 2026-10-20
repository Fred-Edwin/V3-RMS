import { formatCents, parseCents, sumCents } from '../engine/money';
import type { BankRow } from './bank-format';

export interface BankPerson {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  net: string;
  payoutMethod: string | null;
  number: string | null; // PS-nnnn
  bank: { bankName: string | null; bankBranch: string | null; accountName: string | null; accountNumber: string | null } | null;
}

export interface CannotPay {
  employeeId: string;
  name: string;
  reason: 'NO_BANK_ACCOUNT';
}

export interface BankPlan {
  rows: BankRow[];
  people: number;
  total: string; // KES, 2 decimals
  cannotPay: CannotPay[];
  nothingToPay: { employeeId: string; name: string }[];
  /** Paid some other way (mobile money, cash, not set): not in the bank file and not blocking. */
  otherMethods: { method: string; people: number; amount: string }[];
}

const filled = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Who is in the bank file (E7, S8): bank-paid people with a net above 0 and a complete account. Casual pay is not a payslip and so
 * never here. A bank-paid person with no account is listed and blocks Mark as paid; a net of 0 is listed and does not. Rows keep
 * the order of the input (site, then name), which makes the file, and so its hash, the same every time for the same payslips.
 */
export function planBankFile(people: readonly BankPerson[], narration: string): BankPlan {
  const rows: BankRow[] = [];
  const cannotPay: CannotPay[] = [];
  const nothingToPay: { employeeId: string; name: string }[] = [];
  const other = new Map<string, bigint[]>();
  for (const p of people) {
    const cents = parseCents(p.net);
    if (p.payoutMethod !== 'BANK') {
      if (cents > 0n) other.set(p.payoutMethod ?? 'NOT_SET', [...(other.get(p.payoutMethod ?? 'NOT_SET') ?? []), cents]);
      continue;
    }
    if (cents <= 0n) {
      nothingToPay.push({ employeeId: p.employeeId, name: p.employeeName });
      continue;
    }
    const b = p.bank;
    if (!b || !filled(b.bankName) || !filled(b.accountNumber) || !filled(b.accountName)) {
      cannotPay.push({ employeeId: p.employeeId, name: p.employeeName, reason: 'NO_BANK_ACCOUNT' });
      continue;
    }
    rows.push({ reference: p.number ?? '', accountName: b.accountName.trim(), bankName: b.bankName.trim(), branch: (b.bankBranch ?? '').trim(), accountNumber: b.accountNumber.trim(), amount: formatCents(cents), currency: 'KES', narration, employeeNumber: p.employeeNumber });
  }
  return {
    rows,
    people: rows.length,
    total: formatCents(sumCents(rows.map((r) => parseCents(r.amount)))),
    cannotPay,
    nothingToPay,
    otherMethods: [...other].map(([method, cents]) => ({ method, people: cents.length, amount: formatCents(sumCents(cents)) })),
  };
}
