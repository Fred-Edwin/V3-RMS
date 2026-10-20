/** The menu links that carry a number (API_CONTRACT §43). The server's names; nav-table.ts uses the same ones. */
export type NeedsYouBadgeKey = 'workforce-timesheets' | 'workforce-leave' | 'workforce-conduct' | 'workforce-payroll' | 'workforce-security';

export type NeedsYouBadges = Record<NeedsYouBadgeKey, number>;

export interface NeedsYouCounts {
  total: number;
  badges: NeedsYouBadges;
  /** A source failed: the numbers are the ones that could be counted, never a guess. */
  partial: boolean;
}

/** One line of the card. `text` is final server wording: names with a role, never a pay figure. */
export interface NeedsYouRow {
  /** `<kind>:<record id>` */
  id: string;
  kind: string;
  text: string;
  /** Where the decision is made (an app path, may carry a query). */
  opens: string;
  badge: NeedsYouBadgeKey | null;
  /** ISO time the item began to wait. */
  since: string;
  siteId: string | null;
  siteName: string | null;
  waitingOnRole: string;
  personUserId: string | null;
  canRemind: boolean;
  /** New since the last time this person opened Home. */
  isNew: boolean;
}

export interface NeedsYouList {
  rows: NeedsYouRow[];
  total: number;
  partial: boolean;
}

export interface OverdueRow {
  id: string;
  kind: string;
  text: string;
  waitingOn: { role: string; siteName: string | null };
  since: string;
  waitingDays: number;
  canRemind: boolean;
  remindedToday: boolean;
}

export interface OverdueList {
  rows: OverdueRow[];
  total: number;
}

/** HR's housekeeping rows (finish hiring, probation ends, no head). Kept on their own card: nobody is waiting on these. */
export interface AttentionResponse {
  rows: Array<Record<string, unknown>>;
  total: number;
}
