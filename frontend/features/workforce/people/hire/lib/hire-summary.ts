import { formatKes, formatWeekdayDayMonth } from '../../_shared/lib/people-dates';
import type { Lookups } from '../../_shared/types/people-types';
import { tracksTimeOf } from './hire-choices';
import { isCasual, type HireState } from './hire-model';

/** The three lines of the Login step's summary box (Paper `S3F-0`), from the form and the server's lists. */
export interface LoginSummary {
  job: string;
  starts: string;
  employment: string;
  flag: string;
  time: string;
}

export function loginSummary(state: HireState, lookups: Lookups, headName: string | null): LoginSummary {
  const position = lookups.positions.find((p) => p.id === state.positionId)?.name ?? '';
  const site = lookups.organizations.find((s) => s.id === state.siteId)?.name ?? '';
  const department = lookups.departments.find((d) => d.id === state.departmentId)?.name ?? '';
  const withContract = state.employment === 'MONTHLY_WITH_CONTRACT';
  const missing = [state.nssfNumber.trim() === '' ? 'NSSF' : null, state.shaNumber.trim() === '' ? 'SHA' : null].filter(Boolean).join(' and ');
  return {
    job: `${position} · ${site} · ${department} team`,
    starts: `Starts ${formatWeekdayDayMonth(state.startDate)}`,
    employment: isCasual(state) ? 'Casual, daily' : withContract ? 'Monthly, with contract' : 'Monthly, no contract yet',
    flag: withContract ? formatKes(state.amount) : 'Default leave policy',
    time: `${tracksTimeOf(state, lookups) ? 'Tracks time' : 'Does not clock in'}${headName ? ` · reports to ${headName}` : ''}${missing ? ` · ${missing} missing` : ''}`,
  };
}
