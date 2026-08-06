import { describe, expect, it } from 'vitest';
import {
  buildStaffDetailPatch,
  cleanStaffValue,
  formatSheetAccount,
} from './payroll-staff-details';

describe('cleanStaffValue', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanStaffValue('  A001234567B  ')).toBe('A001234567B');
  });

  it('treats empty or whitespace-only strings as unset (null)', () => {
    expect(cleanStaffValue('')).toBeNull();
    expect(cleanStaffValue('   ')).toBeNull();
  });

  it('passes null/undefined through as null', () => {
    expect(cleanStaffValue(null)).toBeNull();
    expect(cleanStaffValue(undefined)).toBeNull();
  });

  it('keeps a non-empty value', () => {
    expect(cleanStaffValue('Equity Bank')).toBe('Equity Bank');
  });
});

describe('buildStaffDetailPatch', () => {
  it('trims all fields for persistence', () => {
    expect(
      buildStaffDetailPatch({
        kraPIN: '  A123B ',
        shifNhifNumber: ' NHIF-9988 ',
        nssfNumber: ' NSSF-4455 ',
        bankName: ' Equity Bank ',
        accountNumber: ' 0110123456789 ',
      }),
    ).toEqual({
      kraPIN: 'A123B',
      shifNhifNumber: 'NHIF-9988',
      nssfNumber: 'NSSF-4455',
      bankName: 'Equity Bank',
      accountNumber: '0110123456789',
    });
  });

  it('clears blanked-out fields to null instead of saving empty strings', () => {
    // Regression: HR deletes a wrong account number — it must be cleared, not
    // persisted as "" (which would still count as "set" downstream).
    expect(
      buildStaffDetailPatch({
        kraPIN: 'A123B',
        shifNhifNumber: '',
        nssfNumber: '   ',
        bankName: '',
        accountNumber: '   ',
      }),
    ).toEqual({
      kraPIN: 'A123B',
      shifNhifNumber: null,
      nssfNumber: null,
      bankName: null,
      accountNumber: null,
    });
  });

  it('always sends all keys so a single-field edit cannot drop the others', () => {
    const patch = buildStaffDetailPatch({
      kraPIN: null,
      shifNhifNumber: null,
      nssfNumber: null,
      bankName: null,
      accountNumber: null,
    });
    expect(Object.keys(patch).sort()).toEqual([
      'accountNumber',
      'bankName',
      'kraPIN',
      'nssfNumber',
      'shifNhifNumber',
    ]);
  });
});

describe('formatSheetAccount', () => {
  it('combines bank name and account number', () => {
    expect(formatSheetAccount('0110123456789', 'Equity Bank')).toBe('Equity Bank 0110123456789');
  });

  it('returns the account number alone when bank name is missing', () => {
    expect(formatSheetAccount('0110123456789', null)).toBe('0110123456789');
  });

  it('returns null when there is no account number (bank name alone is not payable)', () => {
    expect(formatSheetAccount(null, 'Equity Bank')).toBeNull();
    expect(formatSheetAccount(undefined, undefined)).toBeNull();
  });
});
