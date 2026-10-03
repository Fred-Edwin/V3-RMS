import type { Request } from 'express';
import { Prisma, type StockCountStatus } from '@prisma/client';
import {
  countRepository,
  type CountLineWithItem,
  type CountSummaryRow,
  type CountWithRelations,
} from './count-repository';
import { referenceCounterRepository } from '../purchasing/receiving-repository';
import { getHubThresholdsInForce } from './thresholds-service';
import { resolveCentralStoreScope, type StockScope } from '../_shared/stock-scope';
import { isDirectorAlert, isReasonRequired, lineVariance, lineVarianceValue, toMoney } from './count-calc';
import {
  AttendantCountViewSchema,
  AttendantSaveResultSchema,
  AttendantSubmitResultSchema,
  COUNT_REASON_LABEL,
} from './count-validators';
import { authRepository } from '../../../repositories/auth-repository';
import { prisma } from '../../../config/database';
import { fcmService } from '../../../services/fcm-service';
import { comparePin } from '../../../utils/password';
import { formatDateOnly, getTodayDateOnly } from '../../../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../../utils/errors';
import type {
  ApproveCountResult,
  AttendantCountView,
  AttendantSaveResult,
  AttendantSubmitResult,
  CountList,
  CountListItem,
  CountPrint,
  CountTotals,
  DecideLineInput,
  ListCountsQuery,
  ReturnCountResult,
  SaveCountLinesInput,
  SpotCountInput,
  SpotCountResult,
  VerifierCountLine,
  VerifierCountView,
} from './count.types';
import type { TodaysCount } from '../stock/stock.types';

type Actor = NonNullable<Request['user']>;

const UNCATEGORIZED = 'Uncategorized';

const requireRole = (actor: Actor, role: 'STORE_ATTENDANT' | 'STORE_MANAGER'): void => {
  if (actor.role !== role || actor.isDepartmentHead) {
    throw new ForbiddenError('You do not have permission to perform this action');
  }
};

/** Verifies the actor's PIN and returns their display name (Actor carries no name). */
const verifyPin = async (actorId: string, pin: string): Promise<string> => {
  const user = await authRepository.findUserByIdWithPassword(actorId);
  if (!user || !user.pinHash) throw new UnauthorizedError('No PIN is set for this account');
  if (!(await comparePin(pin, user.pinHash))) throw new UnauthorizedError('Incorrect PIN');
  return user.name;
};

const dailyReference = (countDate: Date): string => {
  const [y, m, d] = formatDateOnly(countDate).split('-');
  return `CNT-${y}-${m}${d}`;
};

// --- Category tabs (top-level categories, plan §7 Q-C) ---------------------------

type CategoryMap = Map<string, { id: string; name: string; parentCategoryId: string | null }>;

const topLevelOf = (categoryId: string | null, categories: CategoryMap): { id: string | null; name: string } => {
  if (!categoryId) return { id: null, name: UNCATEGORIZED };
  const own = categories.get(categoryId);
  if (!own) return { id: null, name: UNCATEGORIZED };
  const parent = own.parentCategoryId ? categories.get(own.parentCategoryId) : undefined;
  const top = parent ?? own;
  return { id: top.id, name: top.name };
};

// --- Attendant (blind) view ----------------------------------------------------

const buildAttendantView = (count: CountWithRelations, categories: CategoryMap): AttendantCountView => {
  const tabs = new Map<string, { id: string | null; name: string; total: number; counted: number }>();
  for (const line of count.lines) {
    const top = topLevelOf(line.inventoryItem.categoryId, categories);
    const key = top.id ?? 'none';
    const tab = tabs.get(key) ?? { id: top.id, name: top.name, total: 0, counted: 0 };
    tab.total += 1;
    if (line.countedQty !== null) tab.counted += 1;
    tabs.set(key, tab);
  }
  const categoryList = [...tabs.values()].sort((a, b) =>
    a.id === null ? 1 : b.id === null ? -1 : a.name.localeCompare(b.name),
  );

  const visible =
    count.status === 'DRAFT'
      ? count.lines
      : count.status === 'RETURNED'
        ? count.lines.filter((l) => l.decision === 'QUERIED')
        : [];

  const view = {
    id: count.id,
    reference: count.reference,
    countDate: formatDateOnly(count.countDate),
    status: count.status,
    counterName: count.counter.name,
    totals: { counted: count.lines.filter((l) => l.countedQty !== null).length, total: count.lines.length },
    categories: categoryList,
    lines: visible.map((l) => ({
      inventoryItemId: l.inventoryItemId,
      name: l.inventoryItem.name,
      usageUnit: l.inventoryItem.usageUnit,
      categoryId: topLevelOf(l.inventoryItem.categoryId, categories).id,
      categoryName: topLevelOf(l.inventoryItem.categoryId, categories).name,
      countedQty: l.countedQty ? l.countedQty.toString() : null,
      editable: count.status === 'DRAFT' || (count.status === 'RETURNED' && l.decision === 'QUERIED'),
      queryNote: l.queryNote,
    })),
    savedAt: count.status === 'DRAFT' || count.status === 'RETURNED' ? count.updatedAt.toISOString() : null,
    submittedAt: count.counterSignedAt?.toISOString() ?? null,
    returnNote: count.status === 'RETURNED' ? count.returnNote : null,
    returnedAt: count.status === 'RETURNED' ? (count.returnedAt?.toISOString() ?? null) : null,
    returnedByName: count.status === 'RETURNED' ? (count.returnedBy?.name ?? null) : null,
  };
  // Parsed through the attendant schema: undeclared keys (expectedQty, variance…) are stripped.
  return AttendantCountViewSchema.parse(view);
};

// --- Verifier view ----------------------------------------------------------------

const serializeVerifierLine = (
  line: CountLineWithItem,
  categories: CategoryMap,
  directorAlertKes: number,
): VerifierCountLine => {
  const variance = lineVariance(line.countedQty, line.expectedQty);
  const value = lineVarianceValue(variance, line.unitCost);
  const adjustment = line.transactions[0];
  return {
    lineId: line.id,
    inventoryItemId: line.inventoryItemId,
    name: line.inventoryItem.name,
    usageUnit: line.inventoryItem.usageUnit,
    categoryName: topLevelOf(line.inventoryItem.categoryId, categories).name,
    countedQty: line.countedQty?.toString() ?? null,
    expectedQty: line.expectedQty?.toString() ?? null,
    variance: variance?.toString() ?? null,
    varianceValue: value ? toMoney(value) : null,
    unitCost: line.unitCost?.toString() ?? null,
    decision: line.decision,
    reason: line.reason,
    reasonNote: line.reasonNote,
    reasonRequired: line.reasonRequired,
    directorAlert: isDirectorAlert(variance, line.unitCost, directorAlertKes),
    queryNote: line.queryNote,
    firstCountedQty: line.firstCountedQty?.toString() ?? null,
    adjustmentReference: adjustment?.reference ?? null,
    adjustmentTransactionId: adjustment?.id ?? null,
  };
};

const computeTotals = (
  lines: { countedQty: Prisma.Decimal | null; expectedQty: Prisma.Decimal | null; unitCost: Prisma.Decimal | null; decision: string; reasonRequired?: boolean }[],
): CountTotals => {
  let counted = 0;
  let matched = 0;
  let varianceLines = 0;
  let aboveThreshold = 0;
  let queried = 0;
  let net = new Prisma.Decimal(0);
  for (const l of lines) {
    if (l.decision === 'QUERIED') queried += 1;
    if (l.countedQty === null) continue;
    counted += 1;
    const variance = lineVariance(l.countedQty, l.expectedQty);
    if (!variance) continue;
    if (variance.isZero()) {
      matched += 1;
      continue;
    }
    varianceLines += 1;
    if (l.reasonRequired) aboveThreshold += 1;
    net = net.plus(lineVarianceValue(variance, l.unitCost) ?? 0);
  }
  return {
    lines: counted,
    uncountedLines: lines.length - counted,
    matchedLines: matched,
    varianceLines,
    aboveThreshold,
    queriedLines: queried,
    netVarianceValue: toMoney(net),
  };
};

const buildVerifierView = (
  count: CountWithRelations,
  categories: CategoryMap,
  thresholds: { reasonRequiredKes: number; directorAlertKes: number },
): VerifierCountView => ({
  id: count.id,
  reference: count.reference,
  kind: count.kind,
  countDate: formatDateOnly(count.countDate),
  status: count.status,
  counter: count.counter,
  counterSignedAt: count.counterSignedAt?.toISOString() ?? null,
  verifier: count.verifier,
  verifiedAt: count.verifiedAt?.toISOString() ?? null,
  returnNote: count.returnNote,
  returnedAt: count.returnedAt?.toISOString() ?? null,
  directorNotified: count.directorNotified,
  totals: computeTotals(count.lines),
  thresholds,
  lines: count.lines.map((l) => serializeVerifierLine(l, categories, thresholds.directorAlertKes)),
});

const toCategoryMap = async (siteId: string): Promise<CategoryMap> =>
  new Map((await countRepository.listCategories(siteId)).map((c) => [c.id, c]));

const reasonText = (reason: keyof typeof COUNT_REASON_LABEL | null, note: string | null): string | null => {
  if (!reason) return null;
  return reason === 'OTHER' && note ? `Other: ${note}` : COUNT_REASON_LABEL[reason];
};

const summarize = (row: CountSummaryRow): CountListItem => {
  const totals = computeTotals(row.lines);
  return {
    id: row.id,
    reference: row.reference,
    kind: row.kind,
    countDate: formatDateOnly(row.countDate),
    status: row.status,
    counterName: row.counter.name,
    counterSignedAt: row.counterSignedAt?.toISOString() ?? null,
    verifierName: row.verifier?.name ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    itemCount: totals.lines,
    totalLines: row.lines.length,
    varianceLines: totals.varianceLines,
    adjustmentCount: row.lines.reduce((n, l) => n + l.transactions.length, 0),
    netVarianceValue: totals.netVarianceValue,
    directorNotified: row.directorNotified,
  };
};

// --- Shared: load a count in the actor's scope ---------------------------------------

const loadCount = async (scope: StockScope, id: string): Promise<CountWithRelations> => {
  const count = await countRepository.findById(id, scope.locationOrgId);
  if (!count || count.locationId !== scope.locationId) throw new NotFoundError('Count not found');
  return count;
};

const withThresholds = async (scope: StockScope) => getHubThresholdsInForce(scope.locationOrgId);

const loadVerifierView = async (scope: StockScope, id: string): Promise<VerifierCountView> => {
  const [count, categories, thresholds] = await Promise.all([
    loadCount(scope, id),
    toCategoryMap(scope.itemOrgId),
    withThresholds(scope),
  ]);
  return buildVerifierView(count, categories, thresholds);
};

/** Ledger adjustments for a set of lines, numbered ADJ-#### inside the caller's transaction. */
const writeAdjustments = async (
  tx: Prisma.TransactionClient,
  scope: StockScope,
  actorId: string,
  lines: { id: string; inventoryItemId: string; variance: Prisma.Decimal; unitCost: Prisma.Decimal; reason: string | null }[],
): Promise<void> => {
  for (const line of lines) {
    const reference = await referenceCounterRepository.nextReference(tx, scope.locationOrgId, 'ADJ');
    await tx.inventoryTransaction.create({
      data: {
        siteId: scope.locationOrgId,
        locationId: scope.locationId,
        inventoryItemId: line.inventoryItemId,
        type: 'ADJUSTMENT',
        quantity: line.variance,
        unitCost: line.unitCost,
        reason: line.reason,
        stockCountLineId: line.id,
        reference,
        userId: actorId,
      },
    });
  }
};

const notifyDirectors = (
  countId: string,
  reference: string,
  alertValues: Prisma.Decimal[],
): boolean => {
  if (alertValues.length === 0) return false;
  const largest = alertValues.reduce((a, b) => (a.abs().greaterThan(b.abs()) ? a : b));
  // After commit, fire-and-forget (plan §3) — never awaited inside the transaction.
  void fcmService.sendCountDirectorAlertPush({
    countId,
    reference,
    alertLineCount: alertValues.length,
    largestValueKes: toMoney(largest.abs()),
  });
  return true;
};

export const countService = {
  // ------------------------------------------------------------------------------
  // Summary hook (stock-service)
  // ------------------------------------------------------------------------------
  todaysCount: async (scope: StockScope): Promise<TodaysCount> => {
    const today = await countRepository.todaysDaily(scope.locationOrgId, scope.locationId, getTodayDateOnly());
    if (!today) {
      return { status: 'NOT_STARTED', countId: null, submittedAt: null, submittedByName: null, countedLines: null, totalLines: null };
    }
    return {
      status: today.status,
      countId: today.id,
      submittedAt: today.counterSignedAt?.toISOString() ?? null,
      submittedByName: today.status === 'DRAFT' ? null : today.counter.name,
      countedLines: today.countedLines,
      totalLines: today.totalLines,
    };
  },

  // ------------------------------------------------------------------------------
  // Attendant
  // ------------------------------------------------------------------------------

  /** Get-or-create today's DAILY draft and return the blind projection. */
  getToday: async (actor: Actor): Promise<AttendantCountView> => {
    requireRole(actor, 'STORE_ATTENDANT');
    const scope = await resolveCentralStoreScope(actor);
    const countDate = getTodayDateOnly();
    const items = await countRepository.listLiveCatalogItems(scope.itemOrgId);

    let count = await countRepository.findDaily(scope.locationOrgId, scope.locationId, countDate);
    if (!count) {
      try {
        const id = await prisma.$transaction((tx) =>
          countRepository.createDraft(
            {
              siteId: scope.locationOrgId,
              locationId: scope.locationId,
              countDate,
              reference: dailyReference(countDate),
              counterId: actor.id,
              itemIds: items.map((i) => i.id),
            },
            tx,
          ),
        );
        count = await countRepository.findById(id, scope.locationOrgId);
      } catch (error) {
        // Two attendants opening the day at once: the partial unique index picks one.
        count = await countRepository.findDaily(scope.locationOrgId, scope.locationId, countDate);
        if (!count) throw error;
      }
    } else if (count.status === 'DRAFT') {
      const have = new Set(count.lines.map((l) => l.inventoryItemId));
      const missing = items.filter((i) => !have.has(i.id)).map((i) => i.id);
      if (missing.length > 0) {
        await countRepository.addMissingLines(count.id, missing);
        count = await countRepository.findById(count.id, scope.locationOrgId);
      }
    }
    if (!count) throw new NotFoundError('Count not found');
    return buildAttendantView(count, await toCategoryMap(scope.itemOrgId));
  },

  getForAttendant: async (actor: Actor, id: string): Promise<AttendantCountView> => {
    requireRole(actor, 'STORE_ATTENDANT');
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.kind !== 'DAILY') throw new NotFoundError('Count not found');
    return buildAttendantView(count, await toCategoryMap(scope.itemOrgId));
  },

  /** Partial save. DRAFT: any line. RETURNED: queried lines only. */
  saveLines: async (actor: Actor, id: string, input: SaveCountLinesInput): Promise<AttendantSaveResult> => {
    requireRole(actor, 'STORE_ATTENDANT');
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.kind !== 'DAILY' || (count.status !== 'DRAFT' && count.status !== 'RETURNED')) {
      throw new ConflictError('This count can no longer be edited', 'COUNT_LOCKED');
    }
    const byItem = new Map(count.lines.map((l) => [l.inventoryItemId, l]));
    for (const entry of input.lines) {
      const line = byItem.get(entry.inventoryItemId);
      if (!line) throw new NotFoundError('Item is not on this count');
      if (count.status === 'RETURNED' && line.decision !== 'QUERIED') {
        throw new ConflictError('Only queried lines can be recounted', 'COUNT_LOCKED');
      }
    }

    const savedAt = await prisma.$transaction(async (tx) => {
      for (const entry of input.lines) {
        await countRepository.setLineCount(
          count.id,
          entry.inventoryItemId,
          entry.countedQty === null ? null : new Prisma.Decimal(entry.countedQty),
          tx,
        );
      }
      return countRepository.touch(count.id, tx);
    });

    const updated = new Map(input.lines.map((l) => [l.inventoryItemId, l.countedQty]));
    const counted = count.lines.filter((l) => {
      const next = updated.has(l.inventoryItemId) ? updated.get(l.inventoryItemId) : l.countedQty;
      return next !== null && next !== undefined;
    }).length;
    return AttendantSaveResultSchema.parse({ savedAt: savedAt.toISOString(), counted, total: count.lines.length });
  },

  /**
   * Sign & submit. Snapshots expectedQty = ledger on-hand *now* (the attendant's
   * sign), so movements between counting and verifying create no phantom
   * variance. Uncounted lines are left alone (never adjusted).
   */
  submit: async (actor: Actor, id: string, pin: string): Promise<AttendantSubmitResult> => {
    requireRole(actor, 'STORE_ATTENDANT');
    const actorName = await verifyPin(actor.id, pin);
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.kind !== 'DAILY' || (count.status !== 'DRAFT' && count.status !== 'RETURNED')) {
      throw new ConflictError('This count has already been submitted', 'COUNT_LOCKED');
    }

    const targets =
      count.status === 'DRAFT'
        ? count.lines.filter((l) => l.countedQty !== null)
        : count.lines.filter((l) => l.decision === 'QUERIED');
    if (count.status === 'DRAFT' && targets.length === 0) {
      throw new ConflictError('Count at least one item before you submit', 'NOTHING_COUNTED');
    }
    if (count.status === 'RETURNED' && targets.some((l) => l.countedQty === null)) {
      throw new ConflictError('Recount every queried line before you resubmit', 'RECOUNT_INCOMPLETE');
    }

    const thresholds = await withThresholds(scope);
    const onHand = await countRepository.onHandByItem(
      scope.locationOrgId,
      scope.locationId,
      targets.map((l) => l.inventoryItemId),
    );
    const signedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const moved = await countRepository.markSubmitted(
        count.id,
        scope.locationOrgId,
        [count.status],
        { counterId: actor.id, counterSignedAt: signedAt },
        tx,
      );
      if (moved === 0) throw new ConflictError('This count has already been submitted', 'COUNT_LOCKED');

      for (const line of targets) {
        const expected = onHand.get(line.inventoryItemId) ?? new Prisma.Decimal(0);
        const unitCost = line.inventoryItem.currentCost;
        const variance = lineVariance(line.countedQty, expected);
        await countRepository.writeSnapshot(
          line.id,
          {
            expectedQty: expected,
            unitCost,
            reasonRequired: isReasonRequired(variance, unitCost, thresholds.reasonRequiredKes),
            // A matching line needs no decision; a variance line waits for the Store Manager.
            decision: variance?.isZero() ? 'ACCEPTED' : 'PENDING',
          },
          tx,
        );
      }
    });

    // After commit, fire-and-forget (plan §3).
    void fcmService.sendCountSubmittedPush(scope.locationOrgId, {
      countId: count.id,
      reference: count.reference,
      counterName: actorName,
      countedLines: count.lines.filter((l) => l.countedQty !== null).length,
    });

    return AttendantSubmitResultSchema.parse({
      id: count.id,
      reference: count.reference,
      status: 'SUBMITTED' satisfies StockCountStatus,
      submittedAt: signedAt.toISOString(),
      counted: count.lines.filter((l) => l.countedQty !== null).length,
      total: count.lines.length,
    });
  },

  // ------------------------------------------------------------------------------
  // Store Manager
  // ------------------------------------------------------------------------------

  list: async (actor: Actor, query: ListCountsQuery): Promise<CountList> => {
    requireRole(actor, 'STORE_MANAGER');
    const scope = await resolveCentralStoreScope(actor);
    const rows = await countRepository.listSummaries(scope.locationOrgId, scope.locationId, {
      kind: query.kind,
      limit: query.limit,
    });
    return { counts: rows.map(summarize) };
  },

  getForVerifier: async (actor: Actor, id: string): Promise<VerifierCountView> => {
    requireRole(actor, 'STORE_MANAGER');
    const scope = await resolveCentralStoreScope(actor);
    const view = await loadVerifierView(scope, id);
    if (view.status === 'DRAFT') throw new ConflictError('The attendant has not submitted this count yet', 'COUNT_NOT_SUBMITTED');
    return view;
  },

  /** Accept / query / clear one line. Only while SUBMITTED. */
  decideLine: async (actor: Actor, id: string, lineId: string, input: DecideLineInput): Promise<VerifierCountView> => {
    requireRole(actor, 'STORE_MANAGER');
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.status !== 'SUBMITTED') throw new ConflictError('This count is not awaiting verification', 'COUNT_LOCKED');
    const line = count.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Count line not found');
    if (line.countedQty === null) throw new ConflictError('An uncounted line has nothing to decide', 'LINE_NOT_COUNTED');

    const accepting = input.decision === 'ACCEPTED';
    await countRepository.updateLineDecision(lineId, count.id, {
      decision: input.decision,
      reason: accepting ? (input.reason ?? null) : null,
      reasonNote: accepting && input.reason ? (input.reasonNote?.trim() || null) : null,
      queryNote: input.decision === 'QUERIED' ? (input.queryNote?.trim() || null) : null,
    });
    return loadVerifierView(scope, id);
  },

  /** Send back: only the queried lines reopen to the attendant, blind. */
  returnCount: async (actor: Actor, id: string, note: string | undefined): Promise<ReturnCountResult> => {
    requireRole(actor, 'STORE_MANAGER');
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.kind !== 'DAILY' || count.status !== 'SUBMITTED') {
      throw new ConflictError('This count is not awaiting verification', 'COUNT_LOCKED');
    }
    const queried = count.lines.filter((l) => l.decision === 'QUERIED');
    if (queried.length === 0) throw new ConflictError('Query at least one line before sending back', 'NO_QUERIED_LINES');

    await prisma.$transaction(async (tx) => {
      const moved = await countRepository.markReturned(
        count.id,
        scope.locationOrgId,
        { returnNote: note && note.length > 0 ? note : null, returnedAt: new Date(), returnedById: actor.id },
        tx,
      );
      if (moved === 0) throw new ConflictError('This count is not awaiting verification', 'COUNT_LOCKED');
      for (const line of queried) await countRepository.reopenQueriedLine(line.id, line.countedQty, tx);
    });
    return { count: await loadVerifierView(scope, id) };
  },

  /** Approve & sign: one ADJUSTMENT per accepted non-zero variance, all in one transaction. */
  approve: async (actor: Actor, id: string, pin: string): Promise<ApproveCountResult> => {
    requireRole(actor, 'STORE_MANAGER');
    await verifyPin(actor.id, pin);
    const scope = await resolveCentralStoreScope(actor);
    const count = await loadCount(scope, id);
    if (count.kind !== 'DAILY' || count.status !== 'SUBMITTED') {
      throw new ConflictError('This count is not awaiting verification', 'COUNT_LOCKED');
    }

    const queried = count.lines.filter((l) => l.decision === 'QUERIED');
    if (queried.length > 0) {
      throw new ConflictError('Send the queried lines back before approving', 'QUERIED_LINES', {
        lineIds: queried.map((l) => l.id),
      });
    }

    const counted = count.lines.filter((l) => l.countedQty !== null);
    const withVariance = counted.filter((l) => !lineVariance(l.countedQty, l.expectedQty)!.isZero());
    const undecided = withVariance.filter((l) => l.decision !== 'ACCEPTED');
    if (undecided.length > 0) {
      throw new ConflictError('Accept or query every variance line', 'LINES_UNDECIDED', { lineIds: undecided.map((l) => l.id) });
    }
    const needsReason = withVariance.filter(
      (l) => l.reasonRequired && (!l.reason || (l.reason === 'OTHER' && !(l.reasonNote ?? '').trim())),
    );
    if (needsReason.length > 0) {
      throw new ConflictError('A reason is required on lines above the threshold', 'REASON_REQUIRED', {
        lineIds: needsReason.map((l) => l.id),
      });
    }

    const { directorAlertKes } = await withThresholds(scope);
    const adjusting = withVariance.map((l) => {
      const variance = lineVariance(l.countedQty, l.expectedQty)!;
      const unitCost = l.unitCost ?? l.inventoryItem.currentCost;
      return { line: l, variance, unitCost, value: variance.times(unitCost) };
    });
    const alertValues = adjusting
      .filter((a) => isDirectorAlert(a.variance, a.unitCost, directorAlertKes))
      .map((a) => a.value);

    await prisma.$transaction(async (tx) => {
      const moved = await countRepository.markVerified(
        count.id,
        scope.locationOrgId,
        'SUBMITTED',
        { verifierId: actor.id, verifiedAt: new Date(), directorNotified: alertValues.length > 0 },
        tx,
      );
      if (moved === 0) throw new ConflictError('This count is not awaiting verification', 'COUNT_LOCKED');
      await writeAdjustments(
        tx,
        scope,
        actor.id,
        adjusting.map((a) => ({
          id: a.line.id,
          inventoryItemId: a.line.inventoryItemId,
          variance: a.variance,
          unitCost: a.unitCost,
          reason: reasonText(a.line.reason, a.line.reasonNote),
        })),
      );
    });

    const directorNotified = notifyDirectors(count.id, count.reference, alertValues);
    const net = adjusting.reduce((sum, a) => sum.plus(a.value), new Prisma.Decimal(0));
    return {
      count: await loadVerifierView(scope, id),
      adjustmentsWritten: adjusting.length,
      netAdjustmentValue: toMoney(net),
      directorNotified,
    };
  },

  /** Spot count: created VERIFIED, adjustments written, in one step (plan §2.2). */
  createSpotCount: async (actor: Actor, input: SpotCountInput): Promise<SpotCountResult> => {
    requireRole(actor, 'STORE_MANAGER');
    await verifyPin(actor.id, input.pin);
    const scope = await resolveCentralStoreScope(actor);
    const thresholds = await withThresholds(scope);

    const items = await countRepository.listLiveCatalogItems(scope.itemOrgId);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const onHand = await countRepository.onHandByItem(
      scope.locationOrgId,
      scope.locationId,
      input.lines.map((l) => l.inventoryItemId),
    );

    const prepared = input.lines.map((entry) => {
      const item = itemById.get(entry.inventoryItemId);
      if (!item) throw new NotFoundError('Inventory item not found');
      const countedQty = new Prisma.Decimal(entry.countedQty);
      const expectedQty = onHand.get(item.id) ?? new Prisma.Decimal(0);
      const variance = countedQty.minus(expectedQty);
      const reasonRequired = isReasonRequired(variance, item.currentCost, thresholds.reasonRequiredKes);
      return { entry, item, countedQty, expectedQty, variance, reasonRequired };
    });

    const missing = prepared.filter((p) => p.reasonRequired && !p.entry.reason);
    if (missing.length > 0) {
      throw new ConflictError('A reason is required on lines above the threshold', 'REASON_REQUIRED', {
        itemIds: missing.map((p) => p.item.id),
      });
    }

    const alertValues = prepared
      .filter((p) => isDirectorAlert(p.variance, p.item.currentCost, thresholds.directorAlertKes))
      .map((p) => p.variance.times(p.item.currentCost));
    const at = new Date();

    const createdId = await prisma.$transaction(async (tx) => {
      const reference = await referenceCounterRepository.nextReference(tx, scope.locationOrgId, 'SPT');
      const created = await countRepository.createVerifiedSpot(
        {
          siteId: scope.locationOrgId,
          locationId: scope.locationId,
          countDate: getTodayDateOnly(),
          reference,
          actorId: actor.id,
          at,
          directorNotified: alertValues.length > 0,
          lines: prepared.map((p) => ({
            inventoryItemId: p.item.id,
            countedQty: p.countedQty,
            expectedQty: p.expectedQty,
            unitCost: p.item.currentCost,
            reasonRequired: p.reasonRequired,
            reason: p.entry.reason ?? null,
            reasonNote: p.entry.reason ? (p.entry.reasonNote?.trim() || null) : null,
          })),
        },
        tx,
      );
      const lineIdByItem = new Map(created.lines.map((l) => [l.inventoryItemId, l.id]));
      await writeAdjustments(
        tx,
        scope,
        actor.id,
        prepared
          .filter((p) => !p.variance.isZero())
          .map((p) => ({
            id: lineIdByItem.get(p.item.id)!,
            inventoryItemId: p.item.id,
            variance: p.variance,
            unitCost: p.item.currentCost,
            reason: reasonText(p.entry.reason ?? null, p.entry.reasonNote ?? null),
          })),
      );
      return { id: created.id, reference };
    });

    const directorNotified = notifyDirectors(createdId.id, createdId.reference, alertValues);
    const adjusted = prepared.filter((p) => !p.variance.isZero());
    return {
      count: await loadVerifierView(scope, createdId.id),
      adjustmentsWritten: adjusted.length,
      netAdjustmentValue: toMoney(adjusted.reduce((s, p) => s.plus(p.variance.times(p.item.currentCost)), new Prisma.Decimal(0))),
      directorNotified,
    };
  },

  print: async (actor: Actor, id: string): Promise<CountPrint> => {
    requireRole(actor, 'STORE_MANAGER');
    const scope = await resolveCentralStoreScope(actor);
    const [count, thresholds] = await Promise.all([loadCount(scope, id), withThresholds(scope)]);
    if (count.status === 'DRAFT') throw new ConflictError('The attendant has not submitted this count yet', 'COUNT_NOT_SUBMITTED');

    const withValue = count.lines
      .map((l) => {
        const variance = lineVariance(l.countedQty, l.expectedQty);
        return { line: l, variance, value: lineVarianceValue(variance, l.unitCost) };
      })
      .filter((x): x is { line: CountLineWithItem; variance: Prisma.Decimal; value: Prisma.Decimal } =>
        x.variance !== null && x.value !== null && !x.variance.isZero(),
      );
    const byAbs = [...withValue].sort((a, b) => b.value.abs().comparedTo(a.value.abs()));
    const adjusted = byAbs.filter((x) => x.line.transactions.length > 0);

    return {
      reference: count.reference,
      kind: count.kind,
      countDate: formatDateOnly(count.countDate),
      status: count.status,
      locationName: scope.location.name,
      totals: computeTotals(count.lines),
      adjustments: adjusted.map((x) => ({
        itemName: x.line.inventoryItem.name,
        usageUnit: x.line.inventoryItem.usageUnit,
        variance: x.variance.toString(),
        reference: x.line.transactions[0]!.reference ?? '',
        value: toMoney(x.value),
        reason: reasonText(x.line.reason, x.line.reasonNote),
      })),
      directorAlertItems: byAbs
        .filter((x) => isDirectorAlert(x.variance, x.line.unitCost, thresholds.directorAlertKes))
        .map((x) => ({ itemName: x.line.inventoryItem.name, variance: x.variance.toString(), usageUnit: x.line.inventoryItem.usageUnit })),
      directorNotified: count.directorNotified,
      counter: {
        name: count.counter.name,
        roleLabel: count.kind === 'DAILY' ? 'Store Attendant' : 'Store Manager',
        signedAt: count.counterSignedAt?.toISOString() ?? null,
      },
      verifier: count.verifier
        ? { name: count.verifier.name, roleLabel: 'Store Manager', signedAt: count.verifiedAt?.toISOString() ?? null }
        : null,
      generatedAt: new Date().toISOString(),
    };
  },
};
