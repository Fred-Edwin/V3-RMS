/** One person's line in the bank file (E7). The account number is the only place it ever appears in clear: in the file itself. */
export interface BankRow {
  reference: string; // the payslip number PS-nnnn
  accountName: string;
  bankName: string;
  branch: string;
  accountNumber: string;
  amount: string; // KES, 2 decimals, a dot
  currency: 'KES';
  narration: string; // "Wendo salary Sep 2026"
  employeeNumber: string;
}

/**
 * A bank's upload layout. The format is a business choice and replaceable per bank (E7): a new bank is a new file that implements
 * this and one line in `BANK_FORMATS`; no screen changes. `render` gets only the rows and returns the file text.
 */
export interface BankFileFormat {
  id: string;
  extension: 'csv';
  columns: readonly string[];
  render(rows: readonly BankRow[]): string;
}

/** A spreadsheet reads a cell that starts with one of these as a formula. Names come from people, so they are neutralised. */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string, text: boolean): string {
  const safe = text && FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const GENERIC_CSV: BankFileFormat = {
  id: 'generic-csv',
  extension: 'csv',
  columns: ['Reference', 'Account name', 'Bank name', 'Branch', 'Account number', 'Amount', 'Currency', 'Narration', 'Employee number'],
  render(rows) {
    const lines = rows.map((r) => [cell(r.reference, true), cell(r.accountName, true), cell(r.bankName, true), cell(r.branch, true), cell(r.accountNumber, true), cell(r.amount, false), r.currency, cell(r.narration, true), cell(r.employeeNumber, true)].join(','));
    return `${[this.columns.join(','), ...lines].join('\r\n')}\r\n`;
  },
};

export const BANK_FORMATS: Readonly<Record<string, BankFileFormat>> = { [GENERIC_CSV.id]: GENERIC_CSV };
/** The format in use. A company setting will name it when a bank asks for its own layout (decisions-2b). */
export const ACTIVE_BANK_FORMAT = GENERIC_CSV.id;

export const bankFileName = (monthKey: string, version: number): string => `bank-${monthKey}${version > 1 ? `-v${version}` : ''}.csv`;
