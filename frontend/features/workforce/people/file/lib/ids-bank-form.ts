import { kraPinError, nssfError, shaError } from '../../_shared/lib/statutory-formats';
import type { PayProfileBody, UpdateEmployeeBody } from '../../_shared/types/people-requests';

/**
 * The "Edit IDs and bank" form (frame 7.2). A blank box leaves what is on file as it is (a masked number is never sent back), so only
 * what was typed is sent. Changing the bank or the account asks for a reason, because the Accountant is told.
 */
export interface IdsBankForm {
  nationalId: string;
  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
  helbNumber: string;
  bankName: string;
  accountNumber: string;
  reason: string;
}

export const EMPTY_IDS_BANK: IdsBankForm = { nationalId: '', kraPin: '', nssfNumber: '', shaNumber: '', helbNumber: '', bankName: '', accountNumber: '', reason: '' };

const ID_KEYS = ['nationalId', 'kraPin', 'nssfNumber', 'shaNumber', 'helbNumber'] as const;

/** Whether the bank or account differs from what is on file, so the reason box and the Accountant note appear. */
export function bankIsChanging(f: IdsBankForm, onFileBank: string | null): boolean {
  return f.accountNumber.trim() !== '' || (f.bankName.trim() !== '' && f.bankName.trim() !== (onFileBank ?? ''));
}

export function idsBankErrors(f: IdsBankForm, show: { ids: boolean }, onFileBank: string | null, hasAccountOnFile: boolean): Partial<Record<keyof IdsBankForm, string>> {
  const errors: Partial<Record<keyof IdsBankForm, string>> = {};
  if (show.ids) {
    const kra = kraPinError(f.kraPin);
    const nssf = nssfError(f.nssfNumber);
    const sha = shaError(f.shaNumber);
    if (kra) errors.kraPin = kra;
    if (nssf) errors.nssfNumber = nssf;
    if (sha) errors.shaNumber = sha;
  }
  if (bankIsChanging(f, onFileBank) && f.reason.trim() === '' && hasAccountOnFile) errors.reason = 'Say why the bank details are changing.';
  return errors;
}

export function idsBody(f: IdsBankForm): UpdateEmployeeBody {
  const body: UpdateEmployeeBody = {};
  for (const k of ID_KEYS) {
    const v = f[k].trim();
    if (v !== '') body[k] = v;
  }
  return body;
}

export function bankBody(f: IdsBankForm): PayProfileBody | null {
  const bankName = f.bankName.trim();
  const accountNumber = f.accountNumber.trim();
  if (bankName === '' && accountNumber === '') return null;
  return { payoutMethod: 'BANK', ...(bankName ? { bankName } : {}), ...(accountNumber ? { accountNumber } : {}), ...(f.reason.trim() ? { reason: f.reason.trim() } : {}) };
}

export const nothingTyped = (f: IdsBankForm): boolean => Object.keys(idsBody(f)).length === 0 && bankBody(f) === null;
