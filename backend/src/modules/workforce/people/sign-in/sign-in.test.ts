import { describe, expect, it } from 'vitest';
import { signInLocalPart, suggestSignInEmail } from './sign-in-email';
import { SWAHILI_WORDS } from './swahili-words';
import { WORD_LIST, generateTemporaryPassword } from './temporary-password';

/** True when one word becomes the other by changing, adding or removing a single letter. */
function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  while (i < short.length && short[i] === long[i]) i += 1;
  if (short.length === long.length) return short.slice(i + 1) === long.slice(i + 1);
  return short.slice(i) === long.slice(i + 1);
}

describe('temporary password (finding 43)', () => {
  it('has at least 250 different words, 3 to 7 lowercase letters each', () => {
    expect(SWAHILI_WORDS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(SWAHILI_WORDS).size).toBe(SWAHILI_WORDS.length);
    expect(SWAHILI_WORDS.filter((w) => !/^[a-z]{3,7}$/.test(w))).toEqual([]);
  });

  it('has no two words one letter apart (easy to misread)', () => {
    const close: string[] = [];
    for (let i = 0; i < SWAHILI_WORDS.length; i += 1) {
      for (let j = i + 1; j < SWAHILI_WORDS.length; j += 1) {
        if (oneEditApart(SWAHILI_WORDS[i]!, SWAHILI_WORDS[j]!)) close.push(`${SWAHILI_WORDS[i]}/${SWAHILI_WORDS[j]}`);
      }
    }
    expect(close).toEqual([]);
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
