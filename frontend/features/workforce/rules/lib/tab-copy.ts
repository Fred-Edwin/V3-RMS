import type { RuleGroupCode, RulesPage } from '../types/rules-types';
import { shortDay } from './rules-words';

/** The fixed clause after the version in each tab's grey line (Spec sections 4 to 13). Leave has its own sentence. */
const CLAUSE: Record<RuleGroupCode, string> = {
  LATENESS: 'applies to every site unless a Branch Manager sets their own',
  OVERTIME: 'overtime is paid only when a manager authorises it',
  ATTENDANCE: 'how the clock works on staff phones',
  LEAVE: '',
  PROBATION: 'the Director sets the default, HR decides each person',
  CASUAL_WORK: 'casuals have no login and are paid each day',
  CONDUCT: 'the ladder, the names and the letters are fixed; durations are set here',
  STATUTORY: 'set and confirmed by the Accountant',
  HOLIDAYS: 'Wendo is open every day of the year, so a holiday only changes pay',
  WEEK_AND_BREAKS: 'two settings every rota and timesheet share',
};

const LEAVE_LINE = 'Every change makes a new version from the date you choose. Past leave is never re-counted, and the change is in the audit log.';

/** "Company rule · version 4, in force since 1 August 2026 · <clause>". A default reads "Starting values, nothing set yet". */
export function greyLine(page: RulesPage): string {
  if (page.group === 'LEAVE') return LEAVE_LINE;
  const scope = page.organizationName ?? 'Company rule';
  const version = page.organizationId && page.siteVersion ? page.siteVersion : page.version;
  const since = page.isDefault && !page.organizationId ? 'Starting values, nothing set yet' : page.effectiveFrom ? `version ${version}, in force since ${shortDay(page.effectiveFrom)}` : `version ${version}`;
  const head = page.isDefault && !page.organizationId ? `${scope} · version 0 · ${since}` : `${scope} · ${since}`;
  // Paper writes the Lateness line clause first: "Applies to every site unless a Branch Manager sets their own · version 2, ..."
  if (page.group === 'LATENESS' && !page.organizationId) return `Applies to every site unless a Branch Manager sets their own · ${head.replace('Company rule · ', '')}`;
  return `${head} · ${CLAUSE[page.group]}`;
}
