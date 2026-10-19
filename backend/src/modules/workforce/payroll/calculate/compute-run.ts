import type { Prisma } from '@prisma/client';
import { calculatePayslip } from '../engine/calculate-payslip';
import type { EngineRules } from '../engine/engine.types';
import { monthTotals, totalsDisagree, type SiteSlip } from '../engine/month-totals';
import { reviewFlags } from '../engine/review-flags';
import type { LoadedPerson } from './load-inputs';
import type { PayslipWrite, ReviewWrite } from './calculate-repository';

export interface LeftOutChoice {
  byId: string;
}

export interface ComputedRun {
  payslips: PayslipWrite[];
  reviews: ReviewWrite[];
  blocking: number;
  headcount: number;
  totals: { total: ReturnType<typeof monthTotals>['total']; bySite: Record<string, ReturnType<typeof monthTotals>['total']> };
  disagreements: string[];
}

export const LEFT_OUT_TEXT = 'Left out of this run; paid in the next run once added';

/** E4 and E5 for the whole month: a payslip per person who is in, a review line per thing HR must look at, and the totals. */
export function computeRun(people: readonly LoadedPerson[], rulesBySite: ReadonlyMap<string, EngineRules>, leftOut: ReadonlyMap<string, LeftOutChoice>): ComputedRun {
  const payslips: PayslipWrite[] = [];
  const reviews: ReviewWrite[] = [];
  const slips: SiteSlip[] = [];
  for (const person of people) {
    const { input, facts } = person;
    const base = { employeeId: input.employeeId, siteId: input.siteId, employeeName: input.name, siteName: person.siteName };
    const choice = leftOut.get(input.employeeId);
    if (choice) {
      reviews.push({ ...base, kind: 'LEFT_OUT', severity: 'TICK', text: LEFT_OUT_TEXT, checkedById: choice.byId });
      continue;
    }
    const rules = rulesBySite.get(input.siteId);
    if (!rules) throw new Error(`No rules for site ${input.siteId}`);
    const slip = calculatePayslip(input, rules);
    slips.push({ siteId: input.siteId, payslip: slip });
    payslips.push({
      slip,
      siteId: input.siteId,
      employeeName: input.name,
      employeeNumber: person.employeeNumber,
      department: person.department,
      siteName: person.siteName,
      payoutMethod: person.payoutMethod,
      input: { ...input, bankFingerprint: person.bankFingerprint } as unknown as Prisma.InputJsonValue,
    });
    for (const flag of reviewFlags(facts, slip)) reviews.push({ ...base, kind: flag.kind, severity: flag.severity, text: flag.text, checkedById: null });
  }
  const { total, bySite } = monthTotals(slips);
  return {
    payslips,
    reviews,
    blocking: reviews.filter((r) => r.severity === 'BLOCK').length,
    headcount: payslips.length,
    totals: { total, bySite: Object.fromEntries(bySite) },
    disagreements: totalsDisagree(slips),
  };
}
