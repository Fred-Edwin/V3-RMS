import type { EffectiveRules } from '../../rules';
import { isPayConfirmed } from '../../rules';
import type { EngineRules } from '../engine/engine.types';
import type { MonthWindow } from '../months/month-calendar';

/** The Rules store's answer for one site on the month's last day, in the shape the engine reads. */
export function toEngineRules(rules: EffectiveRules): EngineRules {
  const versions = (Object.values(rules) as { group: string; companyVersion: number; effectiveFrom: string | null }[])
    .filter((g) => ['STATUTORY', 'OVERTIME', 'LATENESS', 'LEAVE', 'HOLIDAYS'].includes(g.group))
    .map((g) => ({ ruleKey: g.group, version: g.companyVersion, effectiveFrom: g.effectiveFrom ?? '' }));
  return {
    tables: rules.STATUTORY.values.tables.map((t) => ({
      code: t.code,
      name: t.name,
      kind: t.kind,
      base: t.base,
      reducesTaxable: t.reducesTaxable,
      isIncomeTax: t.isIncomeTax,
      bands: t.bands.map((b) => ({ from: b.fromAmount, to: b.toAmount, ratePercent: b.ratePercent, flatAmount: b.flatAmount })),
      employerRatePercent: t.employerRatePercent,
      reliefMonthly: t.reliefMonthly,
      floorAmount: t.floorAmount,
      ceilingAmount: t.ceilingAmount,
    })),
    multipliers: { ordinaryDay: rules.OVERTIME.values.multipliers.ordinaryDay, restDay: rules.OVERTIME.values.multipliers.restDay, publicHoliday: rules.HOLIDAYS.values.payMultiplier },
    lateness: { policy: rules.LATENESS.values.policy, afterLatesPerMonth: rules.LATENESS.values.afterLatesPerMonth, deductionCapPercentOfPay: rules.LATENESS.values.deductionCapPercentOfPay },
    unpaidDayDivisor: rules.LEAVE.values.unpaidDayDivisor,
    versions,
  };
}

/** Public holidays that fall inside the month, as 'YYYY-MM-DD'. */
export const holidaysInMonth = (rules: EffectiveRules, window: MonthWindow): Set<string> =>
  new Set(rules.HOLIDAYS.values.holidays.map((h) => h.date).filter((date) => date >= window.first && date <= window.last));

export interface ReadinessProblem {
  group: 'STATUTORY' | 'OVERTIME' | 'HOLIDAYS';
  role: 'Accountant' | 'Director';
  message: string;
}

const WORDS: Record<ReadinessProblem['group'], { role: ReadinessProblem['role']; message: string }> = {
  STATUTORY: { role: 'Accountant', message: 'Waiting for the Accountant to confirm the tax tables.' },
  OVERTIME: { role: 'Accountant', message: 'Waiting for the Accountant to confirm the overtime rates.' },
  HOLIDAYS: { role: 'Accountant', message: 'Waiting for the Accountant to confirm the public holiday pay rate.' },
};

/**
 * E3: payroll refuses to calculate until the statutory tables, the overtime multipliers and, if a holiday fell in the month, the
 * holiday pay rate are confirmed. A version confirmed later never changes a calculated month (the month keeps its frozen rules).
 */
export function payReadiness(rules: EffectiveRules, holidayInMonth: boolean): ReadinessProblem[] {
  const checks: ReadinessProblem['group'][] = holidayInMonth ? ['STATUTORY', 'OVERTIME', 'HOLIDAYS'] : ['STATUTORY', 'OVERTIME'];
  return checks.filter((group) => !isPayConfirmed(rules[group]).ready).map((group) => ({ group, ...WORDS[group] }));
}
