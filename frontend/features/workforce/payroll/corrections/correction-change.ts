import type { AdjustmentType, CorrectionChange, CorrectionInputs, CorrectionKind } from '../_shared/types/action-types';

/** What a person has typed into the correction form, as text, per kind. */
export interface CorrectionDraft {
  lateDays: string;
  absentDays: string;
  ordinary: string;
  rest: string;
  holiday: string;
  basic: string;
  removeIds: string[];
  addType: AdjustmentType;
  addLabel: string;
  addAmount: string;
  addTaxable: boolean;
}

type Current = CorrectionInputs['current'];

export const startDraft = (current: Current): CorrectionDraft => ({
  lateDays: String(current.lateDaysCounted),
  absentDays: String(current.absentDays),
  ordinary: String(current.overtimeAuthorisedMinutes.ordinaryDay),
  rest: String(current.overtimeAuthorisedMinutes.restDay),
  holiday: String(current.overtimeAuthorisedMinutes.publicHoliday),
  basic: current.basicAmount ?? '',
  removeIds: [],
  addType: 'ALLOWANCE',
  addLabel: '',
  addAmount: '',
  addTaxable: true,
});

const whole = (text: string, max: number): number | null => (/^\d{1,6}$/.test(text) && Number(text) <= max ? Number(text) : null);
const money = (text: string): boolean => /^\d{1,8}(\.\d{1,2})?$/.test(text) && Number(text) >= 1 && Number(text) <= 10_000_000;

/**
 * The request for the chosen kind, or null when the draft is not valid yet or equals what the payslip already has (so no preview is asked
 * for and Save stays off with "Change something first"). The server checks everything again.
 */
export function buildChange(kind: CorrectionKind, d: CorrectionDraft, current: Current): CorrectionChange | null {
  switch (kind) {
    case 'LATE_DAYS': {
      const n = whole(d.lateDays, 31);
      return n === null || n === current.lateDaysCounted ? null : { kind, changes: { lateDaysCounted: n } };
    }
    case 'UNPAID_ABSENCE': {
      const n = Number(d.absentDays);
      if (d.absentDays === '' || !Number.isFinite(n) || n < 0 || n > 31 || (n * 2) % 1 !== 0) return null;
      return n === current.absentDays ? null : { kind, changes: { absentDays: n } };
    }
    case 'OVERTIME': {
      const [o, r, h] = [whole(d.ordinary, 44640), whole(d.rest, 44640), whole(d.holiday, 44640)];
      if (o === null || r === null || h === null) return null;
      const c = current.overtimeAuthorisedMinutes;
      return o === c.ordinaryDay && r === c.restDay && h === c.publicHoliday ? null : { kind, changes: { ordinaryDay: o, restDay: r, publicHoliday: h } };
    }
    case 'BASIC': {
      if (current.basicAmount === null || !money(d.basic)) return null;
      return Number(d.basic) === Number(current.basicAmount) ? null : { kind, changes: { amount: d.basic } };
    }
    case 'EXTRA_LINE': {
      const adding = d.addLabel.trim() !== '' || d.addAmount !== '';
      if (adding && (d.addLabel.trim() === '' || !money(d.addAmount))) return null;
      if (!adding && d.removeIds.length === 0) return null;
      return { kind, changes: { add: adding ? [{ type: d.addType, label: d.addLabel.trim(), amount: d.addAmount, taxable: d.addTaxable }] : [], removeIds: d.removeIds } };
    }
  }
}

export const KIND_TITLES: Record<CorrectionKind, { title: string; card: string; line: string }> = {
  LATE_DAYS: { title: 'Correct the lateness', card: 'Late days', line: 'Re-count after an excuse' },
  UNPAID_ABSENCE: { title: 'Correct the unpaid absence', card: 'Unpaid absence days', line: 'Days taken off pay' },
  OVERTIME: { title: 'Correct the overtime', card: 'Overtime authorised', line: 'Minutes by day type' },
  BASIC: { title: 'Correct the basic pay', card: 'Basic pay for this month', line: 'Monthly salary only' },
  EXTRA_LINE: { title: 'Correct a line', card: 'An extra line', line: 'Add, or take one off' },
};

/** Why Save is off, as text under the PIN; null when it can be pressed. */
export function saveBlock(change: CorrectionChange | null, reason: string, previewProblem: string | null): string | null {
  if (!change) return 'Change something first.';
  if (previewProblem) return previewProblem;
  if (reason.trim().length < 5) return 'Add your reason.';
  return null;
}
