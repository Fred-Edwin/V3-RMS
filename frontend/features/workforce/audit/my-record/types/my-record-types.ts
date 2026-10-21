/** The answers of `GET /workforce/audit/me*` (API_CONTRACT §46). */

export type RecordChip = 'all' | 'pay' | 'time' | 'leave' | 'signins' | 'file' | 'conduct';
export type RecordAnswer = 'ME' | 'NOT_ME';

export interface RecordItem {
  id: string;
  occurredAt: string;
  title: string;
  line: string;
  event: Exclude<RecordChip, 'all'>;
  flagged: boolean;
  needsAnswer: boolean;
  answered?: RecordAnswer;
}

export interface RecordPage {
  total: number;
  page: number;
  pageSize: number;
  range: { from: string; to: string };
  items: RecordItem[];
}

export interface RecordCard {
  id: string;
  title: string;
  flagged: boolean;
  rows: { label: string; value: string }[];
  needsAnswer: boolean;
  answered?: RecordAnswer;
  note: string | null;
}

export interface AnswerResult {
  answered: RecordAnswer;
  alreadyAnswered: boolean;
  signedOut: boolean;
}

export interface RecordQuery {
  event: RecordChip;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}
