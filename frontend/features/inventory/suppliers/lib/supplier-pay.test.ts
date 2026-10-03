import { describe, expect, it } from 'vitest';
import type { SupplierPayMethod } from '../types/supplier';
import { groupAccountNumber, payMethodDetail } from './supplier-pay';

const method = (over: Partial<SupplierPayMethod>): SupplierPayMethod => ({
  id: 'm', type: 'CASH', isDefault: false, bankName: null, bankBranch: null, accountName: null, accountNumberMasked: null, paybillNumber: null,
  accountReference: null, tillNumber: null, phone: null, registeredName: null, note: null, createdAt: '', updatedAt: '', ...over,
});

describe('payment method rows', () => {
  it('groups an account number in fours', () => {
    expect(groupAccountNumber('017029157702')).toBe('0170 2915 7702');
    expect(groupAccountNumber('0170 2915 7702')).toBe('0170 2915 7702');
  });
  it('words each kind', () => {
    expect(payMethodDetail(method({ type: 'BANK_TRANSFER', bankName: 'Equity Bank', bankBranch: 'Nyeri', accountName: 'Samrat Supermarket Ltd' })).primary).toBe('Equity Bank · Nyeri branch · Samrat Supermarket Ltd');
    expect(payMethodDetail(method({ type: 'MPESA_PAYBILL', paybillNumber: '600100', accountReference: 'SAMRAT-WENDO' }))).toEqual({ primary: 'Paybill 600100', secondary: 'Account reference SAMRAT-WENDO', mono: true });
    expect(payMethodDetail(method({ type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd', bankName: 'Equity Bank', note: 'Used for invoices over KES 100,000' }))).toEqual({
      primary: 'Payable to Samrat Supermarket Ltd · Equity Bank', secondary: 'Used for invoices over KES 100,000', mono: false,
    });
  });
});
