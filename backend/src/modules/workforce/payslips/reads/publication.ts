import type { NairobiDate } from '../../_shared/time/nairobi-time';

/**
 * ASSUMPTION ABOUT PAYROLL PART 2 (lane 1), the one seam between this segment and it.
 *
 * Part 2 publishes a month, sets its pay day and marks it Paid. Until it is merged this segment cannot read those facts, so it asks this
 * hook. The default answers from what part 1 stores: a payslip is visible to staff once its month state is PUBLISHED or later (the
 * state is compared as text, because part 1's enum does not hold those values yet); a month has no pay day and no paid date until part
 * 2 supplies them. When part 2 lands it registers a source that reads its own columns (or the default simply starts to work once
 * its `PUBLISHED` and `PAID` states exist, with `payDay` and `paidOn` coming from its fields) and nothing else here changes.
 * Tests register a fixture source to mark a month published.
 */
export interface MonthPublication {
  published: boolean;
  paid: boolean;
  payDay: NairobiDate | null;
  paidOn: NairobiDate | null;
}

export interface MonthFacts {
  id: string;
  monthKey: string;
  state: string;
}

export type PublicationSource = (months: readonly MonthFacts[]) => Promise<Map<string, MonthPublication>>;

const VISIBLE_STATES = new Set(['PUBLISHED', 'PAID']);

const fromState: PublicationSource = async (months) =>
  new Map(months.map((m) => [m.id, { published: VISIBLE_STATES.has(m.state), paid: m.state === 'PAID', payDay: null, paidOn: null }]));

let source: PublicationSource = fromState;

export const setPublicationSource = (next: PublicationSource | null): void => {
  source = next ?? fromState;
};

export const publicationOf = (months: readonly MonthFacts[]): Promise<Map<string, MonthPublication>> => source(months);
