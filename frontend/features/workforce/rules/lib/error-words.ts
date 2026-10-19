import { ApiError } from '@/types/api';

import { longDay, WEEKDAY_NAMES } from './rules-words';

/** The server's refusal codes (docs/API_CONTRACT.md §39) in the words a screen shows. Anything unknown keeps the server's own sentence. */
export type RuleFailureKind = 'pin' | 'locked' | 'stale' | 'date' | 'other';

export interface RuleFailure {
  code: string;
  kind: RuleFailureKind;
  text: string;
  /** Present on RULE_STALE: the newest number in the scope. */
  latestVersion?: number;
}

interface Details {
  version?: number;
  effectiveFrom?: string;
  withdrawable?: boolean;
  latestVersion?: number;
}

const detailsOf = (error: ApiError): Details => (error.details !== null && typeof error.details === 'object' && !Array.isArray(error.details) ? (error.details as Details) : {});

export function wordsForCode(code: string, message: string, details: Details = {}, weekStartName?: string): { kind: RuleFailureKind; text: string } {
  switch (code) {
    case 'PIN_INVALID':
      return { kind: 'pin', text: 'That PIN is not right. Try again.' };
    case 'PIN_LOCKED':
      return { kind: 'locked', text: 'Too many wrong PINs. Signing is locked for 10 minutes. Try again later, or ask the System Admin to reset your PIN.' };
    case 'PIN_NOT_SET':
      return { kind: 'pin', text: 'You have not set a signing PIN yet. Set one, then try again.' };
    case 'RULE_STALE':
      return { kind: 'stale', text: 'Someone changed this rule a moment ago. Check the new value.' };
    case 'RULE_NO_CHANGE':
      return { kind: 'other', text: 'That is the same as today.' };
    case 'RULE_BACKDATED':
      return { kind: 'date', text: 'A rule cannot start in the past.' };
    case 'RULE_MONTH_APPROVED':
      return { kind: 'date', text: 'That month is already approved, so a rate cannot start in it. Pick a day in an open month.' };
    case 'RULE_DATE_TOO_FAR':
      return { kind: 'date', text: 'Pick a day within the next two years.' };
    case 'RULE_DATE_NOT_WEEK_START':
      return { kind: 'date', text: `Pick a ${weekStartName ?? 'day that starts the new week'}.` };
    case 'RULE_FUTURE_VERSION_EXISTS': {
      const n = details.version;
      const from = details.effectiveFrom ? longDay(details.effectiveFrom) : 'a later day';
      return { kind: 'date', text: `Version ${n ?? ''} already starts on ${from}. Choose that day or later${details.withdrawable ? `, or withdraw version ${n ?? ''} first` : ''}.`.replace('Version  ', 'A later version ') };
    }
    case 'RULE_FIELD_NOT_EDITABLE':
      return { kind: 'other', text: 'You cannot change this row. Ask the person it names.' };
    case 'RULE_CONFIRM_NOT_ALLOWED':
      return { kind: 'other', text: 'You cannot confirm this. Only the person it names can.' };
    case 'RULE_CONFIRM_NOT_REQUIRED':
      return { kind: 'other', text: 'This does not need a confirmation, or it was already confirmed.' };
    case 'RULE_VERSION_STARTED':
      return { kind: 'other', text: 'This version has already started, so it can no longer be withdrawn.' };
    case 'RULE_VERSION_NOT_LATEST':
      return { kind: 'other', text: 'A newer version exists. Only the newest version can be withdrawn.' };
    case 'RULE_VERSION_WITHDRAWN':
      return { kind: 'other', text: 'This version was already withdrawn.' };
    case 'RULE_IDEMPOTENCY_KEY_REUSED':
      return { kind: 'other', text: 'That save was already sent with different values. Close this and start again.' };
    case 'RULE_SITE_FIELD_NOT_OVERRIDABLE':
      return { kind: 'other', text: 'A site cannot have its own value for this row. It is one company rule.' };
    default:
      return { kind: 'other', text: message };
  }
}

/** Anything a save or a confirm can throw, as words. A network failure says nothing was changed (the write is atomic). */
export function ruleFailure(error: unknown, weekStartName?: string): RuleFailure {
  if (error instanceof ApiError) {
    const details = detailsOf(error);
    const found = wordsForCode(error.code, error.message, details, weekStartName);
    return { code: error.code, ...found, latestVersion: details.latestVersion };
  }
  return { code: 'NETWORK', kind: 'other', text: 'Could not save. Nothing was changed. Try again.' };
}

export const weekdayName = (isoDay: number): string => WEEKDAY_NAMES[isoDay - 1] ?? 'day';
