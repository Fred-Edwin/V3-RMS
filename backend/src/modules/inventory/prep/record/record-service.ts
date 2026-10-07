import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ConflictError, NotFoundError } from '../../../../utils/errors';
import { mapPrismaError } from '../../../../utils/prisma-errors';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { blindnessOf } from '../../_shared/blind-rule';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { expectedYieldFor, judgeYield, pastRunsExpected, vsUsualFor, type YieldJudgement } from '../_shared/expected-yield';
import { PAST_RUNS_MAX, PAST_RUNS_WINDOW_DAYS } from '../_shared/prep-constants';
import type { CheckResult } from '../_shared/prep-contract';
import { exceedsStock, hasStockFlag } from '../_shared/prep-flags';
import { prepRecipeReader, type PrepRecipeRead } from '../_shared/prep-recipe-reader';
import { prepRunRepository, type PrepItemRow } from '../_shared/prep-run-repository';
import { decimalOut, serializeRunDetail } from '../_shared/prep-run-serializer';
import { nairobiDayRange } from '../_shared/prep-time';
import { assertValidInputs, expectedBasisFor, findRepeat, typoNote, usualRecipeText, type ExpectedBasis, type RunInput } from './record-logic';
import { recordRepository } from './record-repository';
import type { AssessedLine, RecordOutcome } from './record.types';
import type { CheckRequest, RecordRequest } from './record-validators';

type Actor = NonNullable<Request['user']>;
type Client = typeof prisma | Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const toInputs = (lines: CheckRequest['inputs']): RunInput[] => lines.map((l) => ({ itemId: l.itemId, quantity: D(l.quantity) }));

/** Loads the output and the ingredients (live, in this site): 404 when missing, 409 when retired. */
const loadItems = async (siteId: string, outputItemId: string, inputs: readonly RunInput[]): Promise<{ output: PrepItemRow; byId: Map<string, PrepItemRow> }> => {
  const rows = await prepRunRepository.findItems(siteId, [outputItemId, ...inputs.map((i) => i.itemId)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const output = byId.get(outputItemId);
  if (!output || output.type !== 'PREPPED') throw new NotFoundError('Output item not found');
  if (output.deletedAt) throw new ConflictError('This item is retired');
  for (const line of inputs) {
    const item = byId.get(line.itemId);
    if (!item) throw new NotFoundError('An ingredient was not found');
    if (item.deletedAt) throw new ConflictError(`${item.name} is retired`);
  }
  return { output, byId };
};

type Assessment = {
  basis: ExpectedBasis;
  recipe: PrepRecipeRead | null;
  judgement: YieldJudgement | null;
  lines: AssessedLine[];
  totalInputCost: Prisma.Decimal;
  stockFlag: boolean;
  repeatOf: { id: string; reference: string; at: string } | null;
};

/** Everything the live check and the recording both judge a run by, read from one place. */
const assess = async (args: {
  siteId: string;
  locationId: string;
  output: PrepItemRow;
  byId: Map<string, PrepItemRow>;
  inputs: readonly RunInput[];
  made: Prisma.Decimal | null;
  now: Date;
  client: Client;
}): Promise<Assessment> => {
  const { siteId, output, inputs, made, now, client } = args;
  const day = nairobiDayRange(now);
  const [recipe, pastRuns, sameDay, onHand] = await Promise.all([
    prepRecipeReader.readCurrent(siteId, output.id, client),
    prepRunRepository.recentRecordedYields(siteId, output.id, PAST_RUNS_MAX, client),
    prepRunRepository.recordedRunsBetween(siteId, output.id, day.start, day.end, client),
    recordRepository.onHandByItem(siteId, args.locationId, inputs.map((i) => i.itemId), client),
  ]);

  const basis = expectedBasisFor({ recipe, inputs, pastRuns, now });
  const lines: AssessedLine[] = inputs.map((line) => {
    const item = args.byId.get(line.itemId)!;
    const stock = onHand.get(line.itemId) ?? D(0);
    return {
      itemId: line.itemId,
      item,
      quantity: line.quantity,
      onHand: stock,
      unitCost: item.currentCost,
      lineCost: line.quantity.times(item.currentCost).toDecimalPlaces(2),
      exceeds: exceedsStock(line.quantity, stock),
    };
  });
  const repeat = findRepeat(inputs, sameDay);

  return {
    basis,
    recipe,
    judgement: made ? judgeYield(made, basis.amount) : null,
    lines,
    totalInputCost: lines.reduce((sum, l) => sum.plus(l.lineCost), D(0)).toDecimalPlaces(2),
    stockFlag: hasStockFlag(lines.map((l) => ({ itemName: l.item.name, unit: l.item.usageUnit, quantity: l.quantity, onHand: l.onHand }))),
    repeatOf: repeat ? { id: repeat.id, reference: repeat.reference ?? '', at: repeat.createdAt.toISOString() } : null,
  };
};

const yieldLabel = (j: YieldJudgement | null): string | null =>
  !j || j.label === 'NO_BASIS' ? null : j.label === 'ON_TARGET' ? 'normal' : j.label === 'LOW' ? 'low yield' : 'high yield';

/** What the Prep-again tiles and the "Something else" picker show for each output: the usual figure and last time's amounts. */
const describeOutputs = async (siteId: string, ids: string[]) => {
  const [recipes, yields, latest] = await Promise.all([
    prepRecipeReader.readCurrentForItems(siteId, ids),
    prepRunRepository.recordedYieldsSince(siteId, ids, new Date(Date.now() - PAST_RUNS_WINDOW_DAYS * DAY_MS)),
    prepRunRepository.latestRecordedByOutput(siteId, ids),
  ]);
  const now = new Date();
  const latestBy = new Map(latest.map((r) => [r.outputItemId, r]));
  return (item: { id: string; usageUnit: string }) => {
    const recipe = recipes.get(item.id);
    const past = pastRunsExpected(yields.filter((y) => y.outputItemId === item.id), now);
    const expectedText = recipe
      ? expectedYieldFor(recipe.targetYield, item.usageUnit, 'RECIPE').text
      : past
        ? expectedYieldFor(past, item.usageUnit, 'PAST_RUNS').text
        : null;
    const last = latestBy.get(item.id);
    return {
      hasRecipe: recipe !== undefined,
      expectedText,
      lastRun: last ? { inputs: last.inputLines.map((l) => ({ itemId: l.inputItemId, quantity: decimalOut(l.quantity) })), made: decimalOut(last.actualYield) } : null,
      ingredientsText: last ? last.inputLines.map((l) => l.inputItem.name).join(', ') : '',
    };
  };
};

export const recordService = {
  /** #4 Every live prepped item, for "Something else". */
  outputs: async (actor: Actor) => {
    const siteId = await requireHubReader(actor);
    const items = await prepRunRepository.findLiveOutputs(siteId);
    const describe = await describeOutputs(siteId, items.map((i) => i.id));
    return {
      items: items.map((item) => {
        const d = describe(item);
        return { itemId: item.id, name: item.name, unit: item.usageUnit, hasRecipe: d.hasRecipe, expectedText: d.expectedText, lastRun: d.lastRun };
      }),
    };
  },

  /** #5 The 3 most-made outputs in the last 30 days, topped up from all time by most recent. */
  prepAgain: async (actor: Actor) => {
    const siteId = await requireHubReader(actor);
    const popular = await prepRunRepository.mostMadeSince(siteId, new Date(Date.now() - PAST_RUNS_WINDOW_DAYS * DAY_MS), 3);
    const filler = popular.length < 3 ? await prepRunRepository.mostRecentOutputs(siteId, popular, 3 - popular.length) : [];
    const ids = [...popular, ...filler];
    if (ids.length === 0) return { tiles: [] };
    const [rows, describe] = await Promise.all([prepRunRepository.findItems(siteId, ids), describeOutputs(siteId, ids)]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      tiles: ids.flatMap((id) => {
        const item = byId.get(id);
        if (!item) return [];
        const d = describe({ id, usageUnit: item.usageUnit });
        return [{ itemId: id, name: item.name, ingredientsText: d.ingredientsText, expectedText: d.expectedText, lastRun: d.lastRun }];
      }),
    };
  },

  /** #6 The live yield check. Reads only: nothing is written or logged. */
  check: async (actor: Actor, body: CheckRequest): Promise<CheckResult> => {
    const siteId = await requireHubActor(actor);
    const inputs = toInputs(body.inputs);
    const made = body.made !== undefined ? D(body.made) : null;
    assertValidInputs(body.outputItemId, inputs, made);
    const location = await recordRepository.findCentralStore(siteId);
    if (!location) throw new NotFoundError('No Central Store is configured');
    const { output, byId } = await loadItems(siteId, body.outputItemId, inputs);
    const a = await assess({ siteId, locationId: location.id, output, byId, inputs, made, now: new Date(), client: prisma });

    const unit = output.usageUnit;
    const blind = blindnessOf(actor);
    // NOTIFY (over 35%) is a manager flag; the Attendant is shown the WARN wording.
    const tier = a.judgement?.tier ?? null;
    const shownTier = tier === 'NOTIFY' && !actorCan(actor, 'prep.read_flags') ? 'WARN' : tier;
    return {
      expected: expectedYieldFor(a.basis.amount, unit, a.basis.source),
      vsUsual: made ? vsUsualFor(made, a.basis.amount, unit) : null,
      tier: shownTier,
      typoSuspect: typoNote(made, a.basis, unit),
      repeat: { duplicate: a.repeatOf !== null, of: a.repeatOf },
      usualRecipeText: usualRecipeText({ recipe: a.recipe, outputUnit: unit, inputs, expected: a.basis.amount }),
      mainIngredientMissing: a.basis.mainIngredientMissing,
      ...(actorCan(actor, 'prep.see_costs') && !blind.itemCosts
        ? { cost: { totalInput: decimalOut(a.totalInputCost), perUnit: made ? decimalOut(a.totalInputCost.dividedBy(made).toDecimalPlaces(4)) : null } }
        : {}),
      ...(!blind.stockFigures ? { stock: a.lines.map((l) => ({ itemId: l.itemId, onHand: decimalOut(l.onHand), exceeds: l.exceeds })) } : {}),
    };
  },

  /** #7 Record the run: one transaction, N ingredient rows out, one output row in, numbered PREP-nnnn. 200 when replayed. */
  record: async (actor: Actor, body: RecordRequest): Promise<RecordOutcome> => {
    const siteId = await requireHubActor(actor);

    const replay = async (): Promise<RecordOutcome | null> => {
      const existing = await prepRunRepository.findByIdempotencyKey(siteId, actor.id, body.idempotencyKey);
      return existing ? { run: serializeRunDetail(existing, actor), replayed: true } : null;
    };
    const already = await replay();
    if (already) return already;

    const inputs = toInputs(body.inputs);
    const made = D(body.made);
    assertValidInputs(body.outputItemId, inputs, made);
    const location = await recordRepository.findCentralStore(siteId);
    if (!location) throw new NotFoundError('No Central Store is configured');
    const { output, byId } = await loadItems(siteId, body.outputItemId, inputs);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const a = await assess({ siteId, locationId: location.id, output, byId, inputs, made, now, client: tx });
        const outputUnitCost = a.totalInputCost.dividedBy(made).toDecimalPlaces(4);
        const tier = a.judgement?.tier ?? null;
        const reference = await referenceCounterRepository.nextReference(tx, siteId, 'PREP');

        const run = await prepRunRepository.create(tx, {
          siteId,
          reference,
          idempotencyKey: body.idempotencyKey,
          outputItemId: output.id,
          actualYield: made,
          outputUnitCost,
          totalInputCost: a.totalInputCost,
          yieldVarianceLabel: yieldLabel(a.judgement),
          notifiedStoreManager: tier === 'NOTIFY',
          expectedYield: a.basis.amount,
          expectedSource: a.basis.source,
          recipeVersionId: a.basis.recipeVersionId,
          stockFlag: a.stockFlag,
          needsLook: (tier !== null && tier !== 'ON_TARGET') || a.stockFlag,
          yieldReason: body.yieldReason ?? null,
          reasonNote: body.reasonNote ?? null,
          locationId: location.id,
          createdById: actor.id,
          lines: a.lines.map((l) => ({ inputItemId: l.itemId, quantity: l.quantity, unitCostAtRunTime: l.unitCost, lineCost: l.lineCost, onHandAtRunTime: l.onHand })),
        });

        // N ingredient rows out and one output row in, all through the ledger door (it applies the sign).
        for (const line of a.lines) {
          await postStockMovement(tx, {
            type: 'PREP_CONSUME',
            locationId: location.id,
            inventoryItemId: line.itemId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            userId: actor.id,
            links: { prepRecordId: run.id },
          });
        }
        await postStockMovement(tx, {
          type: 'PREP_PRODUCE',
          locationId: location.id,
          inventoryItemId: output.id,
          quantity: made,
          unitCost: outputUnitCost,
          userId: actor.id,
          links: { prepRecordId: run.id },
        });
        await prepRunRepository.setItemCurrentCost(tx, siteId, output.id, outputUnitCost);
        return run;
      });
      return { run: serializeRunDetail(created, actor), replayed: false };
    } catch (error) {
      // Two taps racing past the check above: the unique index decided, so return the run that won.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const won = await replay();
        if (won) return won;
      }
      return mapPrismaError(error);
    }
  },
};
