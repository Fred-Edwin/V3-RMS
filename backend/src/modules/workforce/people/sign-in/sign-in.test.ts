import { describe, expect, it } from 'vitest';
import { signInLocalPart, suggestSignInEmail } from './sign-in-email';
import { WORD_LIST, generateTemporaryPassword } from './temporary-password';

describe('temporary password (finding 43)', () => {
  it('has at least 250 different words, lowercase letters only', () => {
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(250);
    expect(new Set(WORD_LIST).size).toBe(WORD_LIST.length);
    expect(WORD_LIST.every((w) => /^[a-z]{3,}$/.test(w))).toBe(true);
  });

  it('is word.word.1234 with two different words, over many draws', () => {
    for (let i = 0; i < 2000; i += 1) {
      const [a, b, digits, ...rest] = generateTemporaryPassword().split('.');
      expect(rest).toHaveLength(0);
      expect(a).not.toBe(b);
      expect(WORD_LIST).toContain(a);
      expect(WORD_LIST).toContain(b);
      expect(digits).toMatch(/^[1-9]\d{3}$/);
    }
  });

  it('never repeats a word even when the random source keeps picking the same slot', () => {
    let calls = 0;
    const stuck = (max: number): number => (calls++ < 3 ? 0 : Math.min(1, max - 1));
    const [a, b] = generateTemporaryPassword(stuck).split('.');
    expect(a).not.toBe(b);
  });
});

describe('sign-in address (finding 44)', () => {
  it('uses the first and second word, lowercase letters only', () => {
    expect(signInLocalPart('Joy Chebet Rotich')).toBe('joy.chebet');
    expect(signInLocalPart('Wanjiku Hire')).toBe('wanjiku.hire');
    expect(signInLocalPart("Njeri O'Brien")).toBe('njeri.obrien');
    expect(signInLocalPart('Zoë  Mary-Jane Kamau')).toBe('zoe.maryjane');
    expect(signInLocalPart('   ')).toBeNull();
  });

  it('numbers a clash: joy.chebet2@', async () => {
    const taken = new Set(['joy.chebet@wendo.co.ke', 'joy.chebet2@wendo.co.ke']);
    expect(await suggestSignInEmail('Joy Chebet Rotich', async (e) => taken.has(e))).toBe('joy.chebet3@wendo.co.ke');
    expect(await suggestSignInEmail('Joy Chebet', async () => false)).toBe('joy.chebet@wendo.co.ke');
  });
});
