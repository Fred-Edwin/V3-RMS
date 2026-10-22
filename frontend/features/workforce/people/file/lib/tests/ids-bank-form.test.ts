import { describe, expect, it } from 'vitest';
import { EMPTY_IDS_BANK, bankBody, bankIsChanging, idsBankErrors, idsBody, nothingTyped } from '../ids-bank-form';

const form = (over: Partial<typeof EMPTY_IDS_BANK>) => ({ ...EMPTY_IDS_BANK, ...over });

describe('Edit IDs and bank form', () => {
  it('sends only what was typed', () => {
    expect(idsBody(form({ kraPin: ' A123456789B ' }))).toEqual({ kraPin: 'A123456789B' });
    expect(nothingTyped(EMPTY_IDS_BANK)).toBe(true);
  });

  it('keeps the format checks on KRA PIN, NSSF and SHA', () => {
    const errors = idsBankErrors(form({ kraPin: 'bad', nssfNumber: '12', shaNumber: '12' }), { ids: true }, null, false);
    expect(Object.keys(errors).sort()).toEqual(['kraPin', 'nssfNumber', 'shaNumber']);
    expect(idsBankErrors(form({ kraPin: 'bad' }), { ids: false }, null, false)).toEqual({});
  });

  it('asks for a reason only when an account on file is being changed', () => {
    expect(bankIsChanging(form({ accountNumber: '0123' }), 'Equity Bank')).toBe(true);
    expect(bankIsChanging(form({ bankName: 'Equity Bank' }), 'Equity Bank')).toBe(false);
    expect(idsBankErrors(form({ accountNumber: '0123' }), { ids: false }, 'Equity Bank', true).reason).toBeDefined();
    expect(idsBankErrors(form({ accountNumber: '0123' }), { ids: false }, null, false).reason).toBeUndefined();
    expect(idsBankErrors(form({ accountNumber: '0123', reason: 'Moved banks' }), { ids: false }, 'Equity Bank', true)).toEqual({});
  });

  it('builds a bank body only when the bank or account was typed', () => {
    expect(bankBody(EMPTY_IDS_BANK)).toBeNull();
    expect(bankBody(form({ bankName: 'KCB Bank', accountNumber: '99', reason: 'New account' }))).toEqual({ payoutMethod: 'BANK', bankName: 'KCB Bank', accountNumber: '99', reason: 'New account' });
  });
});
