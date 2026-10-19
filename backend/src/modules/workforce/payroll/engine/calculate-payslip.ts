import { EARNING_ADJUSTMENTS, type EngineRules, type PayLine, type Payslip, type PersonInput } from './engine.types';
import { formatCents, parseCents, type Cents } from './money';
import { calculateEarnings } from './lines/earnings';
import { payLine, whole } from './lines/line-text';
import { calculateStatutory } from './lines/statutory';

function deductionLines(person: PersonInput): { total: Cents; lines: PayLine[] } {
  let total = 0n;
  const lines: PayLine[] = [];
  for (const adjustment of person.adjustments.filter((a) => !EARNING_ADJUSTMENTS.includes(a.kind))) {
    const amount = parseCents(adjustment.amount);
    total += amount;
    lines.push(
      payLine({
        code: adjustment.kind,
        label: adjustment.label,
        kind: 'DEDUCTION',
        amount,
        source: { type: 'ADJUSTMENT', reference: adjustment.id },
        workingText: `${adjustment.label}: ${whole(amount)} taken by HR (${adjustment.reason})`,
      }),
    );
  }
  return { total, lines };
}

/**
 * E4: one person's payslip from their approved month and the rules the month froze. Pure: no database, no clock, no tax name.
 * Every line is rounded half up to 2 decimals when it is made; gross, deductions and net are sums of those lines, so the payslip
 * always adds up (E5). A person with no pay profile gets an empty payslip and the problem that explains it.
 */
export function calculatePayslip(person: PersonInput, rules: EngineRules): Payslip {
  const earnings = calculateEarnings(person, rules);
  const gross = earnings.basic + earnings.overtime + earnings.holiday + earnings.earningAdjustments - earnings.absence - earnings.lateness;
  const statutory = calculateStatutory(rules.tables, { gross, basic: earnings.basic, allowances: earnings.allowances, nonTaxableEarnings: earnings.nonTaxableEarnings }, tablesVersion(rules));
  const others = deductionLines(person);
  const net = gross - statutory.employee - others.total;
  return {
    employeeId: person.employeeId,
    lines: [...earnings.lines, ...statutory.lines, ...others.lines],
    basic: formatCents(earnings.basic),
    gross: formatCents(gross),
    statutoryEmployee: formatCents(statutory.employee),
    incomeTax: formatCents(statutory.incomeTax),
    otherDeductions: formatCents(others.total),
    net: formatCents(net),
    employerShare: formatCents(statutory.employer),
    taxablePay: formatCents(statutory.taxable),
    overtimePay: formatCents(earnings.overtime),
    latenessDeduction: formatCents(earnings.lateness),
    latenessCapHit: earnings.latenessCapHit,
    unpaidAbsence: formatCents(earnings.absence),
    problems: earnings.problems,
  };
}

const tablesVersion = (rules: EngineRules): number => rules.versions.find((v) => v.ruleKey === 'STATUTORY')?.version ?? 0;
