import { describe, expect, it } from 'vitest';

import { kraPinError, nssfError, onFileEnding, shaError } from './statutory-formats';

describe('statutory formats on screen', () => {
  it('KRA PIN: letter, nine digits, letter', () => {
    expect(kraPinError('123')).not.toBeNull();
    expect(kraPinError('a123456789b')).toBeNull();
    expect(kraPinError('')).toBeNull();
  });
  it('NSSF and SHA refuse junk and accept the numbers on file', () => {
    expect(nssfError('ab')).not.toBeNull();
    expect(shaError('x')).not.toBeNull();
    expect(nssfError('900037')).toBeNull();
    expect(shaError('5000091')).toBeNull();
  });
  it('shows only the ending of a number on file', () => {
    expect(onFileEnding('900037')).toBe('On file, ends 0037');
    expect(onFileEnding(null)).toBeNull();
  });
});
