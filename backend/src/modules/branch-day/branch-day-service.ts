import type { Request } from 'express';
import { Prisma, type DepartmentTag } from '@prisma/client';
import {
  branchDayRepository,
  type BranchDayDepartmentFull,
  type BranchDayFull,
  type DepartmentItem,
  type LineWrite,
} from './branch-day-repository';
import { hasGap, isDirectorAlert, isReasonRequired, lineVariance, lineVarianceValue, reasonSatisfied } from './branch-day-calc';
import { GAP_REASON_LABEL } from './branch-day-validators';
import { referenceCounterRepository } from '../inventory/receiving-repository';
import { getBranchThresholdsInForce, getHubThresholdsInForce } from '../inventory/thresholds-service';
import { requireHubOrgId } from '../inventory/stock-scope';
import { departmentLabel as departmentLabelOf } from '../inventory/stock-service';
import { toMoney } from '../inventory/count-calc';
import { authRepository } from '../../repositories/auth-repository';
import { prisma } from '../../config/database';
import { fcmService } from '../../services/fcm-service';
import { comparePin } from '../../utils/password';
import { formatDateOnly, getTodayDateOnly } from '../../utils/date-only';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors';
import type {
  BranchDayToday,
  CloseBlocker,
  CloseDayInput,
  CloseResult,
  DayDocument,
  DepartmentDayDetail,
  DepartmentDaySummary,
  DepartmentLine,
  ReopenDayInput,
  ReopenResult,
  SaveDepartmentLinesInput,
  SaveLinesResult,
} from './branch-day.types';

type Actor = NonNullable<Request['user']>;

const ZERO = new Prisma.Decimal(0);

const requireBranchManager = (actor: Actor): string => {
  if (actor.role !== 'MANAGER' || actor.isDepartmentHead) throw new ForbiddenError('Only the Branch Manager works the branch day');
  if (!actor.organizationId) throw new ValidationError('Branch context missing for this user');
  return actor.organizationId;
};

/** Verifies the actor's PIN and returns their display name (Actor carries no name). */
const verifyPin = async (actorId: string, pin: string): Promise<string> => {
  const user = await authRepository.findUserByIdWithPassword(actorId);
  if (!user || !user.pinHash) throw new UnauthorizedError('No PIN is set for this account');
  if (!(await comparePin(pin, user.pinHash))) throw new UnauthorizedError('Incorrect PIN');
  return user.name;
};

const dayBefore = (date: Date): Date => new Date(date.getTime() - 24 * 60 * 60 * 1000);

/** Everything needed to derive a department's view, loaded once per request. */
type Context = {
  hubOrgId: string;
  branchOrgId: string;
  reasonRequiredKes: number;
  blocking: Map<DepartmentTag, { id: string; sequenceLabel: string }[]>;
  dayLineIds: string[];
};

const buildContext = async (day: BranchDayFull): Promise<Context> => {
  const [hubOrgId, thresholds, dispatches] = await Promise.all([
    requireHubOrgId(),
    getBranchThresholdsInForce(day.organizationId),
    branchDayRepository.inTransitDispatches(day.organizationId),
  ]);
  const blocking = new Map<DepartmentTag, { id: string; sequenceLabel: string }[]>();
  for (const d of dispatches) {
    const list = blocking.get(d.departmentTag) ?? [];
    list.push({ id: d.id, sequenceLabel: d.sequenceLabel });
    blocking.set(d.departmentTag, list);
  }
  return {
    hubOrgId,
    branchOrgId: day.organizationId,
    reasonRequiredKes: thresholds.reasonRequiredKes,
    blocking,
    dayLineIds: day.departments.flatMap((d) => d.lines.map((l) => l.id)),
  };
};

type DepartmentView = { summary: DepartmentDaySummary; lines: DepartmentLine[]; itemIds: string[] };

/**
 * One department's rows. An OPEN day merges the live item set with saved lines
 * (a saved line keeps its snapshot; an uncounted item shows the live expected
 * figure). A CLOSED day shows only what was counted and signed.
 */
const buildDepartmentView = async (ctx: Context, day: BranchDayFull, dept: BranchDayDepartmentFull): Promise<DepartmentView> => {
  const closed = day.status === 'CLOSED';
  const saved = new Map(dept.lines.map((l) => [l.inventoryItemId, l]));

  let items: DepartmentItem[];
  if (closed) {
    const catalog = await branchDayRepository.departmentItems(ctx.hubOrgId, ctx.branchOrgId, dept.locationId, dept.departmentTag);
    const byId = new Map(catalog.map((i) => [i.id, i]));
    const missing = dept.lines.map((l) => l.inventoryItemId).filter((id) => !byId.has(id));
    const extra = missing.length ? await branchDayRepository.itemsByIds(ctx.hubOrgId, missing) : [];
    items = [...catalog.filter((i) => saved.has(i.id)), ...extra];
  } else {
    items = await branchDayRepository.departmentItems(ctx.hubOrgId, ctx.branchOrgId, dept.locationId, dept.departmentTag);
  }

  const unsaved = items.filter((i) => !saved.has(i.id)).map((i) => i.id);
  const [live, costs] = closed
    ? [new Map<string, Prisma.Decimal>(), new Map<string, Prisma.Decimal>()]
    : await Promise.all([
        branchDayRepository.onHandExcludingDay(ctx.branchOrgId, dept.locationId, unsaved, ctx.dayLineIds),
        branchDayRepository.latestInboundCosts(ctx.branchOrgId, dept.locationId, unsaved),
      ]);

  const lines: DepartmentLine[] = items.map((item) => {
    const line = saved.get(item.id);
    const expected = line ? line.expectedQty : (live.get(item.id) ?? ZERO);
    const unitCost = line ? line.unitCost : (costs.get(item.id) ?? item.currentCost);
    const counted = line?.countedQty ?? null;
    const gap = lineVariance(counted, expected);
    const value = lineVarianceValue(gap, unitCost);
    return {
      inventoryItemId: item.id,
      name: item.name,
      usageUnit: item.usageUnit,
      expectedQty: expected.toString(),
      countedQty: counted?.toString() ?? null,
      gap: gap?.toString() ?? null,
      gapValue: value ? toMoney(value) : null,
      unitCost: unitCost.toString(),
      reasonRequired: line?.reasonRequired ?? false,
      reason: line?.reason ?? null,
      reasonNote: line?.reasonNote ?? null,
    };
  });

  const countedLines = lines.filter((l) => l.countedQty !== null);
  const gapsAboveThreshold = countedLines.filter((l) => l.reasonRequired && l.gap !== null && !new Prisma.Decimal(l.gap).isZero()).length;
  const net = countedLines.reduce((sum, l) => (l.gapValue ? sum.plus(l.gapValue) : sum), ZERO);
  const blockingDispatches = ctx.blocking.get(dept.departmentTag) ?? [];

  let status: DepartmentDaySummary['status'];
  if (closed) status = 'CLOSED';
  else if (blockingDispatches.length > 0) status = 'BLOCKED';
  else if (lines.length === 0 || countedLines.length === lines.length) status = 'COUNTED'; // no tagged items → auto-done (Q-D)
  else if (countedLines.length > 0) status = 'COUNTING';
  else status = 'NOT_STARTED';

  return {
    itemIds: items.map((i) => i.id),
    lines,
    summary: {
      tag: dept.departmentTag,
      name: departmentLabelOf(dept.departmentTag),
      status,
      blockingDispatches,
      countedBy: dept.countedBy,
      countedAt: dept.countedAt?.toISOString() ?? null,
      itemCount: lines.length,
      countedLines: countedLines.length,
      gapsAboveThreshold,
      netAdjustmentValue: toMoney(net),
    },
  };
};

const closeBlockersFor = (views: DepartmentView[]): CloseBlocker[] => {
  const blockers: CloseBlocker[] = [];
  for (const v of views) {
    const name = v.summary.name;
    if (v.summary.status === 'BLOCKED') {
      const label = v.summary.blockingDispatches.map((d) => d.sequenceLabel.split(' · ')[0]).join(', ');
      blockers.push({ code: 'BLOCKED', departmentTag: v.summary.tag, message: `${name} is blocked — ${label} is unconfirmed` });
    } else if (v.summary.status === 'NOT_STARTED' || v.summary.status === 'COUNTING') {
      blockers.push({
        code: 'NOT_COUNTED',
        departmentTag: v.summary.tag,
        message:
          v.summary.status === 'COUNTING'
            ? `${name} is still counting (${v.summary.countedLines} of ${v.summary.itemCount})`
            : `${name} has not been counted`,
      });
    }
    const unreasoned = v.lines.filter(
      (l) => l.countedQty !== null && l.reasonRequired && !reasonSatisfied(l.reason, l.reasonNote),
    );
    if (unreasoned.length > 0) {
      blockers.push({
        code: 'REASON_REQUIRED',
        departmentTag: v.summary.tag,
        message: `${name} has ${unreasoned.length} gap${unreasoned.length === 1 ? '' : 's'} without a reason`,
      });
    }
  }
  return blockers;
};

/** Get-or-create today's day for the branch (plan §2.3). Losing a creation race just re-reads the winner. */
const getOrCreateToday = async (branchOrgId: string): Promise<BranchDayFull> => {
  const today = getTodayDateOnly();
  const existing = await branchDayRepository.findByDate(branchOrgId, today);
  if (existing) return existing;

  const locations = await branchDayRepository.departmentLocations(branchOrgId);
  if (locations.length === 0) throw new NotFoundError('No department locations are configured for this branch');
  try {
    await prisma.$transaction(async (tx) => {
      const reference = await referenceCounterRepository.nextReference(tx, branchOrgId, 'DAY');
      await branchDayRepository.createDay(tx, {
        organizationId: branchOrgId,
        businessDate: today,
        reference,
        locations: locations.map((l) => ({ id: l.id, tag: l.departmentTag! })),
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
  }
  const created = await branchDayRepository.findByDate(branchOrgId, today);
  if (!created) throw new NotFoundError('Could not open today’s day');
  return created;
};

const loadDay = async (id: string, branchOrgId: string | null): Promise<BranchDayFull> => {
  const day = await branchDayRepository.findById(id, branchOrgId);
  if (!day) throw new NotFoundError('Branch day not found');
  return day;
};

const findDepartment = (day: BranchDayFull, tag: DepartmentTag): BranchDayDepartmentFull => {
  const dept = day.departments.find((d) => d.departmentTag === tag);
  if (!dept) throw new NotFoundError('Department not found for this branch day');
  return dept;
};

const toDetail = (day: BranchDayFull, ctx: Context, view: DepartmentView): DepartmentDayDetail => ({
  branchDayId: day.id,
  date: formatDateOnly(day.businessDate),
  dayStatus: day.status,
  closedAt: day.closedAt?.toISOString() ?? null,
  reasonRequiredKes: ctx.reasonRequiredKes,
  summary: view.summary,
  lines: view.lines,
});

const orderedDepartments = (day: BranchDayFull): BranchDayDepartmentFull[] => {
  const order: DepartmentTag[] = ['KITCHEN', 'PASTRY', 'BARISTA', 'SERVICE', 'HOUSEKEEPING'];
  return [...day.departments].sort((a, b) => order.indexOf(a.departmentTag) - order.indexOf(b.departmentTag));
};

export const branchDayService = {
  getToday: async (actor: Actor): Promise<BranchDayToday> => {
    const branchOrgId = requireBranchManager(actor);
    const day = await getOrCreateToday(branchOrgId);
    const ctx = await buildContext(day);
    const views = await Promise.all(orderedDepartments(day).map((d) => buildDepartmentView(ctx, day, d)));
    const blockers = day.status === 'OPEN' ? closeBlockersFor(views) : [];

    const yesterdayRow = await branchDayRepository.findByDate(branchOrgId, dayBefore(day.businessDate));
    return {
      id: day.id,
      reference: day.reference,
      date: formatDateOnly(day.businessDate),
      status: day.status,
      branchName: day.organization.name,
      closedAt: day.closedAt?.toISOString() ?? null,
      closedBy: day.closedBy,
      reopenCount: day.reopenCount,
      departments: views.map((v) => v.summary),
      yesterday: yesterdayRow
        ? {
            id: yesterdayRow.id,
            date: formatDateOnly(yesterdayRow.businessDate),
            status: yesterdayRow.status,
            closedAt: yesterdayRow.closedAt?.toISOString() ?? null,
            closedBy: yesterdayRow.closedBy,
          }
        : null,
      reasonRequiredKes: ctx.reasonRequiredKes,
      canClose: day.status === 'OPEN' && blockers.length === 0,
      closeBlockers: blockers,
    };
  },

  getDepartment: async (actor: Actor, id: string, tag: DepartmentTag): Promise<DepartmentDayDetail> => {
    const branchOrgId = requireBranchManager(actor);
    const day = await loadDay(id, branchOrgId);
    const ctx = await buildContext(day);
    return toDetail(day, ctx, await buildDepartmentView(ctx, day, findDepartment(day, tag)));
  },

  saveLines: async (actor: Actor, id: string, tag: DepartmentTag, input: SaveDepartmentLinesInput): Promise<SaveLinesResult> => {
    const branchOrgId = requireBranchManager(actor);
    const day = await loadDay(id, branchOrgId);
    if (day.status !== 'OPEN') throw new ConflictError('This day is closed — reopen it to change counts', 'DAY_CLOSED');
    const dept = findDepartment(day, tag);
    const ctx = await buildContext(day);
    if ((ctx.blocking.get(tag) ?? []).length > 0) {
      throw new ConflictError('This department has an unconfirmed dispatch — confirm it before counting', 'DEPARTMENT_BLOCKED');
    }

    const items = await branchDayRepository.departmentItems(ctx.hubOrgId, branchOrgId, dept.locationId, tag);
    const known = new Set(items.map((i) => i.id));
    const foreign = input.lines.filter((l) => !known.has(l.inventoryItemId));
    if (foreign.length > 0) throw new ValidationError('Some items are not counted by this department', 'ITEM_NOT_IN_DEPARTMENT', { itemIds: foreign.map((l) => l.inventoryItemId) });

    const existing = new Map(dept.lines.map((l) => [l.inventoryItemId, l]));
    const ids = input.lines.map((l) => l.inventoryItemId);
    const [live, costs] = await Promise.all([
      branchDayRepository.onHandExcludingDay(branchOrgId, dept.locationId, ids, ctx.dayLineIds),
      branchDayRepository.latestInboundCosts(branchOrgId, dept.locationId, ids),
    ]);
    const catalog = new Map(items.map((i) => [i.id, i]));

    const writes: LineWrite[] = [];
    for (const entry of input.lines) {
      const prior = existing.get(entry.inventoryItemId);
      const counted = entry.countedQty === null ? null : new Prisma.Decimal(entry.countedQty);
      if (!prior && counted === null) continue; // nothing to record for an untouched, uncounted item

      // Snapshot at the moment the count is saved (plan §1.4); a cleared count keeps its last snapshot.
      const expected = counted === null && prior ? prior.expectedQty : (live.get(entry.inventoryItemId) ?? ZERO);
      const unitCost = counted === null && prior ? prior.unitCost : (costs.get(entry.inventoryItemId) ?? catalog.get(entry.inventoryItemId)!.currentCost);
      const variance = lineVariance(counted, expected);
      const reasonRequired = isReasonRequired(variance, unitCost, ctx.reasonRequiredKes);
      writes.push({
        inventoryItemId: entry.inventoryItemId,
        countedQty: counted,
        expectedQty: expected,
        unitCost,
        reasonRequired,
        // A reason only means something on a required line; anything else is dropped so stale reasons never linger.
        reason: reasonRequired ? (entry.reason ?? null) : null,
        reasonNote: reasonRequired && entry.reason ? (entry.reasonNote?.trim() || null) : null,
      });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await branchDayRepository.upsertLines(tx, dept.id, writes);
      const savedCount = await tx.branchDayLine.count({ where: { branchDayDepartmentId: dept.id, countedQty: { not: null } } });
      const complete = savedCount >= items.length;
      await branchDayRepository.setDepartmentStatus(tx, dept.id, complete ? 'COUNTED' : 'NOT_STARTED', actor.id, savedCount > 0 ? now : null);
    });

    const fresh = await loadDay(id, branchOrgId);
    const freshCtx = await buildContext(fresh);
    const detail = toDetail(fresh, freshCtx, await buildDepartmentView(freshCtx, fresh, findDepartment(fresh, tag)));
    return { savedAt: now.toISOString(), detail };
  },

  close: async (actor: Actor, id: string, input: CloseDayInput): Promise<CloseResult> => {
    const branchOrgId = requireBranchManager(actor);
    const day = await loadDay(id, branchOrgId);
    if (day.status !== 'OPEN') throw new ConflictError('This day is already closed', 'DAY_CLOSED');

    const ctx = await buildContext(day);
    const views = await Promise.all(orderedDepartments(day).map((d) => buildDepartmentView(ctx, day, d)));
    const blockers = closeBlockersFor(views);
    if (blockers.length > 0) throw new ConflictError('The day is not ready to close', 'DAY_NOT_READY', { blockers });

    await verifyPin(actor.id, input.pin);

    const { directorAlertKes } = await getHubThresholdsInForce(ctx.hubOrgId);
    const now = new Date();
    let adjustmentCount = 0;
    let reversalCount = 0;
    let net = ZERO;
    const alertValues: Prisma.Decimal[] = [];

    await prisma.$transaction(async (tx) => {
      // A re-close reverses every adjustment the previous close left standing (Flow 12b): linked, equal and opposite.
      const active = await branchDayRepository.activeAdjustments(tx, branchOrgId, ctx.dayLineIds);
      const lineOwner = new Map<string, BranchDayDepartmentFull>();
      for (const d of day.departments) for (const l of d.lines) lineOwner.set(l.id, d);
      for (const original of active) {
        const reference = await referenceCounterRepository.nextReference(tx, branchOrgId, 'ADJ');
        await branchDayRepository.writeAdjustment(tx, {
          organizationId: branchOrgId,
          locationId: original.locationId,
          inventoryItemId: original.inventoryItemId,
          quantity: original.quantity.negated(),
          unitCost: original.unitCost,
          reason: `Reversal of ${original.reference ?? 'adjustment'} — day reopened`,
          branchDayLineId: original.branchDayLineId!,
          reference,
          userId: actor.id,
          reversesTransactionId: original.id,
        });
        reversalCount += 1;
      }

      for (const dept of day.departments) {
        for (const line of dept.lines) {
          if (line.countedQty === null || !hasGap(line.countedQty, line.expectedQty)) continue;
          const variance = lineVariance(line.countedQty, line.expectedQty)!;
          const reference = await referenceCounterRepository.nextReference(tx, branchOrgId, 'ADJ');
          const label = line.reason ? GAP_REASON_LABEL[line.reason] : 'End-of-day count';
          await branchDayRepository.writeAdjustment(tx, {
            organizationId: branchOrgId,
            locationId: dept.locationId,
            inventoryItemId: line.inventoryItemId,
            quantity: variance,
            unitCost: line.unitCost,
            reason: line.reason === 'OTHER' && line.reasonNote ? `${label}: ${line.reasonNote}` : label,
            branchDayLineId: line.id,
            reference,
            userId: actor.id,
          });
          adjustmentCount += 1;
          const value = lineVarianceValue(variance, line.unitCost)!;
          net = net.plus(value);
          if (isDirectorAlert(variance, line.unitCost, directorAlertKes)) alertValues.push(value);
        }
        await branchDayRepository.setDepartmentStatus(tx, dept.id, 'COUNTED', dept.countedById ?? actor.id, dept.countedAt ?? now);
      }
      await branchDayRepository.closeDay(tx, day.id, actor.id, now);
    });

    // After commit, fire-and-forget (plan §3) — never awaited inside the transaction.
    let directorNotified = false;
    if (alertValues.length > 0) {
      const largest = alertValues.reduce((a, b) => (a.abs().greaterThan(b.abs()) ? a : b));
      void fcmService.sendBranchDayDirectorAlertPush({
        dayId: day.id,
        reference: day.reference,
        branchName: day.organization.name,
        alertLineCount: alertValues.length,
        largestValueKes: toMoney(largest.abs()),
      });
      directorNotified = true;
    }

    return {
      id: day.id,
      reference: day.reference,
      status: 'CLOSED',
      closedAt: now.toISOString(),
      adjustmentCount,
      reversalCount,
      netAdjustmentValue: toMoney(net),
      directorNotified,
    };
  },

  /** MANAGER (own branch) or DIRECTOR (API only). The day returns to OPEN; the ledger is only touched by the next close. */
  reopen: async (actor: Actor, id: string, input: ReopenDayInput): Promise<ReopenResult> => {
    let day: BranchDayFull;
    if (actor.role === 'DIRECTOR') {
      day = await loadDay(id, null);
    } else {
      day = await loadDay(id, requireBranchManager(actor));
    }
    if (day.status !== 'CLOSED') throw new ConflictError('Only a closed day can be reopened', 'DAY_NOT_CLOSED');

    const { reopenCount } = await prisma.$transaction((tx) => branchDayRepository.reopenDay(tx, day.id, actor.id, input.reason));
    return { id: day.id, status: 'OPEN', reopenCount };
  },

  getDocument: async (actor: Actor, id: string): Promise<DayDocument> => {
    const branchOrgId = requireBranchManager(actor);
    const day = await loadDay(id, branchOrgId);
    if (day.status !== 'CLOSED' || !day.closedAt || !day.closedBy) throw new ConflictError('The day has not been closed', 'DAY_NOT_CLOSED');

    const ctx = await buildContext(day);
    const views = await Promise.all(orderedDepartments(day).map((d) => buildDepartmentView(ctx, day, d)));
    return {
      id: day.id,
      reference: day.reference,
      date: formatDateOnly(day.businessDate),
      branchName: day.organization.name,
      branchAddress: `${day.organization.address}, ${day.organization.city}`,
      branchPhone: day.organization.phone,
      openedAt: day.createdAt.toISOString(),
      closedAt: day.closedAt.toISOString(),
      closedBy: day.closedBy,
      reopenCount: day.reopenCount,
      departments: views.map((v) => ({
        tag: v.summary.tag,
        name: v.summary.name,
        items: v.summary.itemCount,
        gaps: v.summary.gapsAboveThreshold,
        status: 'Closed' as const,
      })),
      totals: {
        items: views.reduce((n, v) => n + v.summary.itemCount, 0),
        gapLines: views.reduce((n, v) => n + v.summary.gapsAboveThreshold, 0),
        netAdjustmentValue: toMoney(views.reduce((sum, v) => sum.plus(v.summary.netAdjustmentValue), ZERO)),
      },
    };
  },
};
