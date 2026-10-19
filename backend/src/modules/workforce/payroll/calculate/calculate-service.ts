import type { Prisma } from '@prisma/client';
import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { nairobiToday } from '../../_shared/time/nairobi-time';
import { told, type ActorCtx } from '../../people/people-context';
import type { EffectiveRules } from '../../rules';
import { hashInputs } from '../engine/month-totals';
import { monthHasEnded, monthWindow } from '../months/month-calendar';
import { monthsRepository, type MonthRow } from '../months/months-repository';
import { eventOf, payrollEntry, SYSTEM_ACTOR } from '../payroll-audit';
import { sitesRepository } from '../sites/sites-repository';
import { calculateRepository } from './calculate-repository';
import { computeRun } from './compute-run';
import { planFirstRun, type FirstRunPlan } from './inclusion';
import { inputsRepository } from './inputs-repository';
import { loadPeople } from './load-inputs';
import { toEngineRules } from './rules-to-engine';

export interface CalculateArgs {
  companyId: string;
  monthKey: string;
  trigger: 'SYSTEM' | 'HR';
  actor: ActorCtx | null;
  expectedVersion?: number;
  idempotencyKey?: string;
  now?: Date;
}

export interface CalculateResult {
  monthKey: string;
  state: 'IN_REVIEW';
  runNumber: number;
  headcount: number;
  blocking: number;
  stateVersion: number;
  repeat: boolean;
}

type Outcome = CalculateResult | { failed: string[] };

/** A recalculation keeps the sites and the rules the first calculation froze (E3): a later Rules change never moves a calculated month. */
async function frozenPlan(month: MonthRow, companyId: string): Promise<Pick<FirstRunPlan, 'siteIds' | 'siteNames' | 'rulesBySite'>> {
  const frozen = (month.rulesUsed ?? {}) as unknown as Record<string, EffectiveRules>;
  return {
    siteIds: month.includedSiteIds,
    siteNames: await inputsRepository.siteNames(companyId, month.includedSiteIds),
    rulesBySite: new Map(Object.entries(frozen)),
  };
}

/**
 * Calculates the month (E1, E4). The system does it within minutes of the last approval; HR can `Calculate again` while the month is in
 * review (ticks are cleared, adjustments and left-out choices are kept). Idempotent by key, versioned by `stateVersion`, one run row
 * per calculation, audited in the same transaction. The first calculation fixes who is in the month and the rules it used.
 */
export async function calculateMonth(args: CalculateArgs): Promise<CalculateResult> {
  const now = args.now ?? new Date();
  const { companyId, monthKey } = args;
  const window = monthWindow(monthKey);
  const today = nairobiToday(now);
  if (!monthHasEnded(window, today)) throw new ConflictError('This month has not ended yet.', 'MONTH_NOT_ENDED', { lastDay: window.last });

  if (args.idempotencyKey) {
    const prior = await monthsRepository.findKey(companyId, args.idempotencyKey);
    if (prior) {
      if (prior.action !== 'calculate' || prior.monthKey !== monthKey) throw new ConflictError('That request key was already used for something else.', 'IDEMPOTENCY_KEY_REUSED');
      return { ...(prior.response as unknown as CalculateResult), repeat: true };
    }
  }
  const month = await monthsRepository.ensure(companyId, monthKey);
  if (args.expectedVersion !== undefined && month.stateVersion !== args.expectedVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
  if (month.state !== 'WAITING' && month.state !== 'IN_REVIEW') throw new ConflictError('This month has been sent on, so it cannot be calculated again. The Accountant can send it back.', 'MONTH_NOT_CALCULABLE');

  const first = month.state === 'WAITING';
  const plan = first ? await planFirstRun(companyId, window, today, now) : await frozenPlan(month, companyId);
  const [adjustments, leftOut] = await Promise.all([inputsRepository.activeAdjustments(month.id), inputsRepository.leftOut(month.id)]);
  const people = await loadPeople({
    companyId,
    window,
    siteIds: plan.siteIds,
    siteNames: plan.siteNames,
    rulesBySite: plan.rulesBySite,
    adjustments: adjustments.map((a) => ({ id: a.id, employeeId: a.employeeId, kind: a.kind as never, label: a.label, amount: a.amount.toFixed(2), taxable: a.taxable, reason: a.reason })),
    leftOutIds: new Set(leftOut.map((l) => l.employeeId)),
  });
  const engineRules = new Map([...plan.rulesBySite].map(([siteId, rules]) => [siteId, toEngineRules(rules)]));
  const computed = computeRun(people, engineRules, new Map(leftOut.map((l) => [l.employeeId, { byId: l.byId }])));
  const fingerprint = await inputsRepository.fingerprint(companyId, plan.siteIds, window);
  const inputsHash = hashInputs({ people: people.map((p) => p.input), versions: [...engineRules].map(([id, r]) => [id, r.versions]), leftOut: leftOut.map((l) => l.employeeId).sort() });
  const trigger = args.trigger;
  const byId = args.actor?.subject.id ?? null;

  const outcome = await runAudited<Outcome>(async (tx) => {
    const locked = await monthsRepository.lock(tx, month.id);
    if (!locked || locked.stateVersion !== month.stateVersion) throw new ConflictError('This changed while you were looking. Check it again.', 'CHANGED_UNDERNEATH');
    if (args.idempotencyKey) {
      const dup = await monthsRepository.findKey(companyId, args.idempotencyKey, tx);
      if (dup) return { result: { ...(dup.response as unknown as CalculateResult), repeat: true }, entries: [] };
    }
    const runNumber = await calculateRepository.nextRunNumber(tx, month.id);
    if (computed.disagreements.length > 0) {
      await calculateRepository.insertFailedRun(tx, { monthId: month.id, runNumber, trigger, byId, inputsHash, headcount: computed.headcount, reason: computed.disagreements.join('; ') });
      return { result: { failed: computed.disagreements }, entries: [] };
    }
    const runId = await calculateRepository.insertRun(tx, {
      monthId: month.id, runNumber, trigger, byId, inputsHash, headcount: computed.headcount, blocking: computed.blocking,
      totals: { ...computed.totals, fingerprint } as unknown as Prisma.InputJsonValue, payslips: computed.payslips, reviews: computed.reviews, now,
    });
    const patch: Prisma.PayrollMonthUncheckedUpdateInput = { state: 'IN_REVIEW', currentRunId: runId, runCount: runNumber, calculatedAt: now, sentAt: null, sentById: null };
    if (first) {
      const fresh = plan as FirstRunPlan;
      Object.assign(patch, {
        includedSiteIds: fresh.siteIds,
        rulesUsed: Object.fromEntries(fresh.rulesBySite) as unknown as Prisma.InputJsonValue,
        tablesVersion: fresh.tablesVersion,
        tablesConfirmedAt: fresh.tablesConfirmed?.confirmedAt ?? null,
        tablesConfirmedBy: fresh.tablesConfirmed?.confirmedById ?? null,
        firstMonthSiteIds: fresh.firstMonthSiteIds,
      });
      await calculateRepository.addMonthSites(tx, fresh.monthSites.map((s) => ({ monthId: month.id, siteId: s.siteId, periodId: s.periodId, timesheetNumber: s.timesheetNumber, timesheetApprovedAt: s.approvedAt, timesheetApprovedById: s.approvedById, headcount: s.headcount })));
    }
    const updated = await calculateRepository.updateMonth(tx, month.id, patch);
    const result: CalculateResult = { monthKey, state: 'IN_REVIEW', runNumber, headcount: computed.headcount, blocking: computed.blocking, stateVersion: updated.stateVersion, repeat: false };
    if (args.idempotencyKey) await monthsRepository.saveKey(tx, { companyId, key: args.idempotencyKey, action: 'calculate', monthKey, response: result as unknown as Prisma.InputJsonValue });
    const entry = payrollEntry({
      companyId, actor: args.actor?.auditActor ?? SYSTEM_ACTOR, channel: args.actor ? 'APP' : 'SYSTEM', action: 'payroll.calculated', category: 'PAY_RUN_PREPARE', monthId: month.id,
      before: { state: month.state }, after: { state: 'IN_REVIEW', month: monthKey, run: runNumber, headcount: computed.headcount, blockingLines: computed.blocking, sites: plan.siteIds.length },
    });
    return { result, entries: [entry], events: [eventOf('payroll.month_calculated', { monthKey, runNumber, headcount: computed.headcount, calculatedById: byId, blocking: computed.blocking }, now)] };
  });

  if ('failed' in outcome) throw new ConflictError('The totals do not agree. Calculate again. If it happens again, tell the developer.', 'TOTALS_DISAGREE', { problems: outcome.failed });
  if (!outcome.repeat) await told(await sitesRepository.usersWithRoles(['HR_MANAGER']), 'payroll.month_calculated', { month: monthKey });
  return outcome;
}
