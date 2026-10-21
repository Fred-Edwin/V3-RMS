import { kraPinError, nssfError, shaError } from '../../_shared/lib/statutory-formats';
import type { Lookups } from '../../_shared/types/people-types';
import { isCasual, type HireState, type HireStepKey } from './hire-model';

/**
 * What a step needs before "Continue". Messages say what to do, in the words of the form. They mirror the server's Zod rules
 * (`people-validators.ts`), which stay the authority: this only saves a round trip. A key is the field's name in `HireState`.
 */
export type HireErrors = Partial<Record<keyof HireState, string>>;

const PHONE = /^[0-9 +()-]{7,20}$/;
const MONEY = /^\d{1,10}(\.\d{1,2})?$/;
const HOURS = /^\d{1,3}(\.\d{1,2})?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isMoney = (value: string): boolean => MONEY.test(value.trim());
export const isHours = (value: string): boolean => HOURS.test(value.trim());

export function validateStep(step: HireStepKey, s: HireState, lookups: Lookups | null): HireErrors {
  const e: HireErrors = {};
  if (step === 'who') {
    if (s.name.trim().length < 2) e.name = 'Enter the full name.';
    if (!PHONE.test(s.phone.trim())) e.phone = 'Enter a phone number such as 0712 345 678.';
    if (s.nationalId.trim() === '') e.nationalId = 'Enter the national ID number.';
    if (s.email.trim() !== '' && !EMAIL.test(s.email.trim())) e.email = 'That does not look like an email address.';
  }
  if (step === 'job') {
    if (s.siteId === '') e.siteId = 'Choose the site.';
    if (s.departmentId === '') e.departmentId = 'Choose the department.';
    if (s.positionId === '') e.positionId = 'Choose the position.';
    else if (isCasual(s) && lookups && !lookups.positions.find((p) => p.id === s.positionId)?.casualsAllowed) e.positionId = 'This position does not take casuals.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.startDate)) e.startDate = 'Choose the start date.';
  }
  if (step === 'pay') {
    if (!isMoney(s.amount) || Number(s.amount) <= 0) e.amount = isCasual(s) ? 'Enter the daily rate in KES.' : 'Enter the monthly pay in KES.';
    if (isCasual(s)) {
      if (!isHours(s.dayHours) || Number(s.dayHours) <= 0) e.dayHours = 'Enter hours such as 8.';
    } else if (!isHours(s.weekHours) || Number(s.weekHours) <= 0) e.weekHours = 'Enter hours such as 48.';
  }
  if (step === 'statutory') {
    const kra = kraPinError(s.kraPin);
    if (kra) e.kraPin = kra;
    const nssf = nssfError(s.nssfNumber);
    if (nssf) e.nssfNumber = nssf;
    const sha = shaError(s.shaNumber);
    if (sha) e.shaNumber = sha;
    if (s.payoutMethod === 'BANK') {
      if (s.bankName.trim() === '') e.bankName = 'Enter the bank.';
      if (s.accountNumber.trim() === '') e.accountNumber = 'Enter the account number.';
    }
    if (s.payoutMethod === 'MPESA' && !PHONE.test(s.mpesaPhone.trim())) e.mpesaPhone = 'Enter the M-Pesa phone number.';
  }
  if (step === 'login') {
    if (!EMAIL.test(s.loginEmail.trim())) e.loginEmail = 'Enter the sign-in email.';
    if (s.loginRole === '') e.loginRole = 'Choose what the account may do.';
    if (s.temporaryPassword.length < 10) e.temporaryPassword = 'The password needs at least 10 characters.';
  }
  return e;
}

export const hasErrors = (errors: HireErrors): boolean => Object.keys(errors).length > 0;
