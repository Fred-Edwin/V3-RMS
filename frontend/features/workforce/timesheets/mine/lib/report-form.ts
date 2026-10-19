import { REQUEST_KIND_WORDS } from '../../_shared/lib/timesheet-words';
import type { NewRequest, RequestKind } from '../../_shared/types/timesheet-types';

/** Report a problem (Paper Chapter 9, step 2): the form's state, what is missing, and the request it becomes. Pure. */

/** Paper's five lines, then "clocked out by mistake", which the Attendance card's note now links to. */
export const KIND_OPTIONS: { value: RequestKind; label: string }[] = (['CLOCK_TIME_WRONG', 'WORKED_NOT_RECORDED', 'CLOCKED_OUT_BY_MISTAKE', 'ROTA_WRONG', 'OVERTIME_MISSING', 'PAY_OTHER'] as const).map((value) => ({ value, label: REQUEST_KIND_WORDS[value] }));

export interface ReportForm {
  kind: RequestKind | null;
  date: string | null;
  /** Which clock time is wrong. */
  type: 'IN' | 'OUT';
  /** "14:00": the time it should be (a wrong time), or the real clock-out (a mistaken one, optional). */
  time: string;
  from: string;
  to: string;
  note: string;
}

export const EMPTY_FORM: ReportForm = { kind: null, date: null, type: 'OUT', time: '', from: '', to: '', note: '' };

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
/** The instant a Nairobi day and "HH:MM" mean, as the API takes it. */
export const instantOf = (date: string, hm: string): string => `${date}T${hm}:00+03:00`;

/** Pay questions go to HR; everything else to the Branch Manager (the Store Manager at the hub). The button says who. */
export const goesToHr = (kind: RequestKind | null): boolean => kind === 'PAY_OTHER';

/** What is still missing, in words the person can act on. Null when the form can be sent. */
export function problemOf(form: ReportForm): string | null {
  if (!form.kind) return 'Choose what went wrong.';
  if (!form.date) return 'Choose the day.';
  if (form.kind === 'CLOCK_TIME_WRONG' && !CLOCK.test(form.time)) return 'Say what time it should be, like 14:00.';
  if (form.kind === 'WORKED_NOT_RECORDED') {
    if (!CLOCK.test(form.from) || !CLOCK.test(form.to)) return 'Say when you started and finished, like 06:00 and 14:00.';
    if (form.to <= form.from) return 'The finish has to be after the start.';
  }
  if (form.kind === 'CLOCKED_OUT_BY_MISTAKE' && form.time !== '' && !CLOCK.test(form.time)) return 'Use a time like 14:00, or leave it empty.';
  if (form.note.trim().length < 3) return 'Write one line about what happened.';
  return null;
}

/** What the system holds for the time being reported: "Out 11:20". Null for the kinds that change no clock, or when nothing is recorded. */
export function recordedWords(form: Pick<ReportForm, 'kind' | 'type'>, clock: { in: string | null; out: string | null }): string | null {
  if (form.kind === 'CLOCK_TIME_WRONG') {
    const at = form.type === 'IN' ? clock.in : clock.out;
    return at ? `${form.type === 'IN' ? 'In' : 'Out'} ${at}` : null;
  }
  return form.kind === 'CLOCKED_OUT_BY_MISTAKE' && clock.out ? `Out ${clock.out}` : null;
}

/** What the person says it should be, as it fills in: "Out 14:00", or "Still on shift" when a mistaken clock-out has no real time. */
export function shouldBeWords(form: Pick<ReportForm, 'kind' | 'type' | 'time'>): string {
  if (form.kind === 'CLOCKED_OUT_BY_MISTAKE') return form.time ? `Out ${form.time}` : 'Still on shift';
  return form.time ? `${form.type === 'IN' ? 'In' : 'Out'} ${form.time}` : '—';
}

/** The request the server takes. Call only when `problemOf` is null. */
export function bodyOf(form: ReportForm): NewRequest {
  const date = form.date ?? '';
  const note = form.note.trim();
  switch (form.kind) {
    case 'CLOCK_TIME_WRONG':
      return { kind: 'CLOCK_TIME_WRONG', date, type: form.type, at: instantOf(date, form.time), note };
    case 'WORKED_NOT_RECORDED':
      return { kind: 'WORKED_NOT_RECORDED', date, clockIn: instantOf(date, form.from), clockOut: instantOf(date, form.to), note };
    case 'CLOCKED_OUT_BY_MISTAKE':
      return form.time ? { kind: 'CLOCKED_OUT_BY_MISTAKE', date, at: instantOf(date, form.time), note } : { kind: 'CLOCKED_OUT_BY_MISTAKE', date, note };
    case 'ROTA_WRONG':
      return { kind: 'ROTA_WRONG', date, note };
    case 'OVERTIME_MISSING':
      return { kind: 'OVERTIME_MISSING', date, note };
    default:
      return { kind: 'PAY_OTHER', date, note };
  }
}
