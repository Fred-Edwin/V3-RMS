import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { numberPad, padBackspace, padInsert, type PadEntry } from './number-pad';
import { stepValue } from './quantity-field';

const typing = { decimal: false, maxLength: 6, fresh: false };

describe('padInsert', () => {
  it('adds digits and drops a lone leading zero', () => {
    expect(padInsert('', '4', typing)).toBe('4');
    expect(padInsert('4', '2', typing)).toBe('42');
    expect(padInsert('0', '7', typing)).toBe('7');
  });

  it('keeps a leading zero in a code (PIN, account number)', () => {
    expect(padInsert('0', '1', { ...typing, keepZeros: true })).toBe('01');
    expect(padInsert('', '0', { ...typing, keepZeros: true })).toBe('0');
  });

  it('a fresh (selected) value is replaced by the first key', () => {
    expect(padInsert('34', '5', { ...typing, fresh: true })).toBe('5');
  });

  it('takes a decimal point once, and only where weight or volume allows it', () => {
    expect(padInsert('1', '.', typing)).toBe('1');
    expect(padInsert('1', '.', { ...typing, decimal: true })).toBe('1.');
    expect(padInsert('1.5', '.', { ...typing, decimal: true })).toBe('1.5');
    expect(padInsert('', '.', { ...typing, decimal: true })).toBe('0.');
  });

  it('stops at the longest value, so a PIN is four digits', () => {
    expect(padInsert('1234', '5', { ...typing, maxLength: 4 })).toBe('1234');
  });

  it('ignores anything that is not a digit or a point', () => {
    expect(padInsert('12', 'a', typing)).toBe('12');
  });
});

describe('padBackspace', () => {
  it('removes one character, or the whole selected value', () => {
    expect(padBackspace('123', false)).toBe('12');
    expect(padBackspace('123', true)).toBe('');
    expect(padBackspace('', false)).toBe('');
  });
});

describe('stepValue', () => {
  it('moves by the pack step without float noise and never below zero', () => {
    expect(stepValue('', 1, 1)).toBe('1');
    expect(stepValue('0.1', 0.2, 1)).toBe('0.3');
    expect(stepValue('1', 12, -1)).toBe('0');
    expect(stepValue('5', 1, -1)).toBe('4');
  });
});

describe('the pad store', () => {
  const made: Array<{ id: string; value: string }> = [];
  const field = (id: string, patch: Partial<PadEntry> = {}): PadEntry => {
    const record = { id, value: '' };
    made.push(record);
    const entry: PadEntry = {
      id,
      label: id,
      decimal: false,
      maxLength: 6,
      value: '',
      onChange: (v) => {
        record.value = v;
      },
      element: () => ({ compareDocumentPosition: () => 0, focus: () => undefined, scrollIntoView: () => undefined }) as unknown as HTMLElement,
      ...patch,
    };
    numberPad.register(entry);
    return entry;
  };

  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout: () => 0, clearTimeout: () => undefined });
    vi.stubGlobal('Node', { DOCUMENT_POSITION_FOLLOWING: 4 });
    vi.stubGlobal('document', { activeElement: null });
    made.length = 0;
    numberPad.reset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('types into the open field: the first key replaces what was there', () => {
    field('a', { value: '34' });
    numberPad.open('a');
    numberPad.press('5');
    numberPad.press('6');
    expect(made[0]?.value).toBe('56');
  });

  it('delete clears a freshly opened value, then removes one digit at a time', () => {
    field('a', { value: '34' });
    numberPad.open('a');
    numberPad.backspace();
    expect(made[0]?.value).toBe('');
    numberPad.press('7');
    numberPad.press('8');
    numberPad.backspace();
    expect(made[0]?.value).toBe('7');
  });

  it('a PIN calls its done handler on the fourth digit and closes', () => {
    const done = vi.fn();
    field('pin', { masked: true, maxLength: 4, onDone: done });
    numberPad.open('pin');
    '4821'.split('').forEach((d) => numberPad.press(d));
    expect(done).toHaveBeenCalledWith('4821');
  });
});
