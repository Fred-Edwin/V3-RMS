import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { actorCan } from '../../_shared/central-store-access';
import { blindnessOf } from '../../_shared/blind-rule';
import { expectedYieldFor, formatAmount, vsUsualFor } from './expected-yield';
import { FIX_WINDOW_HOURS } from './prep-constants';
import { exceedsStock, exceedsText } from './prep-flags';
import type { ChangeRow, Person, RunDetail, RunSummary } from './prep-contract';
import type { PrepRunRow } from './prep-run-repository';

type Actor = Pick<NonNullable<Request['user']>, 'id' | 'role'>;
type UserRow = { id: string; name: string; role: string };

/** A decimal as a plain string: no exponent, no trailing zeros. */
export const decimalOut = (value: Prisma.Decimal): string => value.toFixed();

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'System Admin',
  DIRECTOR: 'Director',
  HR_MANAGER: 'HR Manager',
  MANAGER: 'Branch Manager',
  ACCOUNTANT: 'Accountant',
  STORE_MANAGER: 'Store Manager',
  STORE_ATTENDANT: 'Store Attendant',
  DEPARTMENT_HEAD: 'Department Head',
};

const roleLabelOf = (role: string): string =>
  ROLE_LABELS[role] ?? role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? [parts[0]!, parts[parts.length - 1]!] : [parts[0] ?? '?'];
  return letters.map((p) => p.charAt(0).toUpperCase()).join('');
};

export const personOf = (user: UserRow): Person => ({ id: user.id, name: user.name, initials: initialsOf(user.name), roleLabel: roleLabelOf(user.role) });

const lineLabel = (quantity: Prisma.Decimal, unit: string, name: string): string => `${formatAmount(quantity, unit)} ${unit} ${name}`;

/** What the caller may see of a run's money, flags and stock (docs/API_CONTRACT.md §33.2). */
const visibilityOf = (actor: Actor) => ({
  costs: actorCan(actor, 'prep.see_costs') && !blindnessOf(actor).itemCosts,
  flags: actorCan(actor, 'prep.read_flags'),
  stock: !blindnessOf(actor).stockFigures,
});

export const serializeRunSummary = (run: PrepRunRow, actor: Actor): RunSummary => {
  const see = visibilityOf(actor);
  const first = run.inputLines[0];
  const unit = run.outputItem.usageUnit;
  return {
    id: run.id,
    reference: run.reference ?? '',
    at: run.createdAt.toISOString(),
    outputItemId: run.outputItemId,
    outputName: run.outputItem.name,
    inputsPreview: {
      firstLabel: first ? lineLabel(first.quantity, first.inputItem.usageUnit, first.inputItem.name) : '',
      moreCount: Math.max(run.inputLines.length - 1, 0),
    },
    made: decimalOut(run.actualYield),
    unit,
    vsUsual: vsUsualFor(run.actualYield, run.expectedYield, unit),
    status: run.status,
    isCorrection: run.replacesRunId !== null,
    by: personOf(run.createdBy),
    mine: run.createdById === actor.id,
    ...(see.costs ? { outputUnitCost: decimalOut(run.outputUnitCost) } : {}),
    ...(see.flags
      ? {
          needsLook: run.needsLook,
          reviewedBy: run.reviewedBy ? personOf(run.reviewedBy) : null,
          reviewedAt: run.reviewedAt ? run.reviewedAt.toISOString() : null,
        }
      : {}),
  };
};

const ref = (r: { id: string; reference: string | null; createdAt: Date } | null) => (r ? { id: r.id, reference: r.reference ?? '', at: r.createdAt.toISOString() } : null);

/** The side-by-side of a correction: what the new run changed against the run it replaced (docs/API_CONTRACT.md §33.4). */
const correctionOf = (run: PrepRunRow, withCosts: boolean): RunDetail['correction'] => {
  const prev = run.replacesRun;
  if (!prev || !run.correctionReason) return null;

  const changed: ChangeRow[] = [];
  if (!prev.actualYield.eq(run.actualYield)) {
    changed.push({ itemName: run.outputItem.name, was: decimalOut(prev.actualYield), now: decimalOut(run.actualYield), unit: run.outputItem.usageUnit });
  }
  const was = new Map(prev.inputLines.map((line) => [line.inputItemId, line]));
  const now = new Map(run.inputLines.map((line) => [line.inputItemId, line]));
  // The new run's order first, then what it dropped.
  for (const line of run.inputLines) {
    const before = was.get(line.inputItemId);
    if (before && before.quantity.eq(line.quantity)) continue;
    changed.push({
      itemName: line.inputItem.name,
      was: before ? decimalOut(before.quantity) : null,
      now: decimalOut(line.quantity),
      unit: line.inputItem.usageUnit,
      ...(withCosts ? { costNow: decimalOut(line.lineCost) } : {}),
    });
  }
  for (const line of prev.inputLines) {
    if (now.has(line.inputItemId)) continue;
    changed.push({ itemName: line.inputItem.name, was: decimalOut(line.quantity), now: null, unit: line.inputItem.usageUnit });
  }

  return {
    reason: run.correctionReason,
    note: run.reasonNote,
    by: personOf(run.createdBy),
    at: run.createdAt.toISOString(),
    changed,
    ...(withCosts ? { unitCostBefore: decimalOut(prev.outputUnitCost), unitCostAfter: decimalOut(run.outputUnitCost) } : {}),
  };
};

export const serializeRunDetail = (run: PrepRunRow, actor: Actor, now: Date = new Date()): RunDetail => {
  const see = visibilityOf(actor);
  const unit = run.outputItem.usageUnit;
  const summary = serializeRunSummary(run, actor);
  const vs = summary.vsUsual;

  const stockLines = run.inputLines.map((line) => ({
    itemName: line.inputItem.name,
    unit: line.inputItem.usageUnit,
    quantity: line.quantity,
    onHand: line.onHandAtRunTime,
  }));

  // The 24-hour rule: a caller without `prep.fix_any` may fix only their own run, and only inside the window.
  const mine = run.createdById === actor.id;
  const open = run.status === 'RECORDED';
  const fixAny = actorCan(actor, 'prep.fix_any');
  const canRecord = actorCan(actor, 'prep.record');
  const windowEnd = new Date(run.createdAt.getTime() + FIX_WINDOW_HOURS * 60 * 60 * 1000);
  const withinWindow = now.getTime() <= windowEnd.getTime();
  const ownWindow = canRecord && !fixAny && mine && open;
  const canFix = open && (fixAny || (canRecord && mine && withinWindow));

  // A correction carries the whole chain (Paper step 17): the run it replaced, then this one.
  const timeline: RunDetail['timeline'] = run.replacesRun
    ? [
        { at: run.replacesRun.createdAt.toISOString(), text: `Recorded as ${run.replacesRun.reference ?? ''} · ${run.replacesRun.createdBy.name}` },
        { at: run.createdAt.toISOString(), text: `Corrected to ${run.reference ?? ''} · ${run.createdBy.name}` },
      ]
    : [{ at: run.createdAt.toISOString(), text: `Recorded as ${run.reference ?? ''} · ${run.createdBy.name}` }];
  if (see.flags && run.reviewedAt && run.reviewedBy) timeline.push({ at: run.reviewedAt.toISOString(), text: `Reviewed · ${run.reviewedBy.name}` });
  if (run.closedAt && run.closedBy) {
    const text =
      run.status === 'CANCELLED'
        ? `Cancelled · ${run.closedBy.name}`
        : `Corrected${run.replacedByRun ? ` to ${run.replacedByRun.reference ?? ''}` : ''} · ${run.closedBy.name}`;
    timeline.push({ at: run.closedAt.toISOString(), text });
  }

  return {
    ...summary,
    inputs: run.inputLines.map((line) => ({
      itemId: line.inputItemId,
      itemName: line.inputItem.name,
      quantity: decimalOut(line.quantity),
      unit: line.inputItem.usageUnit,
      ...(see.costs ? { unitCost: decimalOut(line.unitCostAtRunTime), lineCost: decimalOut(line.lineCost) } : {}),
      ...(see.stock && line.onHandAtRunTime !== null ? { onHand: decimalOut(line.onHandAtRunTime) } : {}),
      ...(see.flags ? { exceedsStock: exceedsStock(line.quantity, line.onHandAtRunTime) } : {}),
    })),
    ...(see.costs ? { totalInputCost: decimalOut(run.totalInputCost) } : {}),
    expected: expectedYieldFor(run.expectedYield, unit, run.expectedSource),
    recipeVersion: run.recipeVersion?.version ?? null,
    yieldReason: run.yieldReason,
    // `reasonNote` is one column: on a correction or a cancel it is that reason's note, never the yield reason's.
    yieldReasonNote: run.correctionReason || run.cancelReason ? null : run.reasonNote,
    ...(see.flags
      ? {
          flags: {
            yield: vs.label === 'LOW' ? ('LOW' as const) : vs.label === 'HIGH' ? ('HIGH' as const) : null,
            notify: run.notifiedStoreManager,
            stockExceeded: run.stockFlag,
            exceedsText: exceedsText(stockLines),
          },
        }
      : {}),
    replaces: ref(run.replacesRun),
    replacedBy: ref(run.replacedByRun),
    correction: correctionOf(run, see.costs),
    cancellation:
      run.status === 'CANCELLED' && run.cancelReason && run.closedBy && run.closedAt
        ? { reason: run.cancelReason, note: run.reasonNote, by: personOf(run.closedBy), at: run.closedAt.toISOString() }
        : null,
    timeline,
    can: {
      correct: canFix,
      cancel: canFix,
      review: open && see.flags && actorCan(actor, 'prep.review') && run.needsLook,
      lockedReason: ownWindow && !withinWindow ? 'Ask the Store Manager' : null,
    },
    windowEndsAt: ownWindow && withinWindow ? windowEnd.toISOString() : null,
  };
};
