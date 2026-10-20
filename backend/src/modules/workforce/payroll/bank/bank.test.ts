import { describe, expect, it } from 'vitest';
import { GENERIC_CSV, bankFileName } from './bank-format';
import { planBankFile, type BankPerson } from './bank-rows';

const account = { bankName: 'Alpha Bank', bankBranch: 'Nyeri', accountName: 'Joy Chebet', accountNumber: '0011223344' };
const who = (over: Partial<BankPerson> = {}): BankPerson => ({ employeeId: 'e1', employeeNumber: 'W-001', employeeName: 'Joy Chebet', net: '27940.50', payoutMethod: 'BANK', number: 'PS-0987', bank: account, ...over });

describe('planBankFile', () => {
  it('puts a bank-paid person with an account in the file, with the amount to 2 decimals', () => {
    const plan = planBankFile([who()], 'Wendo salary Sep 2026');
    expect(plan.rows).toEqual([{ reference: 'PS-0987', accountName: 'Joy Chebet', bankName: 'Alpha Bank', branch: 'Nyeri', accountNumber: '0011223344', amount: '27940.50', currency: 'KES', narration: 'Wendo salary Sep 2026', employeeNumber: 'W-001' }]);
    expect(plan.total).toBe('27940.50');
  });

  it('lists a bank-paid person with no account, and leaves them out of the file', () => {
    const plan = planBankFile([who(), who({ employeeId: 'e2', employeeName: 'Ann', bank: { ...account, accountNumber: ' ' } }), who({ employeeId: 'e3', employeeName: 'Bo', bank: null })], 'n');
    expect(plan.people).toBe(1);
    expect(plan.cannotPay.map((c) => c.name)).toEqual(['Ann', 'Bo']);
  });

  it('a net of 0 is listed apart and never blocks; other payout methods are counted apart', () => {
    const plan = planBankFile([who({ net: '0.00' }), who({ employeeId: 'e2', payoutMethod: 'MPESA', net: '100.00' }), who({ employeeId: 'e3', payoutMethod: null, net: '50.25' })], 'n');
    expect(plan.rows).toHaveLength(0);
    expect(plan.cannotPay).toHaveLength(0);
    expect(plan.nothingToPay).toHaveLength(1);
    expect(plan.otherMethods).toEqual([{ method: 'MPESA', people: 1, amount: '100.00' }, { method: 'NOT_SET', people: 1, amount: '50.25' }]);
  });

  it('sums in cents, so the total is exact', () => {
    const plan = planBankFile([who({ net: '0.10' }), who({ employeeId: 'e2', net: '0.20' }), who({ employeeId: 'e3', net: '0.30' })], 'n');
    expect(plan.total).toBe('0.60');
  });
});

describe('the generic CSV', () => {
  it('has the columns of the spec, in order, a header row and one line per person', () => {
    const text = GENERIC_CSV.render(planBankFile([who()], 'Wendo salary Sep 2026').rows);
    const [header, line] = text.split('\r\n');
    expect(header).toBe('Reference,Account name,Bank name,Branch,Account number,Amount,Currency,Narration,Employee number');
    expect(line).toBe('PS-0987,Joy Chebet,Alpha Bank,Nyeri,0011223344,27940.50,KES,Wendo salary Sep 2026,W-001');
  });

  it('quotes commas and quotes, and neutralises a cell a spreadsheet would run as a formula', () => {
    const text = GENERIC_CSV.render(planBankFile([who({ bank: { ...account, accountName: '=SUM(A1),"x"' } })], 'n').rows);
    expect(text).toContain(`"'=SUM(A1),""x"""`);
  });

  it('is the same bytes for the same people', () => {
    const a = GENERIC_CSV.render(planBankFile([who()], 'n').rows);
    expect(GENERIC_CSV.render(planBankFile([who()], 'n').rows)).toBe(a);
  });
});

describe('bankFileName', () => {
  it('names the first file and a replacement', () => {
    expect(bankFileName('2026-09', 1)).toBe('bank-2026-09.csv');
    expect(bankFileName('2026-09', 2)).toBe('bank-2026-09-v2.csv');
  });
});
