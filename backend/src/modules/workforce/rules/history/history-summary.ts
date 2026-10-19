import type { RuleGroupCode } from '../rules-schemas';
import { policyOf, same, type Values } from '../rules-values';

/** The "What changed" line of the history table, in plain words. Figures of pay fields are left out unless the viewer may see pay. */

const LABELS: Record<string, string> = {
  graceMinutes: 'Grace period',
  policy: 'What happens after the grace period',
  afterLatesPerMonth: 'Late days before a deduction',
  makeUpSameDay: 'Make up the time the same day',
  excuseWindowHours: 'Time to excuse a late arrival',
  deductionCapPercentOfPay: 'Deduction cap',
  serviceTailMinutes: 'Service tail',
  weeklyCapMinutes: 'Weekly cap for one person',
  branchBudgetMinutesPerPeriod: 'Branch budget for a month',
  approvalWindowHours: 'Time to authorise',
  multipliers: 'Pay multiplier',
  clockInOpensMinutesBefore: 'Clock-in opens before the shift',
  autoCloseAfterMinutes: 'Shift closes by itself',
  locationRadiusMetres: 'How close to the site',
  undoWindowSeconds: 'Undo a clock tap',
  clockSkewFlagMinutes: 'Phone clock out by more than',
  shiftEndHeadsUpMinutes: 'Shift-end heads-up',
  shiftEndPromptRepeatMinutes: 'Shift-end prompt repeat',
  leaveTypes: 'Leave types',
  defaultPolicy: 'Default leave policy',
  minimumCover: 'Minimum cover',
  defaultMonths: 'Default probation',
  maxExtensions: 'Probation extensions',
  maxExtensionMonths: 'Longest extension',
  reminderDaysBeforeEnd: 'Reminder to HR before probation ends',
  reportDays: 'Reports before the decision',
  defaultDailyRate: 'Default daily rate',
  rates: 'Casual daily rates',
  pettyCashHolder: 'Who holds the petty cash',
  levels: 'How long a notice stays',
  acknowledgeWithinDays: 'Time to sign that it was received',
  appealWithinDays: 'Time to appeal',
  tables: 'Statutory rates',
  holidays: 'Public holidays',
  payMultiplier: 'Pay for hours worked on a holiday',
  weekStartsOn: 'The week starts on',
};

const UNITS: Record<string, string> = {
  graceMinutes: 'min',
  serviceTailMinutes: 'min',
  clockInOpensMinutesBefore: 'min',
  autoCloseAfterMinutes: 'min',
  clockSkewFlagMinutes: 'min',
  shiftEndHeadsUpMinutes: 'min',
  shiftEndPromptRepeatMinutes: 'min',
  locationRadiusMetres: 'm',
  undoWindowSeconds: 's',
  deductionCapPercentOfPay: '%',
  defaultMonths: 'months',
  maxExtensionMonths: 'months',
  reminderDaysBeforeEnd: 'days',
  acknowledgeWithinDays: 'days',
  appealWithinDays: 'days',
  afterLatesPerMonth: 'late days',
};
const POLICY_WORDS: Record<string, string> = { RECORD_ONLY: 'record only', AFTER_N_LATES: 'deduct after a number of late days', FROM_FIRST_MINUTE: 'deduct from the first minute' };
const WEEKDAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const hoursAsDays = (hours: number): string => (hours % 24 === 0 ? `${hours / 24} days` : `${hours} h`);

const word = (field: string, value: unknown): string | null => {
  if (value === null || value === undefined) return field === 'weeklyCapMinutes' || field === 'deductionCapPercentOfPay' ? 'no cap' : 'none';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (field === 'policy' && typeof value === 'string') return POLICY_WORDS[value] ?? value;
  if (field === 'weekStartsOn' && typeof value === 'number') return WEEKDAYS[value] ?? String(value);
  if (field === 'excuseWindowHours' || field === 'approvalWindowHours') return typeof value === 'number' ? hoursAsDays(value) : null;
  if (field === 'weeklyCapMinutes' || field === 'branchBudgetMinutesPerPeriod') return typeof value === 'number' ? `${value / 60} h` : null;
  if (field === 'multipliers' && typeof value === 'object') {
    const m = value as { ordinaryDay: string | null; restDay: string | null };
    return `${m.ordinaryDay ?? '-'} × ordinary day, ${m.restDay ?? '-'} × rest day`;
  }
  if (field === 'payMultiplier') return `${String(value)} ×`;
  if (typeof value === 'number' || typeof value === 'string') return `${value}${UNITS[field] ? ` ${UNITS[field]}` : ''}`;
  return null; // a list or a table: described by `listChange`
};

interface Table {
  code: string;
  name: string;
  bands: { ratePercent: string | null; flatAmount: string | null }[];
}

/** "NSSF 6% (was 5%)" for a table with one rate; otherwise just that the table changed. */
const tablesChange = (before: Table[], after: Table[], figures: boolean): string => {
  const parts: string[] = [];
  for (const table of after) {
    const old = before.find((t) => t.code === table.code && t.name === table.name);
    if (old && same(old, table)) continue;
    const rate = (t: Table | undefined): string | null => (t?.bands.length === 1 ? (t.bands[0]?.ratePercent ?? t.bands[0]?.flatAmount ?? null) : null);
    const now = rate(table);
    const was = rate(old);
    parts.push(figures && now !== null ? `${table.name} ${now}%${was !== null ? ` (was ${was}%)` : ' (new)'}` : `${table.name} changed`);
  }
  for (const table of before) if (!after.some((t) => t.code === table.code && t.name === table.name)) parts.push(`${table.name} removed`);
  return parts.join(', ') || 'Statutory rates changed';
};

const holidaysChange = (before: { date: string; name: string }[], after: { date: string; name: string }[]): string => {
  const added = after.filter((h) => !before.some((b) => b.date === h.date)).length;
  const removed = before.filter((b) => !after.some((h) => h.date === b.date)).length;
  const renamed = after.filter((h) => before.some((b) => b.date === h.date && b.name !== h.name)).length;
  const parts = [added ? `${added} added` : '', removed ? `${removed} removed` : '', renamed ? `${renamed} renamed` : ''].filter(Boolean);
  return `Public holidays: ${parts.join(', ') || 'changed'}`;
};

export const summariseChange = (group: RuleGroupCode, changed: string[], before: Values, after: Values, mayReadPay: boolean): string => {
  const policy = policyOf(group);
  const lines = changed.map((field) => {
    const label = LABELS[field] ?? field;
    const hidden = policy[field]?.pay === true && !mayReadPay;
    if (field === 'tables') return tablesChange((before[field] as Table[]) ?? [], (after[field] as Table[]) ?? [], !hidden);
    if (hidden) return `${label} changed`;
    if (field === 'holidays') return holidaysChange((before[field] as { date: string; name: string }[]) ?? [], (after[field] as { date: string; name: string }[]) ?? []);
    const was = word(field, before[field]);
    const now = word(field, after[field]);
    return was !== null && now !== null ? `${label} ${was} → ${now}` : `${label} changed`;
  });
  return lines.join('; ');
};
