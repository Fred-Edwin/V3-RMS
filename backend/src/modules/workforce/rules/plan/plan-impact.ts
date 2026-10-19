import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { RuleGroupCode } from '../rules-schemas';
import { asValues, type Values } from '../rules-values';
import type { ImpactRow } from './plan.types';

/**
 * The "what it would change" rows of the Change dialog (D12). Only statements the server can stand behind: facts about how
 * a change takes effect. A row that needs a count from another module (late marks, requests waiting, people on probation) is
 * left out until that module can answer, never made up. At most three rows; "Becomes: Version N, from <day>" is added by the caller.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (date: NairobiDate): string => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`;

const levelsOf = (values: Values): { level: string; validForMonths: number }[] => (Array.isArray(values.levels) ? (values.levels as { level: string; validForMonths: number }[]) : []);

const conductRows = (before: Values, after: Values, from: NairobiDate): ImpactRow[] => {
  const changed = levelsOf(after).filter((level) => levelsOf(before).find((old) => old.level === level.level)?.validForMonths !== level.validForMonths);
  const rows: ImpactRow[] = [{ label: 'Notices already issued', value: 'Keep their old end date' }];
  if (changed.length === 1 && changed[0]) rows.push({ label: `Notices issued from ${shortDate(from)}`, value: `End after ${changed[0].validForMonths} months` });
  return rows;
};

const specific = (group: RuleGroupCode, changed: string[], before: Values, after: Values, from: NairobiDate): ImpactRow[] => {
  switch (group) {
    case 'CONDUCT':
      return changed.includes('levels') ? conductRows(before, after, from) : [];
    case 'LEAVE':
      if (changed.includes('minimumCover')) return [{ label: 'Leave already approved', value: 'Stays as it is' }];
      return [{ label: 'Leave already taken or booked', value: 'Not changed' }];
    case 'WEEK_AND_BREAKS':
      return [{ label: 'Published rotas', value: 'Do not change' }];
    case 'PROBATION':
      return [{ label: 'Probation already running', value: 'Keeps its end date' }];
    case 'ATTENDANCE':
      return [{ label: 'Shifts open at midnight', value: 'Finish under the old rule' }];
    default:
      return [];
  }
};

export const impactRows = (group: RuleGroupCode, changed: string[], before: Values, after: Values, from: NairobiDate): ImpactRow[] => {
  const rows = specific(group, changed, asValues(before), asValues(after), from);
  // An approved month never changes (D11): approval freezes the month's rule values, so this holds for every tab.
  return [...rows.slice(0, 2), { label: 'Months already approved', value: 'Not changed' }];
};
