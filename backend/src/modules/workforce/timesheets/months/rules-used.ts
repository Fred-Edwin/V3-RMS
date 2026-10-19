import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { getEffectiveRuleGroup } from '../../rules/rules-service';

export interface RuleUsed {
  key: 'LATENESS' | 'OVERTIME';
  version: number;
  siteVersion: number | null;
  effectiveFrom: NairobiDate | null;
  /** The few values the PDF's rules box prints (hours and minutes, never money). */
  facts: Record<string, string | number | boolean | null>;
}

/** The Rules versions in force on the month's last day, for the page and the "rules used" box of the PDF. */
export async function rulesUsedFor(siteId: string, on: NairobiDate): Promise<RuleUsed[]> {
  const [lateness, overtime] = await Promise.all([getEffectiveRuleGroup(siteId, on, 'LATENESS'), getEffectiveRuleGroup(siteId, on, 'OVERTIME')]);
  return [
    {
      key: 'LATENESS',
      version: lateness.companyVersion,
      siteVersion: lateness.siteVersion,
      effectiveFrom: lateness.effectiveFrom,
      facts: { graceMinutes: lateness.values.graceMinutes, policy: lateness.values.policy, afterLatesPerMonth: lateness.values.afterLatesPerMonth },
    },
    {
      key: 'OVERTIME',
      version: overtime.companyVersion,
      siteVersion: overtime.siteVersion,
      effectiveFrom: overtime.effectiveFrom,
      facts: { serviceTailMinutes: overtime.values.serviceTailMinutes, weeklyCapMinutes: overtime.values.weeklyCapMinutes },
    },
  ];
}
