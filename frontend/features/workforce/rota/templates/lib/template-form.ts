import { parseClock } from '../../../_shared';
import type { ShiftTone } from '../../../_shared';
import { colourOfTone, toneOfColour } from '../../_shared/lib/shift-look';
import type { TemplateBody, TemplateUpdateBody, TemplateView } from '../../_shared/types/rota-types';

/** The add and edit shift form (Paper step 7): what is typed, what is wrong with it, what is sent. Pure, tested. */

export interface TemplateForm {
  name: string;
  start: string;
  end: string;
  breakMinutes: number;
  tone: ShiftTone;
  /** "site" = this site only; "company" = every site (HR and the Director). */
  scope: 'site' | 'company';
  departmentIds: string[];
}

export const BREAK_CHOICES = [0, 15, 30, 45, 60] as const;

export const EMPTY_FORM: TemplateForm = { name: '', start: '', end: '', breakMinutes: 0, tone: 'morning', scope: 'site', departmentIds: [] };

export const formOf = (t: TemplateView): TemplateForm => ({
  name: t.name,
  start: t.startTime,
  end: t.endTime,
  breakMinutes: t.unpaidBreakMinutes,
  tone: toneOfColour(t.colour),
  scope: t.organizationId === null ? 'company' : 'site',
  departmentIds: t.departments.map((d) => d.id),
});

const toMinutes = (clock: string): number => {
  const [h, m] = clock.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Paid minutes, or null while the times are not both real, or the end is not later than the start. */
export function paidMinutesOf(form: Pick<TemplateForm, 'start' | 'end' | 'breakMinutes'>): number | null {
  const start = parseClock(form.start);
  const end = parseClock(form.end);
  if (!start || !end) return null;
  const length = toMinutes(end) - toMinutes(start);
  return length > form.breakMinutes ? length - form.breakMinutes : null;
}

export interface TemplateErrors {
  name?: string;
  end?: string;
}

export function validateTemplate(form: TemplateForm): TemplateErrors {
  const errors: TemplateErrors = {};
  const name = form.name.trim();
  if (name.length === 0) errors.name = 'Give the shift a name.';
  else if (name.length > 40) errors.name = 'Keep the name to 40 characters or fewer.';
  const start = parseClock(form.start);
  const end = parseClock(form.end);
  if (start && end && toMinutes(end) <= toMinutes(start)) errors.end = 'Ends must be later on the same day. There are no overnight shifts.';
  else if (start && end && paidMinutesOf(form) === null) errors.end = 'The unpaid break is longer than the shift.';
  return errors;
}

/** True when the form can be saved: a name, two real times in order, and no error. */
export const canSave = (form: TemplateForm): boolean => form.name.trim().length > 0 && paidMinutesOf(form) !== null && Object.keys(validateTemplate(form)).length === 0;

/** The first letter of the name (or the next one in it) that no other shift uses, so the keyboard shortcut works without a field. */
export function suggestLetter(name: string, taken: ReadonlySet<string>): string | undefined {
  const used = new Set(Array.from(taken, (l) => l.toUpperCase()));
  return Array.from(name.toUpperCase()).find((c) => /[A-Z]/.test(c) && !used.has(c));
}

export function toCreateBody(form: TemplateForm, siteId: string | null, letter: string | undefined): TemplateBody {
  return {
    siteId: form.scope === 'company' ? null : siteId,
    name: form.name.trim(),
    ...(letter ? { letter } : {}),
    colour: colourOfTone(form.tone),
    startTime: parseClock(form.start) ?? form.start,
    endTime: parseClock(form.end) ?? form.end,
    unpaidBreakMinutes: form.breakMinutes,
    departmentIds: form.departmentIds,
  };
}

/** Only what changed, so a rename never looks like a time change to the server. */
export function toUpdateBody(original: TemplateView, form: TemplateForm, reason?: string): TemplateUpdateBody {
  const start = parseClock(form.start) ?? form.start;
  const end = parseClock(form.end) ?? form.end;
  const before = formOf(original);
  const sameDepartments = before.departmentIds.length === form.departmentIds.length && before.departmentIds.every((id) => form.departmentIds.includes(id));
  return {
    ...(form.name.trim() !== original.name ? { name: form.name.trim() } : {}),
    ...(form.tone !== before.tone ? { colour: colourOfTone(form.tone) } : {}),
    ...(start !== original.startTime ? { startTime: start } : {}),
    ...(end !== original.endTime ? { endTime: end } : {}),
    ...(form.breakMinutes !== original.unpaidBreakMinutes ? { unpaidBreakMinutes: form.breakMinutes } : {}),
    ...(sameDepartments ? {} : { departmentIds: form.departmentIds }),
    ...(reason ? { reason } : {}),
  };
}

/** True when the times or the break change: the edit moves upcoming shifts and may start a new version. */
export function timesChanged(original: TemplateView, form: TemplateForm): boolean {
  return (parseClock(form.start) ?? form.start) !== original.startTime || (parseClock(form.end) ?? form.end) !== original.endTime || form.breakMinutes !== original.unpaidBreakMinutes;
}
