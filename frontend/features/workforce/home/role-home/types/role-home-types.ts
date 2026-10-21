/** The server's Home answer, `GET /workforce/home` (API_CONTRACT, Workforce Home). Wording is final server wording. */

export type HomeAudience = 'HR' | 'DIRECTOR' | 'ACCOUNTANT' | 'BRANCH_MANAGER' | 'STORE_MANAGER' | 'HEAD' | 'STAFF' | 'SYSTEM_ADMIN';

export interface HomeKpi {
  key: string;
  label: string;
  value: string;
  detail: string;
  /** `attention` is the amber number (something to act on); `problem` the red-brown one (overdue, late, security). */
  tone: 'normal' | 'attention' | 'problem';
  href: string | null;
}

/** One row of the Home table: one kind of thing, with a count. */
export interface HomeSummaryRow {
  key: string;
  /** "Pay changes · 2" */
  kindLabel: string;
  count: number;
  title: string;
  line: string;
  /** The button: "Decide", "Review", "Assign heads". */
  action: string;
  opens: string;
  /** The oldest item's time. */
  since: string;
  overdue: boolean;
}

export interface HomeNeedsYou {
  total: number;
  overdue: number;
  kinds: number;
  rows: HomeSummaryRow[];
}

export interface HomeLatest {
  id: string;
  title: string;
  body: string;
  tone: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface HomeView {
  audience: HomeAudience;
  kpis: HomeKpi[];
  /** null when the person holds no Needs you capability. */
  needsYou: HomeNeedsYou | null;
  latest: HomeLatest[];
  unread: number;
}

/** One row of the See all list, one item each. */
export interface NeedsYouPageRow {
  id: string;
  kind: string;
  kindLabel: string;
  text: string;
  line: string;
  action: string;
  opens: string;
  since: string;
  siteId: string | null;
  siteName: string | null;
  overdue: boolean;
}

export interface NeedsYouPage {
  rows: NeedsYouPageRow[];
  total: number;
  all: number;
  overdue: number;
  groups: Array<{ key: string; label: string; count: number }>;
  sites: Array<{ id: string; name: string }>;
  page: number;
  pageSize: number;
  partial: boolean;
}

export interface NeedsYouPageQuery {
  q: string;
  group: string;
  siteId: string;
  page: number;
  pageSize: number;
}
