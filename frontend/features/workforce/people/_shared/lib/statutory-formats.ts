/**
 * Formats of the statutory numbers, the same rule the server applies (backend `statutory-formats.ts`). KRA PIN is exact: a
 * letter, nine digits, a letter. NSSF and SHA are lenient on purpose (five to fifteen letters or digits, at least five digits)
 * because the real formats vary; tighten both sides together when the client confirms them.
 */
const squash = (value: string): string => value.replace(/[\s-]+/g, '').toUpperCase();

/** A message, or null when the value is empty (not asked yet) or fine. */
export function kraPinError(value: string): string | null {
  const v = squash(value);
  if (v === '') return null;
  return /^[A-Z]\d{9}[A-Z]$/.test(v) ? null : 'A KRA PIN is a letter, nine digits and a letter, for example A123456789B.';
}

const lenient = (value: string, what: string): string | null => {
  const v = squash(value);
  if (v === '') return null;
  return /^(?=(?:\D*\d){5})[A-Z0-9]{5,15}$/.test(v) ? null : `Check the ${what} number: five to fifteen letters or digits.`;
};
export const nssfError = (value: string): string | null => lenient(value, 'NSSF');
export const shaError = (value: string): string | null => lenient(value, 'SHA');

/** "On file, ends 0037": the last four characters, never the whole number. */
export function onFileEnding(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/[^A-Za-z0-9]/g, '');
  return v.length >= 4 ? `On file, ends ${v.slice(-4)}` : 'On file';
}
