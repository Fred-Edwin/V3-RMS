import type { CasualSheetStatus } from '@prisma/client';
import type { NairobiDate } from '../_shared/time/nairobi-time';

/** What the screens read. Money is a string with two decimals; times are 'HH:MM' with `endsNextDay` for the "+1". */
export interface LineView {
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

export interface CorrectionView {
  id: string;
  casualId: string;
  name: string;
  originalDate: string;
  amount: string;
  reason: string;
}

export interface SheetView {
  id: string | null;
  number: string | null; // 'CPS-0318' once approved
  date: NairobiDate;
  siteId: string;
  siteName: string;
  departmentId: string;
  departmentName: string;
  status: CasualSheetStatus | 'NONE';
  version: number;
  rate: string | null;
  rateVersion: number | null;
  noRate: boolean;
  lines: LineView[];
  corrections: CorrectionView[];
  total: string;
  sentBackReason: string | null;
  recordedBy: { id: string; name: string; role: string } | null;
  approvedBy: { id: string; name: string; role: string } | null;
  approvedAt: string | null;
  cashHolder: { id: string; name: string } | null;
  voidReason: string | null;
  waitingForCash: number;
}

export interface WorkerView {
  id: string;
  fullName: string;
  idMasked: string;
  phone: string | null;
  lastWorked: string | null;
}

/** The frozen sheet at approval (PD16). The receipts are not in it: they grow the printed sheet afterwards. */
export interface SheetSnapshot {
  version: 1;
  number: string;
  date: string;
  site: { id: string; name: string };
  department: { id: string; name: string };
  rate: string;
  rateVersion: number;
  recordedBy: { id: string; name: string; role: string };
  approvedBy: { id: string; name: string; role: string; signedAt: string };
  cashHolder: { id: string; name: string };
  lines: { lineId: string; casualId: string; name: string; idMasked: string; startMinute: number; endMinute: number; minutes: number; amount: string }[];
  corrections: { id: string; casualId: string; name: string; originalDate: string; amount: string; reason: string }[];
  total: string;
}
