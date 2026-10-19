import type { PayLine, TableRule } from '../engine.types';
import { formatPercent, maxCents, minCents, parseCents, parseRate, percentOf, RATE_DENOMINATOR, roundDiv, type Cents } from '../money';
import { payLine, whole } from './line-text';

export interface StatutoryBases {
  gross: Cents;
  basic: Cents;
  allowances: Cents;
  nonTaxableEarnings: Cents;
}

export interface StatutoryResult {
  lines: PayLine[];
  employee: Cents; // every employee share, income tax included
  incomeTax: Cents;
  employer: Cents;
  taxable: Cents;
}

type BandsUsed = NonNullable<PayLine['bandsUsed']>;

/** The key a table is known by in exports: its code, or "OTHER:name" for the free ones. */
export const tableKey = (table: Pick<TableRule, 'code' | 'name'>): string => (table.code === 'OTHER' ? `OTHER:${table.name.toLowerCase()}` : table.code);

function applyBands(table: TableRule, base: Cents): { amount: Cents; used: BandsUsed } {
  let scaled = 0n;
  const used: BandsUsed = [];
  for (const band of table.bands) {
    const from = parseCents(band.from);
    if (base <= from) break;
    const to = band.to === null ? null : parseCents(band.to);
    const portion = minCents(base, to ?? base) - from;
    const rate = band.ratePercent === null ? 0n : parseRate(band.ratePercent);
    const flat = band.flatAmount === null ? 0n : parseCents(band.flatAmount) * RATE_DENOMINATOR;
    const bandScaled = portion * rate + flat;
    scaled += bandScaled;
    used.push({ from: band.from, to: band.to, ratePercent: band.ratePercent, amount: whole(roundDiv(bandScaled, RATE_DENOMINATOR)) });
  }
  return { amount: roundDiv(scaled, RATE_DENOMINATOR), used };
}

function tableAmount(table: TableRule, base: Cents): { amount: Cents; used: BandsUsed | null; rate: string | null; text: string } {
  if (base <= 0n) return { amount: 0n, used: null, rate: null, text: `${whole(base)}: nothing to take` };
  if (table.kind === 'RATE') {
    const open = table.bands.find((band) => band.ratePercent !== null);
    const percent = open?.ratePercent ?? null;
    const flat = open?.flatAmount ?? null;
    const raw = percent !== null ? percentOf(base, percent) : flat !== null ? parseCents(flat) : 0n;
    const floored = table.floorAmount === null ? raw : maxCents(raw, parseCents(table.floorAmount));
    const amount = table.ceilingAmount === null ? floored : minCents(floored, parseCents(table.ceilingAmount));
    const limit = amount !== raw ? ` (limited to ${whole(amount)})` : '';
    return { amount, used: null, rate: percent === null ? null : formatPercent(percent), text: `${whole(base)} × ${percent === null ? 'flat' : formatPercent(percent)} = ${whole(raw)}${limit}` };
  }
  const { amount, used } = applyBands(table, base);
  const parts = used.map((band, index) => {
    const to = band.to === null ? null : parseCents(band.to);
    const portion = minCents(base, to ?? base) - parseCents(band.from);
    return `${index === 0 ? 'first' : 'next'} ${whole(portion)} ${band.ratePercent === null ? 'flat' : `× ${formatPercent(band.ratePercent)}`}`;
  });
  return { amount, used, rate: null, text: `${parts.join(' + ')} = ${whole(amount)}` };
}

const baseValue = (table: TableRule, bases: StatutoryBases, taxable: Cents): Cents => {
  if (table.base === 'GROSS') return bases.gross;
  if (table.base === 'BASIC') return bases.basic;
  if (table.base === 'BASIC_PLUS_ALLOWANCES') return bases.basic + bases.allowances;
  return taxable;
};

const BASE_WORDS: Record<TableRule['base'], string> = { GROSS: 'Gross pay', BASIC: 'Basic pay', TAXABLE: 'Taxable pay', BASIC_PLUS_ALLOWANCES: 'Basic pay and allowances' };

/**
 * E4 steps 4 and 5. Tables whose base is not taxable pay are worked first, in the order the Accountant set, because the ones marked
 * `reducesTaxable` lower the taxable pay the others read. Then the taxable-pay tables. Lines come back in the Accountant's table order.
 */
export function calculateStatutory(tables: readonly TableRule[], bases: StatutoryBases, ruleVersion: number): StatutoryResult {
  const amounts = new Map<number, { amount: Cents; employer: Cents; base: Cents; used: BandsUsed | null; rate: string | null; text: string }>();
  let allowable = 0n;
  let taxable = maxCents(0n, bases.gross - bases.nonTaxableEarnings);
  const compute = (table: TableRule, index: number): void => {
    const base = baseValue(table, bases, taxable);
    const result = tableAmount(table, base);
    let amount = result.amount;
    let text = result.text;
    if (table.isIncomeTax && table.reliefMonthly !== null) {
      const relief = parseCents(table.reliefMonthly);
      amount = maxCents(0n, result.amount - relief);
      text = `${result.text} − relief ${whole(relief)} = ${whole(amount)}`;
    }
    const employer = table.employerRatePercent !== null && base > 0n ? percentOf(base, table.employerRatePercent) : 0n;
    amounts.set(index, { amount, employer, base, used: result.used, rate: result.rate, text });
  };

  tables.forEach((table, index) => {
    if (table.base === 'TAXABLE') return;
    compute(table, index);
    if (table.reducesTaxable) allowable += amounts.get(index)?.amount ?? 0n;
  });
  taxable = maxCents(0n, bases.gross - bases.nonTaxableEarnings - allowable);
  tables.forEach((table, index) => {
    if (table.base === 'TAXABLE') compute(table, index);
  });

  const lines: PayLine[] = [];
  let employee = 0n;
  let incomeTax = 0n;
  let employer = 0n;
  tables.forEach((table, index) => {
    const result = amounts.get(index);
    if (!result) return;
    const key = tableKey(table);
    const source = { type: 'RULE' as const, ruleKey: 'STATUTORY', version: ruleVersion };
    employee += result.amount;
    if (table.isIncomeTax) incomeTax += result.amount;
    lines.push(
      payLine({
        code: `STATUTORY:${key}`,
        label: table.name,
        kind: 'STATUTORY',
        amount: result.amount,
        base: BASE_WORDS[table.base],
        baseAmount: result.base,
        rate: result.rate,
        bandsUsed: result.used,
        source,
        workingText: result.text,
        tableCode: key,
        share: 'EMPLOYEE',
      }),
    );
    if (result.employer > 0n) {
      employer += result.employer;
      lines.push(
        payLine({
          code: `EMPLOYER:${key}`,
          label: `${table.name}, employer share`,
          kind: 'MEMO',
          amount: result.employer,
          base: BASE_WORDS[table.base],
          baseAmount: result.base,
          rate: table.employerRatePercent === null ? null : formatPercent(table.employerRatePercent),
          source,
          workingText: `${whole(result.base)} × ${formatPercent(table.employerRatePercent ?? '0')} = ${whole(result.employer)} (not taken from pay)`,
          tableCode: key,
          share: 'EMPLOYER',
        }),
      );
    }
  });
  return { lines, employee, incomeTax, employer, taxable };
}
