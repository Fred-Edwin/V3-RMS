import { randomUUID } from 'node:crypto';
import { UnprocessableEntityError } from '../../../../utils/errors';
import type { AdjustmentInput, PersonInput } from '../engine/engine.types';
import type { CorrectionChange } from './correction-validators';

/** What the screen shows as "NOW" for each kind, read from the payslip's stored input. */
export function currentValues(input: PersonInput) {
  return {
    lateDaysCounted: input.lateDays.length,
    absentDays: input.absentDays,
    overtimeAuthorisedMinutes: input.overtimeAuthorisedMinutes,
    basicAmount: input.payType === 'MONTHLY_SALARY' ? input.amountInForce : null,
    extraLines: input.adjustments.map((a) => ({ id: a.id, kind: a.kind, label: a.label, amount: a.amount, taxable: a.taxable })),
  };
}

const refuse = (message: string, code: string): never => {
  throw new UnprocessableEntityError(message, code);
};

/**
 * Applies one correction to the payslip's stored input and returns the new input (E6, P21). Pure: the engine then recomputes the
 * payslip from it with the month's frozen rules, so every statutory line follows. Only what was counted can be taken back (late days
 * cannot go up: the excused days are the ones dropped, latest first). Nothing here reads the database.
 */
export function applyCorrection(input: PersonInput, change: CorrectionChange): PersonInput {
  switch (change.kind) {
    case 'LATE_DAYS': {
      const wanted = change.changes.lateDaysCounted;
      if (wanted > input.lateDays.length) return refuse('Late days can only go down: a correction takes back a day that was counted.', 'CORRECTION_NOT_ALLOWED');
      return { ...input, lateDays: input.lateDays.slice(0, wanted) };
    }
    case 'UNPAID_ABSENCE': {
      if (change.changes.absentDays > input.daysInMonth) return refuse('That is more days than the month has.', 'CORRECTION_NOT_ALLOWED');
      return { ...input, absentDays: change.changes.absentDays };
    }
    case 'OVERTIME':
      return { ...input, overtimeAuthorisedMinutes: { ordinaryDay: change.changes.ordinaryDay, restDay: change.changes.restDay, publicHoliday: change.changes.publicHoliday } };
    case 'BASIC': {
      if (input.payType !== 'MONTHLY_SALARY') return refuse('Basic pay can only be corrected for a person paid a monthly salary.', 'CORRECTION_NOT_ALLOWED');
      return { ...input, amountInForce: change.changes.amount, basisSegments: input.basisSegments.map((s) => ({ ...s, amount: change.changes.amount })) };
    }
    case 'EXTRA_LINE': {
      const known = new Set(input.adjustments.map((a) => a.id));
      const missing = change.changes.removeIds.find((id) => !known.has(id));
      if (missing !== undefined) return refuse('That line is not on this payslip.', 'CORRECTION_NOT_ALLOWED');
      const added: AdjustmentInput[] = change.changes.add.map((a) => ({ id: `correction-${randomUUID()}`, kind: a.type, label: a.label, amount: a.amount, taxable: a.taxable, reason: 'Added in a correction' }));
      return { ...input, adjustments: [...input.adjustments.filter((a) => !change.changes.removeIds.includes(a.id)), ...added] };
    }
  }
}
