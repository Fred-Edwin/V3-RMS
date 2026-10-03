import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  prepRunRepository,
  type CreatePrepRunInput as CreatePrepRunRepoInput,
  type PrepRunForRollingAverage,
  type PrepRunWithRelations,
} from './prep-repository';
import { inventoryItemRepository } from '../catalog/inventory-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { prisma } from '../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { mapPrismaError } from '../../../utils/prisma-errors';
import type {
  CreatePrepRunInput,
  ListPrepRunsQuery,
  PrepRunDetail,
  PrepRunSummary,
  PrepSummary,
  PrepSummaryQuery,
  TypicalYield,
  YieldVarianceLabel,
} from './prep.types';

type Actor = NonNullable<Request['user']>;

/**
 * Same D-15 hub-org guard receiving-service.ts uses — Central Store data
 * lives only on the hub org. Duplicated locally rather than imported: that
 * module's contract (receiving-validators.ts/receiving.types.ts) is frozen
 * and CLAUDE.md is explicit not to edit it, and its own `requireHubActor` is
 * unexported.
 */
const requireHubActor = async (actor: Actor): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) {
    throw new ValidationError('No hub organization is configured');
  }
  if (actor.organizationId !== hub.id) {
    throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
  }
  return hub.id;
};

const toDecimalString = (value: Prisma.Decimal): string => value.toString();

/** ±15% deviation from typical yield -> non-blocking UI warning (owner-resolved, plan §6 Q1). */
const YIELD_VARIANCE_WARN_PCT = 15;
/** ±35% deviation -> additionally records notifiedStoreManager: true (delivery itself out of scope, plan §0). */
const YIELD_VARIANCE_NOTIFY_PCT = 35;
/** Rolling-average window: last N runs OR last 30 days, whichever gives fewer data points (plan §6 Q3). */
const ROLLING_AVERAGE_MAX_RUNS = 10;
const ROLLING_AVERAGE_MAX_DAYS = 30;

const yieldFlagToLabel: Record<'normal' | 'low' | 'high', YieldVarianceLabel> = {
  normal: 'normal',
  low: 'low yield',
  high: 'high yield',
};

/** "6kg chicken" — quantity+unit+name, matching TypicalYield's own "~6 kg chicken" convention (prep-validators.ts header gap #2). */
const formatInputLabel = (quantity: Prisma.Decimal, unit: string, itemName: string): string =>
  `${quantity.toString()}${unit} ${itemName}`;

/** Existing feature-wide convention (e.g. history-list-screen.tsx's mobile header), not a first+last-initial scheme. */
const initialsFor = (name: string): string => name.slice(0, 2).toUpperCase();

/** Signed one-decimal quantity delta, e.g. "+0.5" / "-1.2" (prep-validators.ts header gap #4). */
const formatSignedDelta = (delta: Prisma.Decimal): string => {
  const rounded = delta.toDecimalPlaces(1);
  const sign = rounded.isNegative() ? '' : '+';
  return `${sign}${rounded.toString()}`;
};

const serializePrepRunSummary = (run: PrepRunWithRelations): PrepRunSummary => {
  const firstLine = run.inputLines[0];
  const remainingCount = Math.max(run.inputLines.length - 1, 0);
  const delta =
    run.typicalYieldAtRunTime !== null ? run.actualYield.minus(run.typicalYieldAtRunTime) : null;

  return {
    id: run.id,
    when: run.createdAt.toISOString(),
    outputItemId: run.outputItemId,
    outputName: run.outputItem.name,
    inputsPreview: {
      firstItemLabel: firstLine
        ? formatInputLabel(firstLine.quantity, firstLine.inputItem.usageUnit, firstLine.inputItem.name)
        : '',
      remainingCount,
    },
    actualYield: toDecimalString(run.actualYield),
    yieldUnit: run.outputItem.usageUnit,
    yieldVarianceLabel: (run.yieldVarianceLabel as YieldVarianceLabel | null) ?? null,
    yieldVarianceDelta: delta ? formatSignedDelta(delta) : null,
    outputUnitCost: toDecimalString(run.outputUnitCost),
    createdByInitials: initialsFor(run.createdBy.name),
  };
};

const serializePrepRunDetail = (run: PrepRunWithRelations): PrepRunDetail => ({
  ...serializePrepRunSummary(run),
  createdByName: run.createdBy.name,
  createdAt: run.createdAt.toISOString(),
  inputLines: run.inputLines.map((line) => ({
    itemName: line.inputItem.name,
    quantity: toDecimalString(line.quantity),
    unit: line.inputItem.usageUnit,
    unitCostAtRunTime: toDecimalString(line.unitCostAtRunTime),
    lineCost: toDecimalString(line.lineCost),
  })),
  totalInputCost: toDecimalString(run.totalInputCost),
  typicalYieldAtRunTime: run.typicalYieldAtRunTime ? toDecimalString(run.typicalYieldAtRunTime) : null,
});

/**
 * Rolling average (plan §1.3, §6 Q3/Q3b): last ROLLING_AVERAGE_MAX_RUNS runs
 * OR last ROLLING_AVERAGE_MAX_DAYS days, whichever gives FEWER data points.
 * Flagged/outlier runs are always included, never excluded — no filter on
 * yieldVarianceLabel anywhere in this selection.
 */
const computeTypicalYield = (candidateRuns: PrepRunForRollingAverage[]): Prisma.Decimal | null => {
  if (candidateRuns.length === 0) return null;

  const cutoff = new Date(Date.now() - ROLLING_AVERAGE_MAX_DAYS * 24 * 60 * 60 * 1000);
  const runsWithinWindow = candidateRuns.filter((r) => r.createdAt >= cutoff);
  const sample = runsWithinWindow.length < candidateRuns.length ? runsWithinWindow : candidateRuns;
  if (sample.length === 0) return null;

  const sum = sample.reduce((acc, r) => acc.plus(r.actualYield), new Prisma.Decimal(0));
  return sum.dividedBy(sample.length);
};

/**
 * Threshold logic (plan §6 Q1): named constants, not inline magic numbers.
 * yieldVarianceLabel is 'normal' (not null) whenever a typical exists but
 * the delta is under the warn threshold — null is reserved for "no typical
 * yet" only (prep-validators.ts header gap #3).
 */
const computeYieldVariance = (
  actualYield: Prisma.Decimal,
  typicalYieldAtRunTime: Prisma.Decimal | null,
): { yieldVarianceLabel: YieldVarianceLabel | null; notifiedStoreManager: boolean } => {
  if (typicalYieldAtRunTime === null || typicalYieldAtRunTime.lessThanOrEqualTo(0)) {
    return { yieldVarianceLabel: null, notifiedStoreManager: false };
  }

  const deltaPct = actualYield.minus(typicalYieldAtRunTime).dividedBy(typicalYieldAtRunTime).times(100);
  const absDeltaPct = deltaPct.abs();

  let yieldVarianceLabel: YieldVarianceLabel = 'normal';
  if (absDeltaPct.greaterThanOrEqualTo(YIELD_VARIANCE_WARN_PCT)) {
    yieldVarianceLabel = deltaPct.isNegative() ? 'low yield' : 'high yield';
  }
  const notifiedStoreManager = absDeltaPct.greaterThanOrEqualTo(YIELD_VARIANCE_NOTIFY_PCT);

  return { yieldVarianceLabel, notifiedStoreManager };
};

export const prepService = {
  listPrepRuns: async (actor: Actor, query: ListPrepRunsQuery): Promise<PrepRunSummary[]> => {
    const organizationId = await requireHubActor(actor);
    const runs = await prepRunRepository.findAllByOrganization(organizationId, {
      search: query.search,
      outputItemId: query.outputItemId,
      yieldVarianceLabel: query.yieldFlag ? yieldFlagToLabel[query.yieldFlag] : undefined,
      from: query.dateFrom ? new Date(query.dateFrom) : undefined,
      to: query.dateTo ? new Date(query.dateTo) : undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
    return runs.map(serializePrepRunSummary);
  },

  getPrepRun: async (actor: Actor, id: string): Promise<PrepRunDetail> => {
    const organizationId = await requireHubActor(actor);
    const run = await prepRunRepository.findById(id, organizationId);
    if (!run) throw new NotFoundError('Prep run not found');
    return serializePrepRunDetail(run);
  },

  getPrepSummary: async (actor: Actor, query: PrepSummaryQuery): Promise<PrepSummary> => {
    const organizationId = await requireHubActor(actor);
    const rows = await prepRunRepository.findSummaryRows(organizationId, {
      from: query.dateFrom ? new Date(query.dateFrom) : undefined,
      to: query.dateTo ? new Date(query.dateTo) : undefined,
    });

    const totalInputCost = rows.reduce((sum, r) => sum.plus(r.totalInputCost), new Prisma.Decimal(0));
    const yieldFlagCount = rows.filter((r) => r.yieldVarianceLabel && r.yieldVarianceLabel !== 'normal').length;

    return {
      runsInRange: rows.length,
      totalInputCost: toDecimalString(totalInputCost),
      yieldFlagCount,
    };
  },

  getTypicalYield: async (actor: Actor, outputItemId: string): Promise<TypicalYield> => {
    const organizationId = await requireHubActor(actor);
    const outputItem = await inventoryItemRepository.findById(outputItemId, organizationId);
    if (!outputItem) throw new NotFoundError('Inventory item not found');

    const candidateRuns = await prepRunRepository.findRecentForRollingAverage(
      organizationId,
      outputItemId,
      ROLLING_AVERAGE_MAX_RUNS,
    );
    const typicalYield = computeTypicalYield(candidateRuns);

    if (typicalYield === null) {
      return { outputItemId, typicalInputSummary: null, typicalYield: null, sampleSize: 0 };
    }

    // Most-recent run's own input mix stands in for "typical inputs" — the
    // plan does not maintain a separate typical-input-mix aggregate, and the
    // nudge only needs an illustrative example, not a computed blend.
    const mostRecentRun = await prepRunRepository.findById(candidateRuns[0]!.id, organizationId);
    const firstLine = mostRecentRun?.inputLines[0];
    const typicalInputSummary = firstLine
      ? `~${formatInputLabel(firstLine.quantity, firstLine.inputItem.usageUnit, firstLine.inputItem.name)}`
      : null;

    return {
      outputItemId,
      typicalInputSummary,
      typicalYield: `~${typicalYield.toDecimalPlaces(1).toString()}${outputItem.usageUnit}`,
      sampleSize: candidateRuns.length,
    };
  },

  /**
   * The one write endpoint (plan §1.2, §1.3). Everything before the
   * $transaction is pure reads + arithmetic — no speculative writes, so a
   * validation failure never needs a rollback. Inside the transaction: N
   * negative-signed PREP_CONSUME rows + 1 positive-signed PREP_PRODUCE row +
   * an InventoryItem.currentCost update on the output item only.
   */
  createPrepRun: async (actor: Actor, input: CreatePrepRunInput): Promise<PrepRunDetail> => {
    const organizationId = await requireHubActor(actor);

    const outputItem = await inventoryItemRepository.findById(input.outputItemId, organizationId);
    if (!outputItem) throw new NotFoundError('Output item not found');
    if (outputItem.deletedAt) throw new ConflictError('This item is retired');

    const inputItemIds = input.inputLines.map((l) => l.inventoryItemId);
    const liveInputItems = await inventoryItemRepository.findLiveByIds(inputItemIds, organizationId);
    const itemsById = new Map(liveInputItems.map((i) => [i.id, i]));
    for (const line of input.inputLines) {
      if (!itemsById.has(line.inventoryItemId)) {
        throw new ValidationError('One or more input items were not found');
      }
    }

    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore || centralStore.organizationId !== organizationId) {
      throw new NotFoundError('No Central Store is configured for this organization');
    }

    // Snapshot each input line's cost NOW — never recomputed later (plan §1.1).
    const inputLineData = input.inputLines.map((line, index) => {
      const item = itemsById.get(line.inventoryItemId)!;
      const quantity = new Prisma.Decimal(line.quantity);
      const unitCostAtRunTime = item.currentCost;
      const lineCost = quantity.times(unitCostAtRunTime).toDecimalPlaces(2);
      return { inputItemId: line.inventoryItemId, quantity, unitCostAtRunTime, lineCost, lineOrder: index };
    });

    const totalInputCost = inputLineData
      .reduce((sum, l) => sum.plus(l.lineCost), new Prisma.Decimal(0))
      .toDecimalPlaces(2);
    const actualYield = new Prisma.Decimal(input.actualYield);
    // actualYield > 0 is enforced by positiveDecimalString at the Zod layer — safe to divide.
    const outputUnitCost = totalInputCost.dividedBy(actualYield);

    const candidateRuns = await prepRunRepository.findRecentForRollingAverage(
      organizationId,
      input.outputItemId,
      ROLLING_AVERAGE_MAX_RUNS,
    );
    const typicalYieldAtRunTime = computeTypicalYield(candidateRuns);
    const { yieldVarianceLabel, notifiedStoreManager } = computeYieldVariance(actualYield, typicalYieldAtRunTime);

    const createInput: CreatePrepRunRepoInput = {
      outputItemId: input.outputItemId,
      actualYield,
      outputUnitCost,
      totalInputCost,
      typicalYieldAtRunTime,
      yieldVarianceLabel,
      notifiedStoreManager,
      locationId: centralStore.id,
      createdById: actor.id,
      inputLines: inputLineData.map((l) => ({
        inputItemId: l.inputItemId,
        quantity: l.quantity,
        unitCostAtRunTime: l.unitCostAtRunTime,
        lineCost: l.lineCost,
      })),
    };

    const created = await prisma
      .$transaction(async (tx) => {
        const prepRun = await prepRunRepository.create(organizationId, createInput, tx);

        // N PREP_CONSUME rows — quantity NEGATIVE-signed. First negative-signed
        // ledger writer in this codebase (on-hand is a plain _sum(quantity) —
        // inventory-repository.ts's sumOnHandByItemForLocation); WASTE/
        // ADJUSTMENT will need to match this sign precedent later.
        for (const line of inputLineData) {
          await tx.inventoryTransaction.create({
            data: {
              organizationId,
              locationId: centralStore.id,
              inventoryItemId: line.inputItemId,
              type: 'PREP_CONSUME',
              quantity: line.quantity.negated(),
              unitCost: line.unitCostAtRunTime,
              prepRecordId: prepRun.id,
              userId: actor.id,
            },
          });
          // No InventoryItem.currentCost write for input items — consuming
          // stock never changes what it costs (explicit non-write, plan §1.2).
        }

        // 1 PREP_PRODUCE row for the output — positive-signed.
        await tx.inventoryTransaction.create({
          data: {
            organizationId,
            locationId: centralStore.id,
            inventoryItemId: input.outputItemId,
            type: 'PREP_PRODUCE',
            quantity: actualYield,
            unitCost: outputUnitCost,
            prepRecordId: prepRun.id,
            userId: actor.id,
          },
        });

        // Latest-price costing on the output only, no averaging (Milestone
        // Two precedent, receiving-service.ts:1000-1003).
        await tx.inventoryItem.update({
          where: { id: input.outputItemId },
          data: { currentCost: outputUnitCost },
        });

        return prepRunRepository.findById(prepRun.id, organizationId, tx);
      })
      .catch((error: unknown) => mapPrismaError(error));

    if (!created) throw new NotFoundError('Prep run not found');
    return serializePrepRunDetail(created);
  },
};
