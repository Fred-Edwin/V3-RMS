import type { ContractBody, CreateLoginBody, PayChangeBody, ProbationDecisionBody } from '../../_shared/types/people-requests';
import { formatDayMonth, formatKes } from '../../_shared/lib/people-dates';
import type { HireLoginRole, Lookups, PayChangeReason } from '../../_shared/types/people-types';

/**
 * What the file's dialogs check before they send, and the body they send. Pure, so each rule is tested once. The server checks
 * again and is the authority; these only keep an obviously wrong form from leaving the screen. Errors are plain sentences.
 */
export type Errors<T> = Partial<Record<keyof T, string>>;
export const hasErrors = (errors: object): boolean => Object.keys(errors).length > 0;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (date: string): string => MONTHS[Number(date.split('-')[1]) - 1] ?? '';

// ---- change pay (W10) -------------------------------------------------------------------------
export interface PayChangeForm {
  amount: string;
  startsOn: string;
  reason: PayChangeReason | '';
  note: string;
}

export function validatePayChange(f: PayChangeForm, today: string, current: string | null): Errors<PayChangeForm> {
  const errors: Errors<PayChangeForm> = {};
  const amount = Number(f.amount);
  if (f.amount === '' || !(amount > 0)) errors.amount = 'Enter the new basic pay.';
  else if (current !== null && amount === Number(current)) errors.amount = 'That is the pay already in force.';
  if (!f.startsOn) errors.startsOn = 'Pick the day it starts.';
  else if (f.startsOn < today) errors.startsOn = 'It cannot start in the past.';
  if (f.reason === '') errors.reason = 'Choose a reason.';
  if (f.reason === 'OTHER' && f.note.trim() === '') errors.note = 'Say what the reason is.';
  return errors;
}

export function toPayChangeBody(f: PayChangeForm): PayChangeBody {
  return { amount: Number(f.amount).toFixed(2), effectiveFrom: f.startsOn, reason: f.reason as PayChangeReason, ...(f.note.trim() ? { note: f.note.trim() } : {}) };
}

/** The numbered "who decides" list (Paper `13F3-0`): the sender, the Director, the Accountant. */
export function payChangeSteps(senderName: string, startsOn: string): string[] {
  return [`${senderName} sends it`, 'The Director approves it. Until then the old amount applies.', startsOn ? `The Accountant sees the new amount in the ${monthName(startsOn)} pay run` : 'The Accountant sees the new amount in the pay run'];
}

/** The Director's answer (W11): a decline needs a reason. */
export function validateDecision(decision: 'APPROVE' | 'DECLINE', note: string): string | null {
  return decision === 'DECLINE' && note.trim() === '' ? 'Say why it is declined.' : null;
}

export const pendingLine = (amount: string, startsOn: string): string => `${formatKes(amount)} from ${formatDayMonth(startsOn)}`;

// ---- probation (W13, W14) ---------------------------------------------------------------------
export type ProbationChoice = 'CONFIRM' | 'EXTEND' | 'END';
export interface ProbationForm {
  choice: ProbationChoice;
  months: string;
  reason: string;
}

export function validateProbation(f: ProbationForm, rule: Lookups['probationRule'], extensionsLeft: number): Errors<ProbationForm> {
  const errors: Errors<ProbationForm> = {};
  if (f.choice !== 'EXTEND') return errors;
  const months = Number(f.months);
  if (extensionsLeft <= 0) errors.choice = 'This probation has already been extended the most it can be.';
  if (!Number.isInteger(months) || months < 1 || months > rule.maxExtensionMonths) errors.months = `Choose 1 to ${rule.maxExtensionMonths} months.`;
  if (f.reason.trim() === '') errors.reason = 'Say why. The person is told.';
  return errors;
}

export function toProbationBody(f: ProbationForm): ProbationDecisionBody {
  if (f.choice === 'EXTEND') return { decision: 'EXTEND', months: Number(f.months), reason: f.reason.trim() };
  return { decision: f.choice };
}

// ---- contract (W12) ---------------------------------------------------------------------------
export interface ContractForm {
  contractTypeId: string;
  startsOn: string;
  endsOn: string;
}

export function validateContract(f: ContractForm, endsRequired: boolean): Errors<ContractForm> {
  const errors: Errors<ContractForm> = {};
  if (!f.startsOn) errors.startsOn = 'Pick the day the contract starts.';
  if (endsRequired && !f.endsOn) errors.endsOn = 'This kind of contract has an end date.';
  if (f.endsOn && f.startsOn && f.endsOn < f.startsOn) errors.endsOn = 'The end cannot be before the start.';
  return errors;
}

export function toContractBody(f: ContractForm): ContractBody {
  return { startsOn: f.startsOn, ...(f.contractTypeId ? { contractTypeId: f.contractTypeId } : {}), ...(f.endsOn ? { endsOn: f.endsOn } : {}) };
}

// ---- login (W24) ------------------------------------------------------------------------------
export interface LoginForm {
  email: string;
  loginRole: string;
  temporaryPassword: string;
}

export function validateLogin(f: LoginForm): Errors<LoginForm> {
  const errors: Errors<LoginForm> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) errors.email = 'Enter a sign-in email like name@company.com.';
  if (f.loginRole === '') errors.loginRole = 'Choose what the account may do.';
  if (f.temporaryPassword.length < 8) errors.temporaryPassword = 'The temporary password needs at least 8 characters.';
  return errors;
}

export const toLoginBody = (f: LoginForm): CreateLoginBody => ({ email: f.email.trim(), loginRole: f.loginRole as HireLoginRole, temporaryPassword: f.temporaryPassword });
