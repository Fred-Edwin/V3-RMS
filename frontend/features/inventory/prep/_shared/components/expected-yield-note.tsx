import * as React from 'react';

import { cn } from '@/lib/cn';
import type { CheckResult, VsUsual } from '../types/prep-contract';
import { formatQuantity } from '../lib/prep-format';

/**
 * The pieces of the live yield check (Paper steps 3, 6, 37, 39, 40): the blue "Usual recipe" note on top, the green/amber line
 * under the made figure, and the amber warning box. All of it is a guide: nothing here blocks the run.
 */

/** The blue note above the form: the usual recipe, or what we compare with when there is none. */
export function UsualNote({ check, unit, className }: { check: CheckResult | null; unit: string; className?: string }) {
  if (!check) return null;
  let text: string;
  if (check.usualRecipeText) {
    text = `${check.usualRecipeText} A guide only. Enter what really happened.`;
    if (check.mainIngredientMissing) text = `${check.usualRecipeText} This run does not use the main ingredient, so it is compared with past runs. Enter what really happened.`;
  } else if (check.expected.source === 'PAST_RUNS') {
    text = `No usual recipe for this item yet. We compare with the average of past runs, about ${formatQuantity(check.expected.amount ?? '0')} ${unit}. A guide only. Enter what really happened.`;
  } else {
    text = `No usual figure for this item yet, so this run is not compared. Enter what really happened.`;
  }
  return (
    <div role="note" className={cn('border border-wds-info-border bg-wds-info-bg px-wds-3 py-wds-2.5 font-wds-sans text-wds-body-sm text-wds-info-fg', className)}>
      {text}
    </div>
  );
}

const DOT = '●';

/** The small line under the made figure: "● On target · about 76 expected", "● Lower than usual". */
export function YieldLine({ check }: { check: CheckResult | null }) {
  const vs = check?.vsUsual;
  if (!check || !vs || vs.label === 'NO_BASIS') return null;
  const onTarget = vs.label === 'ON_TARGET';
  const label = onTarget ? (check.expected.source === 'PAST_RUNS' ? 'In line with past runs' : 'On target') : vs.label === 'LOW' ? 'Lower than usual' : 'Higher than usual';
  const expected = check.expected.amount !== null ? ` · about ${formatQuantity(check.expected.amount)} expected` : '';
  return (
    <div className={cn('font-wds-sans text-[11px] leading-[14px]', onTarget ? 'text-wds-success-fg' : 'text-wds-warning-fg')}>
      <span aria-hidden>{DOT} </span>
      {label}
      {/* The phone draws "On target" alone (Paper step 3); tablet and up add the expected figure (step 37). */}
      {onTarget ? <span className="hidden md:inline">{expected}</span> : null}
    </div>
  );
}

const abs = (delta: string | null): string => (delta ?? '').replace(/^[−+-]/, '');

/** The amber box for an off-target yield: "About 16 portions less than the 76 expected." */
export function warningText(check: CheckResult, unit: string): string | null {
  const vs: VsUsual | null = check.vsUsual;
  if (!vs || (vs.label !== 'LOW' && vs.label !== 'HIGH') || vs.deltaAmount === null) return null;
  const direction = vs.label === 'LOW' ? 'less' : 'more';
  const reference = check.expected.source === 'RECIPE' && check.expected.amount !== null ? `the ${formatQuantity(check.expected.amount)} expected` : 'usual';
  return `About ${abs(vs.deltaAmount)} ${unit} ${direction} than ${reference}. If that's right, carry on. If it's a typo, fix it now.`;
}

export function WarningBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('border border-wds-warning-border bg-wds-warning-bg px-wds-3 py-wds-2.5 font-wds-sans text-wds-body-sm text-wds-warning-fg', className)}>
      {children}
    </div>
  );
}
