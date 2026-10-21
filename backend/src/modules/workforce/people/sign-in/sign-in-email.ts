/** The sign-in address is a name on the company domain, not a mailbox (owner, 21 Oct 2026). */
export const SIGN_IN_DOMAIN = 'wendo.co.ke';

/** Lowercase letters only: accents folded, then spaces, hyphens, apostrophes and anything else removed. */
const lettersOnly = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/**
 * `firstname.secondname`: the first word and the second word of the name. Joy Chebet Rotich becomes `joy.chebet` (the owner's
 * example); a two-word name such as Wanjiku Hire uses its last word, which is also its second, so one rule covers both.
 */
export function signInLocalPart(fullName: string): string | null {
  const words = fullName.trim().split(/\s+/).map(lettersOnly).filter((w) => w.length > 0);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0]!;
  return `${words[0]}.${words[1]}`;
}

/** The first free address: `joy.chebet@wendo.co.ke`, then `joy.chebet2@`, `joy.chebet3@` and so on. */
export async function suggestSignInEmail(fullName: string, isTaken: (email: string) => Promise<boolean>): Promise<string | null> {
  const local = signInLocalPart(fullName);
  if (!local) return null;
  for (let n = 1; n < 1000; n += 1) {
    const email = `${local}${n === 1 ? '' : String(n)}@${SIGN_IN_DOMAIN}`;
    if (!(await isTaken(email))) return email;
  }
  return null;
}
