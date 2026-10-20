/** One phone that has signed in as the person (`GET /workforce/security/phones/me`). The UI never shows how phones are recognised. */
export interface Phone {
  id: string;
  /** "Tecno, Android" */
  label: string;
  /** "Nairobi" or null when the server could not tell. */
  placeLabel: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  confirmed: boolean;
  confirmedMode: 'REMEMBER' | 'ONCE' | null;
  isThisPhone: boolean;
  notUsedFor12Months: boolean;
}

export interface PhoneList {
  phones: Phone[];
  total: number;
  /** The count when the person has five or more phones, else null. */
  manyPhones: number | null;
}

/** The answer to the call a phone makes after it signs in. */
export interface PhoneSeen {
  phone: Phone;
  /** true = show "Is this your phone?" and block the app until it is answered. */
  phoneQuestion: boolean;
  firstPhone: boolean;
}

export type PhoneAnswer = 'REMEMBER' | 'ONCE';

export type AlertKind = 'WASNT_ME' | 'UNCONFIRMED_PHONE' | 'WRONG_CODES' | 'CHAIN_FAILED';
export type AlertStatus = 'OPEN' | 'CLEARED';

export interface PersonRef {
  id: string;
  name: string;
  role: string;
}

/** A security alert for the System Admin. It holds labels only: never an amount, a code or a payslip number. */
export interface AlertRow {
  id: string;
  kind: AlertKind;
  status: AlertStatus;
  occurredAt: string;
  person: PersonRef | null;
  deviceLabel: string | null;
  placeLabel: string | null;
  detail: string | null;
  siteId: string | null;
  auditEntryId: string | null;
  clearedBy: PersonRef | null;
  clearedAt: string | null;
  clearNote: string | null;
}

export interface AlertList {
  items: AlertRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AlertCounts {
  open: number;
  cleared: number;
  all: number;
  /** false until a System Admin presses "Start alerts" (the rollout gate for the unconfirmed-phone alert). */
  alertsStarted: boolean;
}

export interface AlertQuery {
  status?: AlertStatus;
  kind?: AlertKind;
  page: number;
  pageSize: number;
}
