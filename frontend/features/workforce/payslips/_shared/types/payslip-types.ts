/** What `/workforce/payslips` returns (API_CONTRACT §42). Money is a string with two decimals; months are 'YYYY-MM'; days are 'YYYY-MM-DD'. */

export interface LegacyState {
  onNewSystem: boolean;
  hasOldPayslips: boolean;
  /** Show "Your payslips are still on the old screen". */
  card: boolean;
  /** Show the History row "Before October 2026". */
  historyRow: boolean;
  emptyReason: 'BRANCH_NOT_MOVED' | null;
}

export type PayslipStatus = 'PUBLISHED' | 'PAID';

export interface PayslipItem {
  id: string;
  month: string;
  versionNumber: number;
  correctedAt: string | null;
  payDay: string | null;
  paidOn: string | null;
  status: PayslipStatus;
}

export interface PayslipListItem extends PayslipItem {
  net: string;
}

/** `GET /me`: months and pay days, never an amount. Needs no code. */
export interface LockedList {
  unlockRequired: true;
  hasCode: boolean;
  items: PayslipItem[];
  legacyAvailable: boolean;
  legacy: LegacyState;
}

export interface Unlocked {
  unlockToken: string;
  expiresAt: string;
  idleSeconds: number;
}

export interface Bank {
  name: string;
  last4: string | null;
}

export interface HomeData {
  latest: (PayslipListItem & { bank: Bank | null }) | null;
  ytd: { fromMonth: string; toMonth: string; earned: string; takenOff: string; net: string } | null;
  recent: PayslipListItem[];
  legacyAvailable: boolean;
  legacy: LegacyState;
}

export type P9State = 'NOT_YET' | 'WAITING_FORMAT' | 'READY';

export interface P9Card {
  year: number;
  status: P9State;
  availableFrom: string | null;
}

export interface HistoryData {
  years: number[];
  items: PayslipListItem[];
  p9: P9Card | null;
  legacy: LegacyState;
}

export interface LineView {
  key: string;
  label: string;
  amount: string;
  working: string | null;
  correctedFrom: string | null;
}

export interface Section {
  earnings: LineView[];
  gross: string;
  deductions: LineView[];
  totalDeductions: string;
  net: string;
}

export interface VersionInfo {
  versionNumber: number;
  createdAt: string;
  replacedAt: string | null;
  current: boolean;
}

export interface PayslipDetail {
  id: string;
  number: string | null;
  month: string;
  versionNumber: number;
  correctedAt: string | null;
  replacedBy: { versionNumber: number; correctedAt: string } | null;
  employeeSummary: { role: string | null; site: string };
  payDay: string | null;
  paidOn: string | null;
  status: PayslipStatus;
  thisMonth: Section;
  ytd: Section & { fromMonth: string; toMonth: string };
  bank: Bank | null;
  hrContact: { phone: string; hoursText: string } | null;
  versions: VersionInfo[];
  document: { available: true; path: string };
}

export type OpenPurpose = 'view' | 'download' | 'share';

/** A downloaded file kept in memory. */
export interface FileBlob {
  blob: Blob;
  filename: string;
}
