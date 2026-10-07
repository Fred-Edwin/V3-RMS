import { formatKes, withUnit } from '../../_shared/lib/prep-format';
import type { RunDetail } from '../../_shared/types/prep-contract';

/** "PREP-0131 · RECORDED RUN": the second line of the drawer header. */
export function drawerSubtitle(run: Pick<RunDetail, 'reference' | 'status' | 'isCorrection'>): string {
  const words = run.status === 'CANCELLED' ? 'CANCELLED RUN' : run.status === 'CORRECTED' ? 'CORRECTED · REPLACED' : run.isCorrection ? 'CORRECTED RUN' : 'RECORDED RUN';
  return `${run.reference} · ${words}`;
}

/** The status cell: what to say and in which tone. A manager's "Needs a look" and "Reviewed by" come from the flags the server sent. */
export function drawerStatus(run: Pick<RunDetail, 'status' | 'needsLook' | 'reviewedBy' | 'reviewedAt'>): { label: string; tone: 'warning' | 'success' | 'error' | 'info' | 'neutral' } {
  if (run.status === 'CANCELLED') return { label: 'Cancelled', tone: 'error' };
  if (run.status === 'CORRECTED') return { label: 'Corrected', tone: 'info' };
  if (run.needsLook) return { label: 'Needs a look', tone: 'warning' };
  if (run.reviewedBy) return { label: `Reviewed by ${run.reviewedBy.name.split(' ')[0]}`, tone: 'success' };
  return { label: 'Recorded', tone: 'neutral' };
}

/**
 * "Usually this gives about 7 kg. This run gave 5 kg, which is 2 kg (29%) under." Only for a run that was judged and came out off
 * target; null otherwise (on target, no usual figure, or the run was not judged).
 */
export function yieldGapSentence(run: Pick<RunDetail, 'made' | 'unit' | 'expected' | 'vsUsual'>): string | null {
  if (run.vsUsual.label !== 'LOW' && run.vsUsual.label !== 'HIGH') return null;
  const expected = Number(run.expected.amount);
  const made = Number(run.made);
  if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(made)) return null;
  const gap = Math.abs(made - expected);
  const percent = Math.round((gap / expected) * 100);
  const gapText = withUnit(String(Math.round(gap * 100) / 100), run.unit);
  return `Usually this gives ${run.expected.text}. This run gave ${withUnit(run.made, run.unit)}, which is ${gapText} (${percent}%) ${run.vsUsual.label === 'LOW' ? 'under' : 'over'}.`;
}

/**
 * "Beef mince used (6 kg) is 1.5 kg more than the system expected in stock. Only you see this." One sentence per input that went
 * over. A caller without stock figures gets the server's own wording instead; null when nothing went over.
 */
export function stockWarningSentence(run: Pick<RunDetail, 'inputs' | 'flags'>): string | null {
  if (!run.flags?.stockExceeded) return null;
  const sentences = run.inputs
    .filter((line) => line.exceedsStock && line.onHand !== undefined)
    .map((line) => {
      const over = Math.round((Number(line.quantity) - Number(line.onHand)) * 100) / 100;
      return `${line.itemName} used (${withUnit(line.quantity, line.unit)}) is ${withUnit(String(over), line.unit)} more than the system expected in stock.`;
    });
  if (sentences.length > 0) return `${sentences.join(' ')} Only you see this.`;
  return `${run.flags.exceedsText ?? 'An input was more than the system expected in stock.'} Only you see this.`;
}

/** "Sarah said", or "You said" on your own run. */
export function saidWho(run: Pick<RunDetail, 'by' | 'mine'>): string {
  return run.mine ? 'You said' : `${run.by.name.split(' ')[0]} said`;
}

/** The chip's words for what the Attendant said: "Spillage", or their own note when they chose Other and typed one. */
export function yieldReasonWords(run: Pick<RunDetail, 'yieldReason' | 'yieldReasonNote'>): string | null {
  switch (run.yieldReason) {
    case 'TRIMMED_MORE':
      return 'Trimmed more';
    case 'SPILLAGE':
      return 'Spillage';
    case 'BURNT':
      return 'Burnt';
    case 'OTHER':
      return run.yieldReasonNote?.trim() || 'Other';
    default:
      return null;
  }
}

/** "KES 828 / kg". */
export function unitCostText(run: Pick<RunDetail, 'outputUnitCost' | 'unit'>): string | null {
  return run.outputUnitCost === undefined ? null : `${formatKes(run.outputUnitCost)} / ${run.unit}`;
}
