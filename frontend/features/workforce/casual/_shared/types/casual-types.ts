/** What `/workforce/casuals` returns (API_CONTRACT §42). Money is a string with two decimals; days are 'YYYY-MM-DD'; times are 'HH:MM'. */
export type SheetStatus = 'NONE' | 'DRAFT' | 'SENT' | 'SENT_BACK' | 'APPROVED' | 'VOID';

export interface SheetLine {
  id: string;
  casualId: string;
  name: string;
  idMasked: string;
  start: string;
  end: string;
  endsNextDay: boolean;
  minutes: number;
  amount: string;
  working: string;
  receivedAt: string | null;
  receivedName: string | null;
}

export interface CorrectionLine {
  id: string;
  casualId: string;
  name: string;
  originalDate: string;
  amount: string;
  reason: string;
}

export interface Signer {
  id: string;
  name: string;
  role: string;
}

export interface Sheet {
  id: string | null;
  number: string | null;
  date: string;
  siteId: string;
  siteName: string;
  departmentId: string;
  departmentName: string;
  status: SheetStatus;
  version: number;
  rate: string | null;
  rateVersion: number | null;
  noRate: boolean;
  lines: SheetLine[];
  corrections: CorrectionLine[];
  total: string;
  sentBackReason: string | null;
  recordedBy: Signer | null;
  approvedBy: Signer | null;
  approvedAt: string | null;
  cashHolder: { id: string; name: string } | null;
  voidReason: string | null;
  waitingForCash: number;
}

export interface Worker {
  id: string;
  fullName: string;
  idMasked: string;
  phone: string | null;
  lastWorked: string | null;
}

export interface SheetCard {
  id: string;
  number: string | null;
  date: string;
  siteName: string;
  departmentName: string;
  status: string;
  workers: number;
  total: string;
  unsigned: number;
  sentAt: string | null;
}

export interface Waiting {
  toApprove: SheetCard[];
  unsigned: SheetCard[];
}

/** One line as the phone holds it while recording (also what is saved on the phone with no signal). */
export interface DraftLine {
  casualId: string;
  name: string;
  idMasked: string;
  start: string;
  end: string;
  endsNextDay: boolean;
}

export interface PutLinesBody {
  siteId: string;
  departmentId: string;
  date: string;
  version: number;
  idempotencyKey: string;
  lines: { casualId: string; start: string; end: string; endsNextDay?: boolean }[];
}

export interface NewCasualBody {
  fullName: string;
  nationalId: string;
  nationalIdConfirm: string;
  phone?: string;
  idempotencyKey: string;
}

export interface FileBlob {
  blob: Blob;
  filename: string;
}
