import { describeEntry } from '../../_shared/audit/audit-describe';
import type { AuditCategoryCode, JsonValue } from '../../_shared/audit/audit.types';
import { monthName, roleLabel } from '../../notifications';
import { asJson, type StoredEntry } from '../audit-rows';

/** The chips of A8, plus the categories each one holds. `all` is every category except LOG_ACCESS (nobody reads the watching of the log). */
export const RECORD_CHIPS = ['all', 'pay', 'time', 'leave', 'signins', 'file', 'conduct'] as const;
export type RecordChip = (typeof RECORD_CHIPS)[number];

const CHIP_CATEGORIES: Record<Exclude<RecordChip, 'all'>, readonly AuditCategoryCode[]> = {
  pay: ['PAY_SETUP', 'PAY_RUN_PREPARE', 'PAY_RUN_DECIDE', 'PAYSLIP_ACCESS', 'DOCUMENTS'],
  time: ['TIME'],
  leave: ['LEAVE'],
  signins: ['SECURITY'],
  file: ['PEOPLE', 'SENSITIVE_VIEW'],
  conduct: ['DISCIPLINE'],
};
const ALL_BUT_LOG: readonly AuditCategoryCode[] = Object.values(CHIP_CATEGORIES).flat();

export const categoriesOfChip = (chip: RecordChip): readonly AuditCategoryCode[] => (chip === 'all' ? ALL_BUT_LOG : CHIP_CATEGORIES[chip]);

export const chipOfCategory = (category: AuditCategoryCode): Exclude<RecordChip, 'all'> => {
  const found = (Object.keys(CHIP_CATEGORIES) as Exclude<RecordChip, 'all'>[]).find((chip) => CHIP_CATEGORIES[chip].includes(category));
  if (!found) throw new Error(`Audit category ${category} is not shown in Activity on my record`);
  return found;
};

/** The System Admin's copy of an unconfirmed-phone opening is not the person's own entry; the opening itself is. */
export const HIDDEN_FROM_MY_RECORD = ['security.payslip_unconfirmed_phone'] as const;

/** Entries a person can answer "That was me" or "This wasn't me" to (A8): an opening on an unconfirmed phone, a new phone. */
export function needsAnswer(entry: Pick<StoredEntry, 'action'> & { after: unknown }): boolean {
  const after = asJson(entry.after);
  const rec = after !== null && typeof after === 'object' && !Array.isArray(after) ? after : {};
  if (entry.action === 'security.phone_first_seen') return true;
  return entry.action === 'payslip.opened' && rec.unconfirmed === true;
}

const rec = (v: JsonValue | null): { [key: string]: JsonValue } => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});
const by = (e: StoredEntry): string => (e.channel === 'SYSTEM' || !e.actorId ? 'The system' : `${e.actorName}, ${roleLabel(e.actorRole)}`);

export interface PersonWording {
  title: string;
  line: string;
  flagged: boolean;
  needsAnswer: boolean;
}

/** Plain sentences for the person the entry is about. Never a pay figure, a code or a PIN: it reads only the entry's own wording and a few safe keys. */
export function wordForPerson(entry: StoredEntry, viewerId: string): PersonWording {
  const category = entry.category as AuditCategoryCode;
  const base = describeEntry({ action: entry.action, category, reason: entry.reason, before: asJson(entry.before), after: asJson(entry.after) });
  const after = rec(asJson(entry.after));
  const answerable = needsAnswer(entry);
  let title = base.title;
  if (entry.action === 'payslip.opened') {
    const month = typeof after.month === 'string' ? monthName(after.month) : '';
    const opener = entry.actorId === viewerId ? '' : ` by ${by(entry)}`;
    title = after.unconfirmed === true ? 'Payslip opened on a phone you have not confirmed' : `Payslip ${month}`.trim() + ` opened${opener}`;
  } else if (entry.action === 'payroll.payslip_corrected' && typeof after.version === 'number') {
    title = `Payslip corrected, version ${after.version}`;
  }
  const doer = entry.actorId === viewerId ? 'You' : by(entry);
  const line = [doer, entry.action === 'payslip.opened' ? '' : base.detail].filter((part) => part !== '').join(' · ');
  return { title, line, flagged: base.flagged, needsAnswer: answerable };
}

export interface CardRow {
  label: string;
  value: string;
}

/** The card of one entry (A8 right phone): when, who, phone, place, and for a payslip opening how it was opened. */
export function cardRows(entry: StoredEntry, viewerId: string, when: string): CardRow[] {
  const after = rec(asJson(entry.after));
  const rows: CardRow[] = [{ label: entry.action === 'payslip.opened' ? 'Opened' : 'When', value: when }];
  if (entry.action !== 'payslip.opened') rows.push({ label: 'By', value: entry.actorId === viewerId ? 'You' : by(entry) });
  if (entry.deviceLabel) rows.push({ label: 'Device', value: after.unconfirmed === true ? 'A phone you have not confirmed' : entry.deviceLabel });
  if (entry.placeLabel) rows.push({ label: 'Place', value: `${entry.placeLabel} (approximate)` });
  if (entry.action === 'payslip.opened') rows.push({ label: 'Opened with', value: after.ownerOpened === true ? 'Your own code' : 'Their own access, recorded' });
  return rows;
}
