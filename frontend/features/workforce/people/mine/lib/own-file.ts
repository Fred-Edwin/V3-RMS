import type { PatchMeBody } from '../../_shared/types/people-requests';
import type { EmployeeFile } from '../../_shared/types/people-types';

/**
 * The person's own file (Paper `SJY-0` steps 2 and 3, `12UL-0`): what is still to finish, in the person's words, and the bodies the
 * small forms send. Pure and tested. Nothing here names a role: it works from the file the API sent for `me`.
 */
export type OwnForm = 'emergency' | 'numbers' | 'photo';
/** The forms the screen can open: the three HR can ask for, and the ID and bank form the person opens themselves (finding 15). */
export type OwnDialog = OwnForm | 'idbank';

export interface StillToFinish {
  key: OwnForm;
  title: string;
  /** The grey line, "HR asked for this on 2 Oct" when HR asked. */
  detail: string | null;
  /** The word on the button. */
  action: string;
}

const TITLES: Record<OwnForm, string> = { emergency: 'Emergency contact', numbers: 'NSSF and SHA numbers', photo: 'Your photo' };
const PART_FOR: Record<OwnForm, 'EMERGENCY_CONTACT' | 'NSSF_SHA' | 'PHOTO_AND_DETAILS'> = { emergency: 'EMERGENCY_CONTACT', numbers: 'NSSF_SHA', photo: 'PHOTO_AND_DETAILS' };
const KIND_FOR: Record<string, OwnForm> = { EMERGENCY_CONTACT: 'emergency', NSSF_SHA: 'numbers', PHOTO_AND_DETAILS: 'photo' };

export function stillToFinish(file: EmployeeFile, dayWords: (date: string) => string): StillToFinish[] {
  const asked = new Map<OwnForm, string>();
  for (const s of file.nextSteps) {
    const form = s.fileRequestKind ? KIND_FOR[s.fileRequestKind] : undefined;
    if (form && s.fileRequestAskedOn) asked.set(form, s.fileRequestAskedOn);
  }
  return (['emergency', 'numbers', 'photo'] as const).flatMap((key): StillToFinish[] => {
    const part = file.completeness?.parts.find((p) => p.part === PART_FOR[key]);
    const open = part ? part.applicable && !part.done : asked.has(key);
    if (!open && !asked.has(key)) return [];
    // Both numbers are already on the file (the IDs card shows them): there is nothing left to ask for (finding 66).
    if (key === 'numbers' && file.sensitive.nssfNumber && file.sensitive.shaNumber) return [];
    const when = asked.get(key);
    return [{ key, title: TITLES[key], detail: when ? `HR asked for this on ${dayWords(when)}` : null, action: 'Add' }];
  });
}

export const RELATIONS = ['Parent', 'Spouse', 'Sibling', 'Other'] as const;

export interface EmergencyForm {
  name: string;
  relation: string;
  phone: string;
}

export function validateEmergency(f: EmergencyForm): Partial<Record<keyof EmergencyForm, string>> {
  const errors: Partial<Record<keyof EmergencyForm, string>> = {};
  if (f.name.trim().length < 2) errors.name = 'Enter their name.';
  if (f.relation === '') errors.relation = 'Choose how they are related to you.';
  if (f.phone.replace(/\D/g, '').length < 9) errors.phone = 'Enter a phone number such as 0712 345 678.';
  return errors;
}

export const toEmergencyBody = (f: EmergencyForm): PatchMeBody => ({ emergencyName: f.name.trim(), emergencyRelation: f.relation, emergencyPhone: f.phone.trim() });

export interface NumbersForm {
  nssf: string;
  sha: string;
}

/** Only a number that was typed is sent: "Not sure? Skip, and HR will help". At least one is needed to save. */
export function toNumbersBody(f: NumbersForm): PatchMeBody {
  return { ...(f.nssf.trim() ? { nssfNumber: f.nssf.trim() } : {}), ...(f.sha.trim() ? { shaNumber: f.sha.trim() } : {}) };
}
export const numbersEmpty = (f: NumbersForm): boolean => Object.keys(toNumbersBody(f)).length === 0;

export interface IdBankForm {
  nationalId: string;
  bank: string;
  accountNumber: string;
}

/** A Kenyan National ID is seven or eight digits (nine for some older cards); an account number is five to twenty digits. */
export function validateIdBank(f: IdBankForm): Partial<Record<keyof IdBankForm, string>> {
  const errors: Partial<Record<keyof IdBankForm, string>> = {};
  const id = f.nationalId.trim();
  const account = f.accountNumber.trim();
  if (id !== '' && !/^\d{7,9}$/.test(id)) errors.nationalId = 'A National ID has 7 to 9 digits.';
  if (account !== '' && !/^\d{5,20}$/.test(account)) errors.accountNumber = 'An account number has 5 to 20 digits.';
  if (account !== '' && f.bank === '') errors.bank = 'Choose the bank for this account.';
  if (f.bank !== '' && account === '') errors.accountNumber = 'Enter the account number.';
  return errors;
}

/** Only what was typed or chosen is sent, so an empty box never clears something already on file. */
export function toIdBankBody(f: IdBankForm): PatchMeBody {
  return {
    ...(f.nationalId.trim() ? { nationalId: f.nationalId.trim() } : {}),
    ...(f.bank ? { bankName: f.bank.trim() } : {}),
    ...(f.accountNumber.trim() ? { accountNumber: f.accountNumber.trim() } : {}),
  };
}
export const idBankEmpty = (f: IdBankForm): boolean => Object.keys(toIdBankBody(f)).length === 0;

/** "Day 80 of 90": how far through the finishing list the person is, for the bar in the header. */
export function finishProgress(file: EmployeeFile): { done: number; total: number } {
  const parts = (file.completeness?.parts ?? []).filter((p) => p.applicable && (p.part === 'EMERGENCY_CONTACT' || p.part === 'NSSF_SHA' || p.part === 'PHOTO_AND_DETAILS'));
  return { done: parts.filter((p) => p.done).length, total: parts.length };
}
