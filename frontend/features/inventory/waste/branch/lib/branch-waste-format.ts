import { clockLabel } from '../../../counting/_shared/lib/count-format';
import type { BranchWasteEntry } from '../../_shared/types/waste-contract';

const NAIROBI = 'Africa/Nairobi';

/** "Grace Wanjiru" → "Grace W." (first name and a last initial, as Paper draws other people's entries). */
export function shortPerson(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/** "2 kg" / "2.5 kg": the stored decimal shown without trailing zeros. */
export function quantityLabel(quantity: string, unit: string): string {
  const n = Number(quantity);
  return `${Number.isFinite(n) ? String(n) : quantity} ${unit}`;
}

/** "2 kg · Spoiled · 14:20 · you" or "… · Joseph M." (Paper step 55). */
export function entryMeta(entry: BranchWasteEntry, meId: string | undefined): string {
  const who = meId !== undefined && entry.loggedBy.id === meId ? 'you' : shortPerson(entry.loggedBy.name);
  return `${quantityLabel(entry.quantity, entry.unit)} · ${entry.reasonText} · ${clockLabel(entry.at)} · ${who}`;
}

/** The sheet's one-line summary: "Kachumbari mix · 2 kg · Spoiled · 14:20" (Paper W5). */
export function entrySummary(entry: BranchWasteEntry): string {
  return `${entry.itemName} · ${quantityLabel(entry.quantity, entry.unit)} · ${entry.reasonText} · ${clockLabel(entry.at)}`;
}

export const nairobiDay = (iso: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: NAIROBI }).format(new Date(iso));

/** "Thu 8 Oct", the way the Paper group headings read. */
export const dayHeading = (iso: string): string => new Intl.DateTimeFormat('en-GB', { timeZone: NAIROBI, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(',', '');

export interface DayGroup {
  day: string;
  heading: string;
  rows: BranchWasteEntry[];
}

/** Groups already-newest-first rows by the Nairobi day they were logged, keeping order. "Today · " leads today's heading. */
export function groupByDay(rows: readonly BranchWasteEntry[], today: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const day = nairobiDay(row.at);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, heading: `${day === today ? 'Today · ' : ''}${dayHeading(row.at)}`, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

/** A quantity the keypad typed is usable when it is a number above zero ("0.", "." and "" are not). */
export function quantityIsValid(typed: string): boolean {
  const n = Number(typed);
  return typed !== '' && Number.isFinite(n) && n > 0;
}

/** The typed text is unreadable as a number (a lone "." or "0."), so the sheet shows the "Could not read that number" line. */
export function quantityIsUnreadable(typed: string): boolean {
  return typed !== '' && !Number.isFinite(Number(typed));
}
