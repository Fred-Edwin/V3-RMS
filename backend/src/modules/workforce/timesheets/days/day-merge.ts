import type { TimesheetStatus } from '@prisma/client';
import type { DayAssessment, DayReason, DayRow } from '../timesheets.types';

/** What happens to the person's decision on the stored day. */
export type DecisionChange = 'KEEP' | 'CLEAR' | { by: string; at: Date; reason: string | null };

export interface ResolvedDay {
  status: TimesheetStatus;
  reasons: DayReason[];
  decision: DecisionChange;
}

/** A person's answer to the day's overtime item (approved or declined), if there is one. */
export interface OvertimeAnswer {
  by: string;
  at: Date;
  reason: string | null;
}

/**
 * Rule: the system's own verdict (MATCHED, AUTO_APPROVED, NEEDS_LOOK) is recomputed every time. A person's verdict
 * (APPROVED, HELD) stays while the evidence hash is unchanged; if the evidence moved (a fix after the approval, a
 * late clock-out) an APPROVED day goes back to NEEDS_LOOK with CHANGED_AFTER_APPROVAL, a HELD day to NEEDS_LOOK, unless
 * the day now matches the rota by itself. A day whose only exception was overtime is settled by the overtime answer:
 * "when the Saturday overtime is answered, this week is done" (Chapter 8, step 2).
 */
export function resolveDay(stored: Pick<DayRow, 'status' | 'evidenceHash'> | null, assessed: DayAssessment, answer: OvertimeAnswer | null): ResolvedDay {
  const decided = stored !== null && (stored.status === 'APPROVED' || stored.status === 'HELD');
  let status: TimesheetStatus = assessed.status;
  let reasons = assessed.reasons;
  let keep = false;

  if (decided) {
    if (stored.evidenceHash === assessed.evidenceHash) {
      status = stored.status;
      keep = true;
    } else if (assessed.status === 'NEEDS_LOOK') {
      reasons = stored.status === 'APPROVED' ? ([...new Set([...assessed.reasons, 'CHANGED_AFTER_APPROVAL'])].sort() as DayReason[]) : assessed.reasons;
    }
  }

  if (answer) {
    reasons = reasons.filter((reason) => reason !== 'OVERTIME');
    if (status === 'NEEDS_LOOK' && reasons.length === 0) {
      return { status: assessed.final ? 'APPROVED' : 'MATCHED', reasons, decision: answer };
    }
  }
  return { status, reasons, decision: keep ? 'KEEP' : 'CLEAR' };
}

/** A week follows its days: any exception first, then held, then still in progress; no week sign-off exists. */
export function weekStatus(days: readonly TimesheetStatus[]): TimesheetStatus {
  if (days.includes('NEEDS_LOOK')) return 'NEEDS_LOOK';
  if (days.includes('HELD')) return 'HELD';
  if (days.includes('MATCHED')) return 'MATCHED';
  if (days.length > 0 && days.every((s) => s === 'AUTO_APPROVED')) return 'AUTO_APPROVED';
  return 'APPROVED';
}
