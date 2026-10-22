import type { PersonChoice } from '../../../../_shared';
import { impactText } from '../../../_shared/lib/impact-text';
import { addDays, formatDayMonth } from '../../../_shared/lib/people-dates';
import { firstName } from '../../_shared/lib/org-copy';
import type { AssignHeadBody, EndHeadBody, HeadCandidate, HeadPreview } from '../../_shared/types/org-types';

/** The words and checks of the head dialogs (Paper Chapter 3 steps 03 and 04). Pure. Copy uses first names and "their", never a guessed pronoun. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const monthYear = (date: string): string => `${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${date.slice(0, 4)}`;

export type HeadMode = 'REPLACE' | 'ACTING';

export function candidateChoices(candidates: readonly HeadCandidate[], siteName: string | null = null): PersonChoice[] {
  return candidates.map((c) => ({
    value: c.employeeId,
    name: c.name,
    line: `${c.positionName ?? 'No position'} · since ${monthYear(c.startDate)} · has a login`,
    // The shared person label draws "position · site" under the name (frame 7.5).
    position: c.positionName ?? 'No position',
    site: siteName,
    marker: c.recommended ? 'Recommended' : undefined,
  }));
}

/** The grey "What changes" box, from the server's preview. */
export function previewLines(preview: HeadPreview, previousApprover: string | null): string[] {
  const who = firstName(preview.employee.name);
  const dept = preview.department.name;
  const from = previousApprover ?? 'the Branch Manager';
  const lines: string[] = [];
  if (preview.mode === 'ACTING') {
    lines.push(`Overtime, leave and Reports for ${dept} go to ${who} while the head is away${preview.returnsOn ? `. It ends by itself on ${formatDayMonth(preview.returnsOn)}` : ''}.`);
  } else {
    lines.push(`Overtime, leave and Reports for ${dept} go to ${who} instead of ${from}.`);
  }
  for (const line of preview.impacts) lines.push(impactText(line));
  lines.push(`${who}'s phone gains Team today, Rota and Casuals. Their own job and pay do not change, and they see their own pay only.`);
  const ended = preview.endsHeadRoleOf.map((e) => e.name);
  if (ended.length > 0) lines.push(`${ended.join(' and ')} stops being ${preview.endsHeadRoleOf.some((e) => e.isActing) ? 'acting head' : 'head'} of ${dept}.`);
  const told = preview.notified.map((n) => n.name);
  lines.push(`${told.length > 0 ? `${told.join(', ')} ${told.length === 1 ? 'is' : 'are'} told. ` : ''}This is written to the audit log with your name and the time.`);
  return lines;
}

/** The return day of an acting head must be after today (the server refuses otherwise); one year ahead is the longest we offer. */
export function validateReturnDay(day: string | null, today: string): string | undefined {
  if (!day) return 'Pick the day the head is back.';
  if (day <= today) return 'It must be a day after today.';
  if (day > addDays(today, 366)) return 'It cannot be more than a year away.';
  return undefined;
}

export function toAssignBody(employeeId: string, mode: HeadMode, returnsOn: string | null, replaceActing: boolean): AssignHeadBody {
  return mode === 'ACTING' ? { employeeId, mode, returnsOn: returnsOn ?? undefined, replaceActing } : { employeeId, mode };
}

export const END_REASONS = [
  { key: 'moved', label: 'Moving to another role' },
  { key: 'stepped-down', label: 'Stepping down' },
  { key: 'restructure', label: 'The department is being restructured' },
] as const;

export const toEndBody = (which: EndHeadBody['which'], reason: string): EndHeadBody => ({ which, reason });
