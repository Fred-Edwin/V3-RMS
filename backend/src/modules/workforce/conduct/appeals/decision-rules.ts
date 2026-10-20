import { AppError, ConflictError, ForbiddenError } from '../../../../utils/errors';
import { reduceTargets } from '../_shared/conduct-ladder';
import { issuedByHr } from '../_shared/conduct-roles';
import type { ConductLevel, ConductStatus, DecisionOutcome } from '../_shared/conduct-model';
import { tryNextStatus, type ConductMove } from '../_shared/conduct-status';

export interface DecisionPlan {
  move: Extract<ConductMove, 'KEEP' | 'REDUCE' | 'WITHDRAW'>;
  next: ConductStatus;
  /** The level of the replacing notice for a reduction. */
  targetLevel: ConductLevel | null;
  viaAppeal: boolean;
}

export interface DecisionFacts {
  status: ConductStatus;
  level: ConductLevel;
  issuerId: string;
  issuerRole: string;
  personUserId: string | null;
}

export interface Decider {
  id: string;
  role: string;
}

/**
 * Who decides (C8): HR decides notices managers issued; the Director decides notices HR issued. Nobody decides a notice they issued
 * or one about themself. The Director reads everything else but decides nothing else.
 */
export function assertMayDecide(decider: Decider, notice: DecisionFacts): void {
  if (decider.id === notice.issuerId || (notice.personUserId !== null && decider.id === notice.personUserId)) {
    throw new ForbiddenError('You cannot decide a notice you issued or one about you.', 'SELF_DECISION');
  }
  const wanted = issuedByHr(notice) ? 'DIRECTOR' : 'HR_MANAGER';
  if (decider.role !== wanted) throw new ForbiddenError(wanted === 'DIRECTOR' ? 'The Director decides notices that HR issued.' : 'HR decides this notice.', 'NOT_DECIDER');
}

/**
 * What the outcome does to the notice. With an appeal waiting the outcomes are Keep, Reduce and Withdraw; with no appeal (HR changing
 * a notice, C19) only Reduce and Withdraw. A move the status machine refuses is a 409 that names the real status.
 */
export function planDecision(notice: DecisionFacts, outcome: DecisionOutcome): DecisionPlan {
  const viaAppeal = notice.status === 'APPEALED';
  if (outcome === 'KEEP' && !viaAppeal) throw new ConflictError('There is no appeal to decide on this notice.', 'NOTHING_TO_DECIDE', { status: notice.status });
  const move: DecisionPlan['move'] = outcome === 'KEEP' ? 'KEEP' : outcome === 'WITHDRAW' ? 'WITHDRAW' : 'REDUCE';
  const next = tryNextStatus(notice.status, move);
  if (next === null) {
    const settled = ['KEPT', 'REPLACED', 'WITHDRAWN'].includes(notice.status);
    throw new ConflictError(settled ? 'This notice was just decided. Nothing was changed.' : 'This notice cannot change that way now.', settled ? 'ALREADY_DECIDED' : 'INVALID_TRANSITION', { status: notice.status });
  }
  if (move !== 'REDUCE') return { move, next, targetLevel: null, viaAppeal };
  const targetLevel: ConductLevel = outcome === 'REDUCE_TO_WRITTEN' ? 'WRITTEN_WARNING' : 'VERBAL_NOTE';
  if (!reduceTargets(notice.level).includes(targetLevel)) throw new AppError(422, 'REDUCE_NOT_POSSIBLE', 'That notice cannot be reduced to that level.', { level: notice.level, targetLevel });
  return { move, next, targetLevel, viaAppeal };
}

/** The outcomes the decision dialog offers for a notice (S13): Keep only with an appeal; reductions only below the level. */
export function outcomesFor(notice: Pick<DecisionFacts, 'status' | 'level'>): DecisionOutcome[] {
  const out: DecisionOutcome[] = [];
  if (notice.status === 'APPEALED') out.push('KEEP');
  const lower = reduceTargets(notice.level);
  if (lower.includes('WRITTEN_WARNING') && tryNextStatus(notice.status, 'REDUCE')) out.push('REDUCE_TO_WRITTEN');
  if (lower.includes('VERBAL_NOTE') && tryNextStatus(notice.status, 'REDUCE')) out.push('REDUCE_TO_VERBAL');
  if (tryNextStatus(notice.status, 'WITHDRAW')) out.push('WITHDRAW');
  return out;
}
