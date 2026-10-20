import type { ShiftChipTone, ShiftGridFooterCell, ShiftGridRow } from '../../../_shared';
import { dayNumber, weekdayShort } from '../../_shared/lib/leave-dates';
import type { RotaPanel } from '../../_shared/types/leave-types';

type Day = RotaPanel['days'][number];

/** Days drawn as columns; a longer request (Maternity) shows this many and lists the tight days below. */
export const MAX_COLUMNS = 14;

const toneOf = (templateName: string | null): ShiftChipTone => {
  const name = (templateName ?? '').toLowerCase();
  if (name.includes('morning')) return 'morning';
  if (name.includes('afternoon')) return 'afternoon';
  if (name.includes('bake')) return 'earlyBake';
  return 'midday';
};

/** "MON 26". */
export const columnLabel = (date: string): string => `${weekdayShort(date).toUpperCase()} ${dayNumber(date)}`;
/** "Tue 27". */
const short = (date: string): string => `${weekdayShort(date)} ${dayNumber(date)}`;

/** The team grid rows for the days shown: one row per teammate, a chip per day (a shift, Leave, or the dashed Asked for). */
export function gridRows(days: readonly Day[], personId: string): ShiftGridRow[] {
  const first = days[0];
  if (!first) return [];
  return first.rows.map((member) => ({
    id: member.employeeId,
    name: member.name,
    sub: member.employeeId === personId ? 'Asking' : undefined,
    cells: days.map((day) => {
      const cell = day.rows.find((r) => r.employeeId === member.employeeId);
      const spoken = `${member.name}, ${columnLabel(day.date)}`;
      if (!cell || cell.cell === 'OFF') return null;
      if (cell.cell === 'ASKED') return { tone: 'asked' as const, label: 'Asked for', ariaLabel: `${spoken}, asked for, not approved yet` };
      if (cell.cell === 'LEAVE') return { tone: 'leave' as const, label: 'Leave', ariaLabel: `${spoken}, on leave` };
      return { tone: toneOf(cell.templateName), label: (cell.templateName ?? 'Usual shift').slice(0, 9) };
    }),
    hours: '',
  }));
}

/** The IF APPROVED row: "5 of 6" per day (people working of the team), amber when below the minimum. */
export const footerCells = (days: readonly Day[]): ShiftGridFooterCell[] => days.map((day) => ({ text: `${day.working} of ${day.rows.length}`, tone: day.tight ? 'warning' : 'default' }));

export const tightDays = (days: readonly Day[]): Day[] => days.filter((d) => d.tight);

/** "Tue 27", "Tue 27 and Wed 28", "Tue 27, Wed 28 and Thu 29", then "Tue 27, Wed 28, Thu 29 and 2 more". */
export function dayList(dates: readonly string[]): string {
  const names = dates.map(short);
  if (names.length <= 1) return names.join('');
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

/**
 * The line under the strip: "Tue 27 and Wed 28 would be down to 4 people, the least you set for Barista. This warns you; it does not
 * stop you." Nothing tight: "Enough people on those days."
 */
export function coverSentence(days: readonly Day[], department: string | null): string {
  const tight = tightDays(days);
  if (tight.length === 0) return 'Enough people on those days.';
  const worst = Math.min(...tight.map((d) => d.working));
  return `${dayList(tight.map((d) => d.date))} would be down to ${worst} ${worst === 1 ? 'person' : 'people'}, below the least you set for ${department ?? 'the team'} (${tight[0]?.minimum ?? 0}). This warns you; it does not stop you.`;
}

/** The team row of the approve dialog: the worst tight day, or the first day when none is tight. Null when no minimum is set. */
export function teamLine(days: readonly Day[]): { label: string; value: string; tight: boolean } | null {
  const withMinimum = days.filter((d) => d.minimum !== null);
  if (withMinimum.length === 0) return null;
  const tight = tightDays(days);
  if (tight.length === 0) {
    const day = withMinimum[0] as Day;
    return { label: `Team on ${short(day.date)}`, value: `${day.working} of ${day.rows.length} working`, tight: false };
  }
  const worst = tight.reduce((a, b) => (b.working < a.working ? b : a));
  return { label: `Team on ${tight.map((d) => short(d.date)).join(', ')}`, value: `${worst.working} of ${worst.rows.length} working`, tight: true };
}
