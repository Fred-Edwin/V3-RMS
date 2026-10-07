import type { Prisma } from '@prisma/client';
import { judgeLine } from '../../_shared/variance-calc';
import { fmtKes } from '../_shared/count-format';
import type { SettingsPreview } from '../_shared/counting-contract';
import type { SignedLineFigures } from './settings-repository';

/** The three numbers a what-if can change. */
export type PreviewSettings = { rangeKes: number; rangePercent: Prisma.Decimal; directorAlertKes: number };

const lines = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`;
const counts = (n: number): string => `${n} ${n === 1 ? 'count' : 'counts'}`;
const NOTHING_CHANGES = 'Nothing changes for counts already signed.';

/** "5" → "5", "8.50" → "8.5": the percent as a person would say it. */
const sayPercent = (value: Prisma.Decimal): string => value.toDecimalPlaces(2).toFixed();

const resultsUnder = (rows: readonly SignedLineFigures[], s: PreviewSettings) =>
  rows.map((r) => judgeLine({ counted: r.counted, expected: r.expected, unitCost: r.unitCost, rangeKes: s.rangeKes, rangePercent: s.rangePercent }));

const rangeHint = (current: PreviewSettings, proposed: PreviewSettings, intoRange: number, outOfRange: number): string | null => {
  const percentChanged = !proposed.rangePercent.equals(current.rangePercent);
  const kesChanged = proposed.rangeKes !== current.rangeKes;
  if (!percentChanged && !kesChanged) return null;

  const what = percentChanged && kesChanged ? 'the range' : percentChanged ? 'the percentage' : 'the amount';
  const to = percentChanged && kesChanged ? `${fmtKes(proposed.rangeKes)} and ${sayPercent(proposed.rangePercent)} %` : percentChanged ? sayPercent(proposed.rangePercent) : fmtKes(proposed.rangeKes);
  const raised = percentChanged ? proposed.rangePercent.greaterThan(current.rangePercent) : proposed.rangeKes > current.rangeKes;

  if (intoRange === 0 && outOfRange === 0) return `Changing ${what} to ${to} would not move any of these lines. ${NOTHING_CHANGES}`;
  if (intoRange > 0 && outOfRange === 0) return `${raised ? 'Raising' : 'Changing'} ${what} to ${to} would move ${lines(intoRange)} into range. ${NOTHING_CHANGES}`;
  if (outOfRange > 0 && intoRange === 0) return `${raised ? 'Changing' : 'Lowering'} ${what} to ${to} would move ${lines(outOfRange)} out of range. ${NOTHING_CHANGES}`;
  return `Changing ${what} to ${to} would move ${lines(intoRange)} into range and ${lines(outOfRange)} out. ${NOTHING_CHANGES}`;
};

const alertHint = (current: PreviewSettings, proposed: PreviewSettings, over: number, overProposed: number): string => {
  const said = over === 0 ? `No count went over ${fmtKes(current.directorAlertKes)}.` : `${counts(over)} went over ${fmtKes(current.directorAlertKes)}.`;
  if (proposed.directorAlertKes === current.directorAlertKes) return said;
  return `${said.replace(/\.$/, '')}. At ${fmtKes(proposed.directorAlertKes)} it would have been ${overProposed}.`;
};

/**
 * "How this plays out, last 7 days" (Paper steps 25 and 45): the signed lines of the last seven days judged again with the
 * PROPOSED numbers. A matched line is neither inside nor outside. Counts already signed keep what they were judged against;
 * this only shows what the new numbers would have done.
 */
export const previewOf = (rows: readonly SignedLineFigures[], current: PreviewSettings, proposed: PreviewSettings): SettingsPreview => {
  const now = resultsUnder(rows, current);
  const next = resultsUnder(rows, proposed);

  let withinRange = 0;
  let outsideRange = 0;
  let intoRange = 0;
  let outOfRange = 0;
  next.forEach((after, i) => {
    if (after.result === 'WITHIN_RANGE') withinRange += 1;
    if (after.result === 'EXCEEDS') outsideRange += 1;
    const before = now[i]!.result;
    if (before === 'EXCEEDS' && after.result === 'WITHIN_RANGE') intoRange += 1;
    if (before === 'WITHIN_RANGE' && after.result === 'EXCEEDS') outOfRange += 1;
  });

  // A count "went over" an alert amount when any one of its lines is worth at least that much (a matched line is worth nothing).
  const biggestByCount = new Map<string, Prisma.Decimal>();
  rows.forEach((row, i) => {
    const value = next[i]!.value;
    if (!value || next[i]!.difference?.isZero()) return;
    const prior = biggestByCount.get(row.countId);
    if (!prior || value.abs().greaterThan(prior)) biggestByCount.set(row.countId, value.abs());
  });
  const over = (amount: number): number => [...biggestByCount.values()].filter((v) => v.greaterThanOrEqualTo(amount)).length;
  const countsOver = over(current.directorAlertKes);
  const overProposed = over(proposed.directorAlertKes);

  return {
    range: { withinRange, outsideRange, hint: rangeHint(current, proposed, intoRange, outOfRange) },
    // `countsOver` is what happened at the amount in force today (the hint adds what the proposed amount would have done).
    alert: { countsOver, hint: alertHint(current, proposed, countsOver, overProposed) },
  };
};
