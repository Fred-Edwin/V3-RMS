import { describe, expect, it } from 'vitest';
import { lastFour, ownNumbersBody, ownNumbersFrom, touchesBank, validateOwnNumbers } from './own-numbers';

const onFile = ownNumbersFrom({ nationalId: '12345678', bankName: 'Equity Bank', accountNumber: '0123456789012' });

describe('own numbers', () => {
  it('starts from what is on file', () => {
    expect(onFile.nationalId).toBe('12345678');
    expect(onFile.helbNumber).toBe('');
  });

  it('sends only what changed, and says when the bank is in it', () => {
    const body = ownNumbersBody({ ...onFile, kraPin: 'A123456789B', accountNumber: '99999' }, onFile);
    expect(body).toEqual({ kraPin: 'A123456789B', accountNumber: '99999' });
    expect(touchesBank(body)).toBe(true);
    expect(ownNumbersBody(onFile, onFile)).toEqual({});
  });

  it('keeps the format checks', () => {
    expect(Object.keys(validateOwnNumbers({ ...onFile, nationalId: '12', kraPin: 'bad', nssfNumber: '1', shaNumber: '1' })).sort()).toEqual(['kraPin', 'nationalId', 'nssfNumber', 'shaNumber']);
    expect(validateOwnNumbers({ ...onFile, bankName: '' }).bankName).toBeDefined();
    expect(validateOwnNumbers(onFile)).toEqual({});
  });

  it('shows the last four only', () => {
    expect(lastFour('0123456789012')).toBe('•••• 9012');
    expect(lastFour('12')).toBe('••••');
    expect(lastFour(null)).toBe('Not on file');
  });
});
