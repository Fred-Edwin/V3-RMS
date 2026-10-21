import { kraPinError, nssfError, shaError } from '../../_shared/lib/statutory-formats';
import type { PatchMeBody } from '../../_shared/types/people-requests';

/**
 * The person's own numbers (frames 8.1 to 8.3): National ID, KRA PIN, NSSF, SHA, HELB, bank and account. They are edited at any time
 * and save at once; HR does not re-check them. The format checks stay (the same ones the server applies).
 */
export interface OwnNumbersForm {
  nationalId: string;
  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
  helbNumber: string;
  bankName: string;
  accountNumber: string;
}

export const OWN_NUMBER_KEYS = ['nationalId', 'kraPin', 'nssfNumber', 'shaNumber', 'helbNumber', 'bankName', 'accountNumber'] as const;

/** The form starts from what is on file (the person's own file arrives in clear), so Edit shows the numbers, not blanks. */
export function ownNumbersFrom(sensitive: Partial<Record<string, string | null>>): OwnNumbersForm {
  const get = (k: (typeof OWN_NUMBER_KEYS)[number]): string => sensitive[k] ?? '';
  return { nationalId: get('nationalId'), kraPin: get('kraPin'), nssfNumber: get('nssfNumber'), shaNumber: get('shaNumber'), helbNumber: get('helbNumber'), bankName: get('bankName'), accountNumber: get('accountNumber') };
}

export function validateOwnNumbers(f: OwnNumbersForm): Partial<Record<keyof OwnNumbersForm, string>> {
  const errors: Partial<Record<keyof OwnNumbersForm, string>> = {};
  const id = f.nationalId.trim();
  const account = f.accountNumber.trim();
  if (id !== '' && !/^\d{7,9}$/.test(id)) errors.nationalId = 'A National ID has 7 to 9 digits.';
  const kra = kraPinError(f.kraPin);
  const nssf = nssfError(f.nssfNumber);
  const sha = shaError(f.shaNumber);
  if (kra) errors.kraPin = kra;
  if (nssf) errors.nssfNumber = nssf;
  if (sha) errors.shaNumber = sha;
  if (account !== '' && !/^\d{5,20}$/.test(account)) errors.accountNumber = 'An account number has 5 to 20 digits.';
  if (account !== '' && f.bankName.trim() === '') errors.bankName = 'Choose the bank for this account.';
  if (f.bankName.trim() !== '' && account === '') errors.accountNumber = 'Enter the account number.';
  return errors;
}

/** Only what differs from what is on file is sent, so saving without a change sends nothing and an untouched box never clears a value. */
export function ownNumbersBody(f: OwnNumbersForm, onFile: OwnNumbersForm): PatchMeBody {
  const body: PatchMeBody = {};
  for (const k of OWN_NUMBER_KEYS) {
    const v = f[k].trim();
    if (v !== '' && v !== onFile[k].trim()) body[k] = v;
  }
  return body;
}

/** Whether the bank or the account is in the change, so the Accountant note shows. */
export const touchesBank = (body: PatchMeBody): boolean => body.bankName !== undefined || body.accountNumber !== undefined;

/** "•••• 5678": the last four characters, never the whole number. A short value shows only dots. */
export function lastFour(value: string | null | undefined): string {
  if (!value) return 'Not on file';
  const v = value.replace(/\s+/g, '');
  return v.length > 4 ? `•••• ${v.slice(-4)}` : '••••';
}
