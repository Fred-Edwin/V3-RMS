import { describe, expect, it } from 'vitest';
import { describePayMethodChange } from './supplier-pay-history';

describe('describePayMethodChange', () => {
  it('names a cheque with who it is payable to', () => {
    expect(describePayMethodChange('PAY_METHOD_CREATED', null, { type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd' })).toBe(
      'Added cheque, payable to Samrat Supermarket Ltd',
    );
  });

  it('names the other kinds in words', () => {
    expect(describePayMethodChange('PAY_METHOD_CREATED', null, { type: 'MPESA_PAYBILL' })).toBe('Added M-Pesa Paybill');
    expect(describePayMethodChange('PAY_METHOD_DELETED', { type: 'BANK_TRANSFER' }, null)).toBe('Removed the bank transfer');
  });

  it('lists which fields changed without printing any value', () => {
    const before = { type: 'BANK_TRANSFER', accountNumber: '••••4821', accountName: 'Samrat Ltd', bankName: 'Equity' };
    const after = { type: 'BANK_TRANSFER', accountNumber: '••••7702', accountName: 'Samrat Ltd', bankName: 'Equity' };
    const sentence = describePayMethodChange('PAY_METHOD_UPDATED', before, after);
    expect(sentence).toBe('Changed the account number on the bank transfer');
    expect(sentence).not.toMatch(/\d/);
  });

  it('joins two or more changed fields', () => {
    const before = { type: 'BANK_TRANSFER', accountNumber: '••••1', bankName: 'Equity' };
    const after = { type: 'BANK_TRANSFER', accountNumber: '••••2', bankName: 'KCB' };
    expect(describePayMethodChange('PAY_METHOD_UPDATED', before, after)).toBe('Changed the bank and account number on the bank transfer');
  });

  it('falls back to a plain sentence when nothing visible changed', () => {
    expect(describePayMethodChange('PAY_METHOD_UPDATED', { type: 'CASH' }, { type: 'CASH' })).toBe('Changed the cash');
  });
});
