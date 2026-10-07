import { formatAmount, judgeYield } from '../_shared/expected-yield';
import { exceedsStock } from '../_shared/prep-flags';
import type { PrepRunRow } from '../_shared/prep-run-repository';

const YIELD_REASON_WORDS: Record<string, string> = { TRIMMED_MORE: 'trimmed more', SPILLAGE: 'spillage', BURNT: 'burnt' };

const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Why a run sits in Needs a look, as the chips the manager reads (docs/features/inventory/prep-plan.md §3.6, #14):
 * "Low yield · 2 kg under usual", "Beef mince used more than expected", "Said: spillage", "Corrected".
 * Built from the run's own columns; the order is the order of how much the manager should care.
 */
export const reasonsFor = (run: PrepRunRow): string[] => {
  const reasons: string[] = [];
  const unit = run.outputItem.usageUnit;

  const judged = judgeYield(run.actualYield, run.expectedYield);
  if ((judged.label === 'LOW' || judged.label === 'HIGH') && judged.delta) {
    const amount = `${formatAmount(judged.delta.abs(), unit)} ${unit}`;
    reasons.push(judged.label === 'LOW' ? `Low yield · ${amount} under usual` : `High yield · ${amount} over usual`);
  }

  const overLines = run.inputLines.filter((line) => exceedsStock(line.quantity, line.onHandAtRunTime));
  for (const line of overLines) reasons.push(`${sentenceCase(line.inputItem.name)} used more than expected`);
  if (run.stockFlag && overLines.length === 0) reasons.push('Used more than expected');

  if (run.yieldReason === 'OTHER') {
    if (run.reasonNote) reasons.push(`Said: ${run.reasonNote}`);
    else reasons.push('Said: other');
  } else if (run.yieldReason) {
    reasons.push(`Said: ${YIELD_REASON_WORDS[run.yieldReason] ?? run.yieldReason.toLowerCase()}`);
  }

  if (run.replacesRunId) reasons.push('Corrected');
  return reasons;
};
