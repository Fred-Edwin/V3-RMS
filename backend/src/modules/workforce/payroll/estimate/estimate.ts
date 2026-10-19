import { formatCents, parseCents, parseScaled, roundDiv, type Cents } from '../engine/money';

export interface EstimatePerson {
  employeeId: string;
  siteId: string;
  payType: 'MONTHLY_SALARY' | 'DAILY_RATE';
  /** Days employed in the whole month at each amount (a joiner, a leaver or a pay change splits it). */
  monthSegments: { amount: string; days: number }[];
  /** The same, counting only the 1st to yesterday. */
  toDateSegments: { amount: string; days: number }[];
  amountInForce: string | null;
  standardWeekHours: string | null;
  overtimeEligible: boolean;
  authorisedOvertimeMinutes: number; // decided so far, this month
  undecidedOvertimeMinutes: number; // still to decide: shown in the callout, never in a total
  absentDaysToDate: number;
}

export interface EstimateInput {
  daysInMonth: number;
  daysElapsed: number; // the 1st to yesterday, 0 on the 1st
  unpaidDayDivisor: number;
  ordinaryMultiplier: string | null;
  people: EstimatePerson[];
  lastMonthGross: ReadonlyMap<string, string>; // siteId to last month's calculated gross; absent when the site was not on the new system
}

export interface SiteEstimate {
  siteId: string;
  people: number;
  earned: string;
  expected: string;
  vsLast: string | null;
}

export interface Estimate {
  expectedGross: string;
  earnedSoFar: string;
  vsLastMonth: { amount: string; percent: string } | null;
  bySite: SiteEstimate[];
  toDecideOvertime: { minutes: number; value: string };
  missingProfiles: number;
  notEstimated: number; // daily-rate people: their pay depends on days worked, which an open month does not know
}

const prorate = (segments: readonly { amount: string; days: number }[], daysInMonth: number): Cents =>
  roundDiv(segments.reduce((total, s) => total + parseCents(s.amount) * BigInt(s.days), 0n), BigInt(daysInMonth));

/** Cents for `minutes` of overtime at the ordinary multiplier: amount ÷ (week hours × 52 ÷ 12). Zero when the hours are not on the profile. */
function overtimeValue(person: EstimatePerson, minutes: number, multiplier: string | null): Cents {
  if (!person.overtimeEligible || minutes <= 0 || person.amountInForce === null || person.standardWeekHours === null) return 0n;
  const weekHundredths = parseScaled(person.standardWeekHours, 2);
  if (weekHundredths <= 0n) return 0n;
  const scaled = parseScaled(multiplier ?? '1', 4);
  return roundDiv(BigInt(minutes) * parseCents(person.amountInForce) * 12n * 100n * scaled, 60n * weekHundredths * 52n * 10_000n);
}

/** Tenths of a percent as text, keeping the sign of a change between -1% and 0%. */
function tenths(value: bigint | null): string {
  if (value === null) return '0.0';
  const size = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${size / 10n}.${size % 10n}`;
}

/**
 * P28 and E7: pay earned so far and expected for the whole month, from profiles, employment dates and authorised overtime only.
 * Gross, no statutory lines, nothing from approved timesheets. Pure: the caller supplies the day and the people.
 */
export function estimateMonth(input: EstimateInput): Estimate {
  const sites = new Map<string, { people: number; earned: Cents; expected: Cents }>();
  let missingProfiles = 0;
  let notEstimated = 0;
  let undecidedMinutes = 0;
  let undecidedValue = 0n;
  for (const person of input.people) {
    const site = sites.get(person.siteId) ?? { people: 0, earned: 0n, expected: 0n };
    sites.set(person.siteId, site);
    if (person.amountInForce === null || person.monthSegments.length === 0) {
      missingProfiles += 1;
      continue;
    }
    if (person.payType === 'DAILY_RATE') {
      notEstimated += 1;
      continue;
    }
    const absence = roundDiv(parseCents(person.amountInForce) * BigInt(person.absentDaysToDate), BigInt(input.unpaidDayDivisor));
    const overtime = overtimeValue(person, person.authorisedOvertimeMinutes, input.ordinaryMultiplier);
    const overtimeForMonth = input.daysElapsed > 0 ? roundDiv(overtime * BigInt(input.daysInMonth), BigInt(input.daysElapsed)) : 0n;
    site.people += 1;
    site.earned += prorate(person.toDateSegments, input.daysInMonth) + overtime - absence;
    site.expected += prorate(person.monthSegments, input.daysInMonth) + overtimeForMonth - absence;
    undecidedMinutes += person.undecidedOvertimeMinutes;
    undecidedValue += overtimeValue(person, person.undecidedOvertimeMinutes, input.ordinaryMultiplier);
  }

  const bySite: SiteEstimate[] = [...sites].map(([siteId, s]) => {
    const last = input.lastMonthGross.get(siteId);
    return { siteId, people: s.people, earned: formatCents(s.earned), expected: formatCents(s.expected), vsLast: last === undefined ? null : formatCents(s.expected - parseCents(last)) };
  });
  const sum = (pick: (s: SiteEstimate) => string): Cents => bySite.reduce((total, s) => total + parseCents(pick(s)), 0n);
  const expected = sum((s) => s.expected);
  const lastTotal = [...sites.keys()].reduce((total, id) => total + (input.lastMonthGross.has(id) ? parseCents(input.lastMonthGross.get(id) ?? '0') : 0n), 0n);
  const comparable = [...sites.keys()].filter((id) => input.lastMonthGross.has(id));
  const expectedComparable = bySite.filter((s) => comparable.includes(s.siteId)).reduce((total, s) => total + parseCents(s.expected), 0n);
  const percent = lastTotal > 0n ? roundDiv((expectedComparable - lastTotal) * 1000n, lastTotal) : null; // tenths of a percent
  return {
    expectedGross: formatCents(expected),
    earnedSoFar: formatCents(sum((s) => s.earned)),
    vsLastMonth: comparable.length === 0 ? null : { amount: formatCents(expectedComparable - lastTotal), percent: tenths(percent) },
    bySite,
    toDecideOvertime: { minutes: undecidedMinutes, value: formatCents(undecidedValue) },
    missingProfiles,
    notEstimated,
  };
}
