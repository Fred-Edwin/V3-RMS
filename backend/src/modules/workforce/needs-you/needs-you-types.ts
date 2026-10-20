import type { AccessSubject } from '../_shared/workforce-access';

/** The menu links that carry a number (6b N3). One server call feeds every badge and the card. */
export const BADGE_KEYS = ['workforce-timesheets', 'workforce-leave', 'workforce-conduct', 'workforce-payroll', 'workforce-security'] as const;
export type BadgeKey = (typeof BADGE_KEYS)[number];

export type BadgeCounts = Record<BadgeKey, number>;
export const emptyBadges = (): BadgeCounts => ({ 'workforce-timesheets': 0, 'workforce-leave': 0, 'workforce-conduct': 0, 'workforce-payroll': 0, 'workforce-security': 0 });

/** What a source needs to know about the moment: the company and the sites whose new clock is on (legacy sites make no rows, SD1). */
export interface NeedsYouContext {
  companyId: string;
  now: Date;
  /** Sites with the attendance switch on. A source never produces a row for any other site. */
  enabledSiteIds: readonly string[];
}

/**
 * One line of the Needs you card. `text` is final wording: names come with a role, and it never holds a pay figure ("86 people").
 * `since` is when the item began to wait. `id` is `<kind>:<record id>` and stays stable while the item waits.
 */
export interface NeedsYouRow {
  id: string;
  kind: string;
  text: string;
  opens: string;
  badge: BadgeKey | null;
  since: string;
  siteId: string | null;
  siteName: string | null;
  waitingOnRole: string;
  personUserId: string | null;
  canRemind: boolean;
}

/**
 * A place a module that owns something that waits for a person plugs into the card (6b N5). Leave and Conduct register theirs with
 * `registerNeedsYouSource`; no file in this module changes. A source reads its OWN table, filters by the action capability and
 * scope of the viewer (never a role name), and skips sites that are not in `ctx.enabledSiteIds`.
 */
export interface NeedsYouSource {
  /** Unique. Registering the same id again replaces the earlier registration. */
  id: string;
  /** The `kind` strings its rows carry, in the order they sort when two rows began to wait at the same moment. */
  kinds: readonly string[];
  list(subject: AccessSubject, ctx: NeedsYouContext): Promise<NeedsYouRow[]>;
  /** Badge counts. Omit it and the counts are tallied from `list`, so a badge can never disagree with the card. */
  count?(subject: AccessSubject, ctx: NeedsYouContext): Promise<Partial<BadgeCounts>>;
  /** Items past 3 days anywhere in the company, for the Director's Overdue card. Rows carry `canRemind`. */
  overdue?(ctx: NeedsYouContext): Promise<NeedsYouRow[]>;
  /** Who a reminder for one of this source's rows goes to. Omit it and the site's Branch Managers are told. */
  remindees?(row: NeedsYouRow, ctx: NeedsYouContext): Promise<string[]>;
  /** The deciding module owns the 30 second Undo window; this hook is how the card asks it to take a decision back. */
  undo?(subject: AccessSubject, rowId: string): Promise<void>;
}
