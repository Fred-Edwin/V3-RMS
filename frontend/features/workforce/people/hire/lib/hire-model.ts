import type { DraftBody, HireBody, HireEmployment } from '../../_shared/types/people-requests';
import type { HireLoginRole, PayoutMethod } from '../../_shared/types/people-types';

/**
 * The hire form as one plain object, and the pure functions around it: which steps a hire has, what each step sends, and what a
 * draft keeps. The screen and the hook only move values in and out of this; nothing here knows React.
 */
export type HireStepKey = 'who' | 'job' | 'pay' | 'statutory' | 'login';

export interface HireState {
  name: string;
  phone: string;
  nationalId: string;
  email: string;
  siteId: string;
  departmentId: string;
  positionId: string;
  reportsToId: string;
  employment: HireEmployment;
  /** `null` = follow the position's default. */
  tracksTime: boolean | null;
  startDate: string;
  amount: string;
  weekHours: string;
  dayHours: string;
  overtimeEligible: boolean;
  kraPin: string;
  nssfNumber: string;
  shaNumber: string;
  helbNumber: string;
  payoutMethod: PayoutMethod;
  bankName: string;
  accountNumber: string;
  mpesaPhone: string;
  loginEmail: string;
  loginRole: string;
  temporaryPassword: string;
  confirmDuplicatePhone: boolean;
}

export const emptyHire = (today: string): HireState => ({
  name: '',
  phone: '',
  nationalId: '',
  email: '',
  siteId: '',
  departmentId: '',
  positionId: '',
  reportsToId: '',
  employment: 'MONTHLY_NO_CONTRACT_YET',
  tracksTime: null,
  startDate: today,
  amount: '',
  weekHours: '48',
  dayHours: '8',
  overtimeEligible: false,
  kraPin: '',
  nssfNumber: '',
  shaNumber: '',
  helbNumber: '',
  payoutMethod: 'BANK',
  bankName: '',
  accountNumber: '',
  mpesaPhone: '',
  loginEmail: '',
  loginRole: '',
  temporaryPassword: '',
  confirmDuplicatePhone: false,
});

export const isCasual = (state: Pick<HireState, 'employment'>): boolean => state.employment === 'CASUAL';

/** The steps of this hire. Someone who may not set pay (a Branch Manager) stops after the job; a casual has no bank or login. */
export function stepsFor(state: Pick<HireState, 'employment'>, canSetPay: boolean): HireStepKey[] {
  if (!canSetPay) return ['who', 'job'];
  return isCasual(state) ? ['who', 'job', 'pay'] : ['who', 'job', 'pay', 'statutory', 'login'];
}

const trimmed = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

/** The body for `POST /workforce/people`. Parts the person may not set, or a casual does not have, are left out. */
export function toHireBody(state: HireState, canSetPay: boolean, draftId?: string): HireBody {
  const casual = isCasual(state);
  const body: HireBody = {
    draftId,
    who: { name: state.name.trim(), phone: state.phone.trim(), nationalId: state.nationalId.trim(), email: trimmed(state.email) },
    job: {
      siteId: state.siteId,
      departmentId: state.departmentId,
      positionId: state.positionId,
      reportsToId: state.reportsToId === '' ? null : state.reportsToId,
      employment: state.employment,
      tracksTime: state.tracksTime ?? undefined,
      startDate: state.startDate,
    },
    confirmDuplicatePhone: state.confirmDuplicatePhone,
  };
  if (!canSetPay) return body;
  body.pay = {
    amount: state.amount.trim(),
    overtimeEligible: casual ? false : state.overtimeEligible,
    standardWeekHours: casual ? undefined : trimmed(state.weekHours),
    standardDayHours: casual ? trimmed(state.dayHours) : undefined,
  };
  if (casual) return body;
  body.statutory = {
    kraPin: trimmed(state.kraPin),
    nssfNumber: trimmed(state.nssfNumber),
    shaNumber: trimmed(state.shaNumber),
    helbNumber: trimmed(state.helbNumber),
    payoutMethod: state.payoutMethod,
    bankName: state.payoutMethod === 'BANK' ? trimmed(state.bankName) : undefined,
    accountNumber: state.payoutMethod === 'BANK' ? trimmed(state.accountNumber) : undefined,
    mpesaPhone: state.payoutMethod === 'MPESA' ? trimmed(state.mpesaPhone) : undefined,
  };
  body.login = { email: state.loginEmail.trim(), loginRole: state.loginRole as HireLoginRole, temporaryPassword: state.temporaryPassword };
  return body;
}

/** What a draft keeps. Never the temporary password or the bank account number: a draft sits on the server for up to 30 days. */
const NEVER_IN_A_DRAFT: readonly (keyof HireState)[] = ['temporaryPassword', 'accountNumber'];

export function toDraft(state: HireState, step: number): DraftBody {
  const payload: Record<string, unknown> = { ...state };
  for (const key of NEVER_IN_A_DRAFT) delete payload[key];
  return { kind: isCasual(state) ? 'CASUAL' : 'MONTHLY', step, payload };
}

/** Reads a draft back over the empty form. Unknown or wrongly typed values are ignored, so an old draft never breaks the form. */
export function fromDraft(payload: Record<string, unknown>, today: string): HireState {
  const base = emptyHire(today);
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base) as (keyof HireState)[]) {
    const value = payload[key];
    const expected = typeof base[key];
    if (typeof value === expected || (key === 'tracksTime' && (value === null || typeof value === 'boolean'))) out[key] = value;
  }
  return out as unknown as HireState;
}

const WORDS = ['maji', 'kahawa', 'jua', 'mlima', 'simba', 'chai', 'pwani', 'nyota'];

/** "maji-kahawa-4721": two words and four digits, from the browser's random source. */
export function generateTemporaryPassword(random: (n: number) => number = defaultRandom): string {
  const word = (): string => WORDS[random(WORDS.length)] ?? 'maji';
  return `${word()}-${word()}-${String(1000 + random(9000))}`;
}

function defaultRandom(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) % max;
}
