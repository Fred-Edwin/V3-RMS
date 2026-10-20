import { addDays, type NairobiDate } from '../../_shared/time/nairobi-time';

export type P9Status = 'NOT_YET' | 'WAITING_FORMAT' | 'READY';

const firstOfNextMonth = (monthKey: string): NairobiDate => {
  const [y, m] = monthKey.split('-').map(Number) as [number, number];
  return (m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`) as NairobiDate;
};

/** What the Payroll side says about one month being Paid: paid or not, and the day if it knows it. */
export interface PaidFact {
  paid: boolean;
  paidOn: NairobiDate | null;
}

/**
 * PD13. For tax year Y the P9 is available from the later of 1 January of Y+1 and the day December of Y is marked Paid. For someone who
 * left during Y it is available from the day their final month is marked Paid (HR hands it over; a leaver has no login). null = not yet.
 * A month that is paid but whose day is not known counts as paid on the first day it could have been (the 1st of the next month).
 */
export function availableFrom(args: { year: number; exitMonthKey: string | null; december: PaidFact | null; finalMonth: PaidFact | null }): NairobiDate | null {
  if (args.exitMonthKey !== null && args.exitMonthKey.startsWith(`${args.year}-`) && args.exitMonthKey !== `${args.year}-12`) {
    const fact = args.finalMonth;
    if (!fact?.paid) return null;
    return fact.paidOn ?? firstOfNextMonth(args.exitMonthKey);
  }
  const jan1 = `${args.year + 1}-01-01` as NairobiDate;
  const dec = args.december;
  if (!dec?.paid) return null;
  const paidOn = dec.paidOn ?? jan1;
  return paidOn > jan1 ? paidOn : jan1;
}

export function p9Status(args: { today: NairobiDate; availableFrom: NairobiDate | null; formatConfirmed: boolean }): P9Status {
  if (args.availableFrom === null || args.today < args.availableFrom) return 'NOT_YET';
  return args.formatConfirmed ? 'READY' : 'WAITING_FORMAT';
}

export type MonthRowState = 'PAYSLIP' | 'NOT_EMPLOYED' | 'NO_PAYSLIP';

/**
 * The twelve rows of the card. A month before the joining month or after the leaving month is "Not employed" (S12); a month inside the
 * employment with no payslip is "No payslip" and the card is not made until HR has dealt with it (the service refuses).
 */
export function monthStates(year: number, startDate: NairobiDate, exitedOn: NairobiDate | null, payslipMonths: ReadonlySet<string>): { monthKey: string; state: MonthRowState }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
    const last = addDays(firstOfNextMonth(monthKey), -1);
    const employed = startDate <= last && (exitedOn === null || exitedOn >= (`${monthKey}-01` as NairobiDate));
    if (payslipMonths.has(monthKey)) return { monthKey, state: 'PAYSLIP' as const };
    return { monthKey, state: employed ? ('NO_PAYSLIP' as const) : ('NOT_EMPLOYED' as const) };
  });
}

/** P9-2026-0214: the year, then the digits of the employee number (PD15). */
export const p9Number = (year: number, employeeNumber: string): string => {
  const digits = employeeNumber.replace(/\D/g, '');
  return `P9-${year}-${(digits === '' ? '0' : digits).slice(-6).padStart(4, '0')}`;
};
