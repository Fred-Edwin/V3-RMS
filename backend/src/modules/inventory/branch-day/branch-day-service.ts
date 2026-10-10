import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import { actorCan, type Capability } from '../_shared/central-store-access';
import { referenceCounterRepository } from '../_shared/reference-counter';
import { countPin } from '../counting/_shared/count-pin';
import { dayAsDate, nairobiDay } from '../counting/_shared/count-time';
import { deliveriesRepository } from '../deliveries/deliveries-repository';
import { postStockMovement } from '../stock/ledger/ledger-door';
import { addDays } from '../stock/_shared/nairobi-time';
import {
  CORRECTION_REASON_TEXT,
  daySheetSchema,
  type AcceptOpeningInput,
  type ActivityQuery,
  type CloseDayInput,
  type CloseDayResult,
  type CloseSummary,
  type CorrectCountInput,
  type CorrectCountResult,
  type CountQuery,
  type CountView,
  type DayActivity,
  type DayActivityEntry,
  type DayDocuments,
  type DayEntries,
  type DayFile,
  type DaySheet,
  type DepartmentFigures as DepartmentFiguresWire,
  type DepartmentTile,
  type EntriesQuery,
  type History,
  type HistoryQuery,
  type Home,
  type MyDay,
  type MyHistory,
  type MyHistoryQuery,
  type OpeningQuery,
  type OpeningResult,
  type OpeningView,
  type RecountOpeningInput,
  type RecountPreview,
  type RecountPreviewInput,
  type SaveCountInput,
  type SaveCountResult,
  type SheetQuery,
  type SignCountInput,
  type SignCountResult,
  type Today,
  type TodayQuery,
} from './_shared/branch-day-contract';
import { branchDayError } from './branch-day-errors';
import { closingValueOf, departmentFigures, openingOf, usedValueOf, type DepartmentFigures } from './branch-day-figures';
import { branchDayRepository as repo, type Db, type DayRecord, type DepartmentRow, type Person, type StaffRow } from './branch-day-repository';
import {
  blockersOf,
  canCloseOf,
  correctionWindowOpen,
  dateText,
  dayWindow,
  differenceOf,
  homeActionOf,
  isCounted,
  money,
  qty,
  summaryOf,
  usageEntryQty,
  valueOf,
  zero,
} from './branch-day-rules';
import {
  describeCountCorrected,
  describeCorrectionDetail,
  describeCountSigned,
  describeDayClosed,
  describeOpeningAccepted,
  describeOpeningRecounted,
  kesText,
} from './branch-day-sentences';
import { buildSheet, sheetPageCount } from './branch-day-sheet';
import {
  branchRefOf,
  countStateOf,
  countViewOf,
  dayDocumentOf,
  dayHeadOf,
  deliveryFactOf,
  departmentRefOf,
  figureLineOf,
  ledgerEntryOf,
  openingCheckOf,
  openingDifferencesOf,
  openingStateOf,
  openingViewOf,
  person,
  tileOf,
  totalsOf,
  wireDepartmentId,
} from './branch-day-view';
import type { Actor } from './branch-day.types';

const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const;
const pad4 = (n: number): string => String(n).padStart(4, '0');
const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

// --- Who is calling ---------------------------------------------------------------------------------------------------------------------

const loadStaff = async (actor: Actor): Promise<StaffRow> => {
  const staff = await repo.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  return staff;
};

interface DepartmentCaller {
  actor: Actor;
  staff: StaffRow;
  branchId: string;
  departmentId: string;
  /** The Branch Manager is counting for a department of the branch (recorded "on behalf"). */
  onBehalf: boolean;
}

/**
 * The department rule (contract §5.7): an active user whose `department_id` names an ACTIVE department of their own branch. A holder of
 * `branch_day.read` or `read_any_branch` is never a department. The Branch Manager (`branch_day.count_on_behalf`) names a department of
 * their own branch; anything else is `NOT_YOUR_BRANCH`.
 */
const departmentCaller = async (actor: Actor, requested: string | undefined, allowOnBehalf: boolean): Promise<DepartmentCaller> => {
  const staff = await loadStaff(actor);
  if (allowOnBehalf && actorCan(actor, 'branch_day.count_on_behalf')) {
    if (!staff.siteId) throw new ValidationError('Branch context missing for this user');
    if (!requested) throw new ValidationError('Say which department to count (departmentId)');
    const dept = await repo.findDepartment(staff.siteId, requested);
    if (!dept) throw branchDayError('NOT_YOUR_BRANCH', 'That department is not part of your branch.');
    return { actor, staff, branchId: staff.siteId, departmentId: dept.id, onBehalf: true };
  }
  if (actorCan(actor, 'branch_day.read') || actorCan(actor, 'branch_day.read_any_branch') || !staff.siteId || !staff.departmentId) {
    throw branchDayError('NOT_YOUR_DEPARTMENT', 'Only a department head or member counts a department.');
  }
  if (requested && requested !== staff.departmentId) throw branchDayError('NOT_YOUR_DEPARTMENT', 'That is another department.');
  const [dept, site] = await Promise.all([repo.findDepartment(staff.siteId, staff.departmentId), repo.findSite(staff.siteId)]);
  if (!dept || dept.status !== 'ACTIVE' || !site || site.isHub) throw branchDayError('NOT_YOUR_DEPARTMENT', 'Your department is not active.');
  return { actor, staff, branchId: staff.siteId, departmentId: dept.id, onBehalf: false };
};

interface Reader {
  actor: Actor;
  staff: StaffRow;
  /** The caller's own branch (a Branch Manager). */
  own: string | null;
  /** Reads every branch (Director, Accountant, Store Manager, System Admin). */
  anyBranch: boolean;
  seeCosts: boolean;
}

const loadReader = async (actor: Actor): Promise<Reader> => {
  const anyBranch = actorCan(actor, 'branch_day.read_any_branch');
  if (!anyBranch && !actorCan(actor, 'branch_day.read')) throw new ForbiddenError('You do not have permission to read the Branch day');
  const staff = await loadStaff(actor);
  if (!anyBranch && !staff.siteId) throw new ValidationError('Branch context missing for this user');
  return { actor, staff, own: staff.siteId, anyBranch, seeCosts: actorCan(actor, 'catalog.see_costs') };
};

const requireCapability = (actor: Actor, capability: Capability, message: string): void => {
  if (!actorCan(actor, capability)) throw new ForbiddenError(message);
};

const assertBranch = (reader: Reader, siteId: string): void => {
  if (!reader.anyBranch && reader.own !== siteId) throw branchDayError('NOT_YOUR_BRANCH', 'That is another branch.');
};

/** One day by id: found among the active branches, then refused with `NOT_YOUR_BRANCH` when the reader may not reach its branch. */
const loadDay = async (reader: Reader, id: string, db: Db = prisma): Promise<DayRecord> => {
  const branches = await repo.activeBranches(db);
  const day = await repo.findDayById(branches.map((b) => b.id), id, db);
  if (!day) throw new NotFoundError('Day not found');
  assertBranch(reader, day.siteId);
  return day;
};

const deptRow = (day: DayRecord, departmentId: string): DepartmentRow => {
  const row = day.departments.find((d) => d.departmentId === departmentId);
  if (!row) throw branchDayError('NO_DEPARTMENTS', 'This department is not part of today’s day.');
  return row;
};

const deptRowByWireId = (day: DayRecord, id: string): DepartmentRow => {
  const row = day.departments.find((d) => d.departmentId === id || d.id === id);
  if (!row) throw new NotFoundError('Department not found on this day');
  return row;
};

// --- The day: made together on the first read (contract §5.1) -----------------------------------------------------------------------------

/** An open day the old code made is adopted: lines for a department that has none, an id link where the back-fill found none, and a partial count undone. */
const adoptOldDay = async (day: DayRecord): Promise<DayRecord> => {
  if (day.status !== 'OPEN') return day;
  let changed = false;
  const departments = await repo.activeDepartments(day.siteId);
  await prisma.$transaction(async (tx) => {
    for (const row of day.departments) {
      if (row.departmentId === null) {
        const match = row.departmentTag ? departments.find((d) => d.key === row.departmentTag) : undefined;
        if (match) {
          await repo.linkDepartment(tx, row.id, match.id);
          changed = true;
        }
      }
      const departmentId = row.departmentId ?? (row.departmentTag ? departments.find((d) => d.key === row.departmentTag)?.id : undefined);
      if (row.lines.length === 0 && departmentId) {
        const items = await repo.itemsOfDepartment(departmentId, tx);
        if (items.length > 0) {
          await repo.addLines(tx, row.id, items.map((i) => ({ id: i.id, cost: i.currentCost })));
          changed = true;
        }
      }
      if (row.status === 'COUNTED' && row.lines.some((l) => l.countedQty === null)) {
        await repo.reopenPartialCount(tx, row.id);
        changed = true;
      }
    }
  }, TX_OPTIONS);
  if (!changed) return day;
  return (await repo.findDayByDate(day.siteId, day.businessDate)) ?? day;
};

/**
 * Today's day of a branch, made on the first read by the branch's own people: the day, one row per ACTIVE department and one line per
 * live item of that department, all in one transaction with the day number. A losing creation race re-reads the winner.
 */
const ensureToday = async (branchId: string, now: Date): Promise<DayRecord> => {
  const businessDate = dayAsDate(nairobiDay(now));
  const existing = await repo.findDayByDate(branchId, businessDate);
  if (existing) return adoptOldDay(existing);

  const [site, departments] = await Promise.all([repo.findSite(branchId), repo.activeDepartments(branchId)]);
  if (!site || site.isHub) throw new NotFoundError('Branch not found');
  if (departments.length === 0) throw branchDayError('NO_DEPARTMENTS', 'This branch has no active department, so there is no day to count.');

  try {
    await prisma.$transaction(async (tx) => {
      const number = await referenceCounterRepository.nextNumber(tx, branchId, 'DAY');
      const reference = site.code ? `DAY-${site.code}-${pad4(number)}` : `DAY-${pad4(number)}`;
      const located: { departmentId: string; tag: typeof departments[number]['key']; locationId: string }[] = [];
      for (const d of departments) {
        const location = await deliveriesRepository.ensureDepartmentLocation(tx, branchId, d.id);
        if (!location) throw new ValidationError(`The stock location of ${d.name} could not be made`);
        located.push({ departmentId: d.id, tag: d.key, locationId: location.id });
      }
      const created = await repo.createDay(tx, { siteId: branchId, businessDate, reference, departments: located });
      for (const row of created.departments) {
        if (!row.departmentId) continue;
        const items = await repo.itemsOfDepartment(row.departmentId, tx);
        await repo.addLines(tx, row.id, items.map((i) => ({ id: i.id, cost: i.currentCost })));
      }
    }, TX_OPTIONS);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const day = await repo.findDayByDate(branchId, businessDate);
  if (!day) throw new NotFoundError('Day not found');
  return day;
};

// --- Shared reads -------------------------------------------------------------------------------------------------------------------------

const heads = async (day: DayRecord, db: Db = prisma): Promise<Map<string, Person>> =>
  repo.departmentHeads(day.siteId, day.departments.flatMap((d) => (d.departmentId ? [d.departmentId] : [])), db);

const figuresOfAll = async (day: DayRecord, withYesterday: boolean, db?: Db): Promise<DepartmentFigures[]> =>
  Promise.all(day.departments.map((d) => departmentFigures(day, d, { withYesterday }, db)));

const blockersFor = async (day: DayRecord, db: Db = prisma) => {
  const [onTheWay, discrepancies] = await Promise.all([repo.onTheWay(day.siteId, db), repo.openDiscrepancies(day.siteId, db)]);
  return blockersOf({
    departments: day.departments.map((d) => ({
      id: wireDepartmentId(d),
      name: d.department?.name ?? '',
      status: d.status,
      itemCount: d.lines.length,
      countedAt: d.countedAt,
      openingState: openingStateOf(day, d),
    })),
    onTheWay: onTheWay.flatMap((x) => (x.signedAt ? [{ id: x.id, reference: x.reference ?? '', signedAt: x.signedAt, department: { id: x.department.id, name: x.department.name } }] : [])),
    openDiscrepancies: discrepancies.map((d) => ({ id: d.id, reference: d.reference })),
  });
};

const parentNamesOf = (dept: DepartmentRow): Promise<Map<string, string>> =>
  repo.categoryNames([...new Set(dept.lines.flatMap((l) => (l.inventoryItem.category?.parentCategoryId ? [l.inventoryItem.category.parentCategoryId] : [])))]);

const sumUsed = (figs: DepartmentFigures[]): Prisma.Decimal | null => {
  const counted = figs.filter((f) => f.dept.status === 'COUNTED' && f.lines.length > 0);
  if (counted.length === 0) return null;
  return counted.reduce((s, f) => s.plus(usedValueOf(f) ?? zero), zero);
};

/** The branch's Used value now: frozen once closed (a day closed under the old flow has none), the sum of the counted departments while open. */
const dayUsedValue = (day: DayRecord, figs: DepartmentFigures[]): Prisma.Decimal | null => (day.status === 'CLOSED' ? day.usedValue : sumUsed(figs));

const tilesOf = (day: DayRecord, figs: DepartmentFigures[], headMap: Map<string, Person>, seeCosts: boolean): DepartmentTile[] =>
  figs.map((f) => tileOf(day, f, f.dept, f.dept.departmentId ? (headMap.get(f.dept.departmentId) ?? null) : null, seeCosts));

/** The entries a close will post (or has posted): the closing count minus the ledger position, for each line that moved (contract §5.8, §5.9). */
const usagePlan = async (day: DayRecord, figs: DepartmentFigures[], db: Db) => {
  const plan: { f: DepartmentFigures['lines'][number]; locationId: string; quantity: Prisma.Decimal }[] = [];
  for (const dept of figs) {
    const closings = dept.lines.filter((l) => l.closing !== null);
    const positions = await repo.positions(day.siteId, dept.dept.locationId, closings.map((l) => l.line.inventoryItemId), null, db);
    for (const l of closings) {
      const closing = l.closing;
      if (closing === null) continue;
      const quantity = usageEntryQty(closing, positions.get(l.line.inventoryItemId) ?? zero);
      if (!quantity.isZero()) plan.push({ f: l, locationId: dept.dept.locationId, quantity });
    }
  }
  return plan;
};

// --- Opening and count inputs ------------------------------------------------------------------------------------------------------------------

/** A recount is every line of the department, none left out and none that is not on its day. */
const checkedLines = (dept: DepartmentRow, lines: { itemId: string; countedQty: string }[]): Map<string, Prisma.Decimal> => {
  const known = new Set(dept.lines.map((l) => l.inventoryItemId));
  const unknown = lines.filter((l) => !known.has(l.itemId)).map((l) => l.itemId);
  if (unknown.length > 0) throw branchDayError('ITEM_NOT_IN_DAY', 'Some of these items are not on this department’s day.', { itemIds: unknown });
  const given = new Map(lines.map((l) => [l.itemId, D(l.countedQty)]));
  const missing = dept.lines.filter((l) => !given.has(l.inventoryItemId)).map((l) => l.inventoryItemId);
  if (missing.length > 0) throw branchDayError('COUNT_INCOMPLETE', 'Count every item.', { itemIds: missing });
  return given;
};

const assertOpen = (day: DayRecord): void => {
  if (day.status === 'CLOSED') throw branchDayError('DAY_ALREADY_CLOSED', 'This day is already closed.');
};

const closedAtOf = (day: DayRecord): string | null => (day.closedAt ? day.closedAt.toISOString() : null);

// --- The service --------------------------------------------------------------------------------------------------------------------------------

export const branchDayService = {
  // ============================ The head (BD1 to BD10) ============================

  /** BD1 GET /home: the head's Day (B0, B4). Creates today's day on the first read. */
  home: async (actor: Actor, now: Date = new Date()): Promise<Home> => {
    const c = await departmentCaller(actor, undefined, false);
    const day = await ensureToday(c.branchId, now);
    const dept = deptRow(day, c.departmentId);
    const [site, deliveries] = await Promise.all([repo.findSite(c.branchId), repo.deliveriesInWindow(c.branchId, dayWindow(day.businessDate).start, dayWindow(day.businessDate).end)]);
    if (!site) throw new NotFoundError('Branch not found');
    const opening = openingCheckOf(day, dept);
    const signed = countStateOf(dept) === 'COUNTED';
    return {
      day: dayHeadOf(day),
      branch: branchRefOf(site),
      department: departmentRefOf(dept),
      itemCount: dept.lines.length,
      opening,
      delivery: deliveryFactOf(c.departmentId, deliveries),
      count: { state: countStateOf(dept), signedAt: dept.countedAt ? dept.countedAt.toISOString() : null, signedBy: dept.countedBy ? person(dept.countedBy) : null, onBehalf: dept.onBehalf },
      closed: { at: closedAtOf(day) },
      action: homeActionOf(now, signed, opening.state),
    };
  },

  /** BD2 GET /opening (B1). */
  opening: async (actor: Actor, query: OpeningQuery, now: Date = new Date()): Promise<OpeningView> => {
    const c = await departmentCaller(actor, query.departmentId, true);
    const day = await ensureToday(c.branchId, now);
    const dept = deptRow(day, c.departmentId);
    const [figures, lastCloseAt] = await Promise.all([departmentFigures(day, dept, { withYesterday: false }), repo.previousClosedAt(c.branchId, day.businessDate)]);
    return openingViewOf(day, dept, figures, lastCloseAt);
  },

  /** BD3 POST /opening/accept: one tap, no PIN, no ledger row. */
  acceptOpening: async (actor: Actor, input: AcceptOpeningInput, now: Date = new Date()): Promise<OpeningResult> => {
    const c = await departmentCaller(actor, input.departmentId, true);
    const day = await ensureToday(c.branchId, now);
    assertOpen(day);
    const dept = deptRow(day, c.departmentId);
    const existing = openingOf(day, dept);
    const view = async (fresh: DayRecord): Promise<OpeningView> => {
      const row = deptRow(fresh, c.departmentId);
      const [figures, lastCloseAt] = await Promise.all([departmentFigures(fresh, row, { withYesterday: false }), repo.previousClosedAt(c.branchId, fresh.businessDate)]);
      return openingViewOf(fresh, row, figures, lastCloseAt);
    };
    if (existing) {
      if (existing.idempotencyKey === input.idempotencyKey) return { view: await view(day), replayed: true };
      throw branchDayError('OPENING_ALREADY_CHECKED', 'The opening is already checked.');
    }
    const figures = await departmentFigures(day, dept, { withYesterday: false });
    try {
      await prisma.$transaction(async (tx) => {
        await repo.createOpening(tx, {
          branchDayId: day.id,
          departmentId: c.departmentId,
          departmentTag: dept.departmentTag,
          locationId: dept.locationId,
          acceptedById: actor.id,
          acceptedAt: now,
          kind: 'ACCEPTED',
          onBehalf: c.onBehalf,
          idempotencyKey: input.idempotencyKey,
          lines: figures.lines.map((l) => ({ inventoryItemId: l.line.inventoryItemId, prefilledQty: l.lastNight, acceptedQty: l.lastNight, overnightVariance: zero, unitCost: l.unitCost })),
        });
      }, TX_OPTIONS);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await repo.findDayByDate(c.branchId, day.businessDate);
      const winner = raced ? openingOf(raced, deptRow(raced, c.departmentId)) : undefined;
      if (raced && winner?.idempotencyKey === input.idempotencyKey) return { view: await view(raced), replayed: true };
      throw branchDayError('OPENING_ALREADY_CHECKED', 'The opening is already checked.');
    }
    const fresh = await repo.findDayByDate(c.branchId, day.businessDate);
    if (!fresh) throw new NotFoundError('Day not found');
    return { view: await view(fresh), replayed: false };
  },

  /** BD4 POST /opening/recount/preview: the receipt before the PIN. Writes nothing. */
  previewRecount: async (actor: Actor, input: RecountPreviewInput, now: Date = new Date()): Promise<RecountPreview> => {
    const c = await departmentCaller(actor, input.departmentId, true);
    const day = await ensureToday(c.branchId, now);
    assertOpen(day);
    const dept = deptRow(day, c.departmentId);
    const given = checkedLines(dept, input.lines);
    const figures = await departmentFigures(day, dept, { withYesterday: false });
    const differences = figures.lines.flatMap((l) => {
      const counted = given.get(l.line.inventoryItemId);
      if (!counted || differenceOf(counted, l.lastNight).isZero()) return [];
      return [{ itemId: l.line.inventoryItemId, itemName: l.line.inventoryItem.name, unit: l.line.inventoryItem.usageUnit, lastNightQty: qty(l.lastNight), countedQty: qty(counted), difference: qty(differenceOf(counted, l.lastNight)) }];
    });
    return {
      itemCount: figures.lines.length,
      matchedItems: figures.lines.filter((l) => {
        const counted = given.get(l.line.inventoryItemId);
        return counted ? differenceOf(counted, l.lastNight).isZero() : false;
      }).map((l) => l.line.inventoryItem.name),
      differences,
    };
  },

  /** BD5 POST /opening/recount: PIN. One opening, its lines, and one ADJUSTMENT per line whose count differs from the ledger position (§6.3). */
  recountOpening: async (actor: Actor, input: RecountOpeningInput, now: Date = new Date()): Promise<OpeningResult> => {
    const c = await departmentCaller(actor, input.departmentId, true);
    await countPin.verifyOwn(actor, input.pin);
    const day = await ensureToday(c.branchId, now);
    assertOpen(day);
    const dept = deptRow(day, c.departmentId);
    const view = async (fresh: DayRecord): Promise<OpeningView> => {
      const row = deptRow(fresh, c.departmentId);
      const [figures, lastCloseAt] = await Promise.all([departmentFigures(fresh, row, { withYesterday: false }), repo.previousClosedAt(c.branchId, fresh.businessDate)]);
      return openingViewOf(fresh, row, figures, lastCloseAt);
    };
    const existing = openingOf(day, dept);
    if (existing) {
      if (existing.idempotencyKey === input.idempotencyKey) return { view: await view(day), replayed: true };
      throw branchDayError('OPENING_ALREADY_CHECKED', 'The opening is already checked.');
    }
    const given = checkedLines(dept, input.lines);
    const figures = await departmentFigures(day, dept, { withYesterday: false });
    try {
      await prisma.$transaction(async (tx) => {
        const opening = await repo.createOpening(tx, {
          branchDayId: day.id,
          departmentId: c.departmentId,
          departmentTag: dept.departmentTag,
          locationId: dept.locationId,
          acceptedById: actor.id,
          acceptedAt: now,
          kind: 'RECOUNTED',
          onBehalf: c.onBehalf,
          idempotencyKey: input.idempotencyKey,
          lines: figures.lines.map((l) => {
            const counted = given.get(l.line.inventoryItemId) ?? l.lastNight;
            return { inventoryItemId: l.line.inventoryItemId, prefilledQty: l.lastNight, acceptedQty: counted, overnightVariance: differenceOf(counted, l.lastNight), unitCost: l.unitCost };
          }),
        });
        const positions = await repo.positions(c.branchId, dept.locationId, opening.lines.map((l) => l.inventoryItemId), null, tx);
        for (const line of opening.lines) {
          const delta = line.acceptedQty.minus(positions.get(line.inventoryItemId) ?? zero);
          if (delta.isZero()) continue;
          await postStockMovement(tx, {
            type: 'ADJUSTMENT',
            locationId: dept.locationId,
            inventoryItemId: line.inventoryItemId,
            quantity: delta,
            unitCost: line.unitCost,
            reason: 'Overnight variance',
            userId: actor.id,
            links: { openingLineId: line.id },
          });
        }
      }, TX_OPTIONS);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await repo.findDayByDate(c.branchId, day.businessDate);
      const winner = raced ? openingOf(raced, deptRow(raced, c.departmentId)) : undefined;
      if (raced && winner?.idempotencyKey === input.idempotencyKey) return { view: await view(raced), replayed: true };
      throw branchDayError('OPENING_ALREADY_CHECKED', 'The opening is already checked.');
    }
    const fresh = await repo.findDayByDate(c.branchId, day.businessDate);
    if (!fresh) throw new NotFoundError('Day not found');
    return { view: await view(fresh), replayed: false };
  },

  /** BD6 GET /count: the blind count (B3, B3b, B3c, B15). Nothing to count against. */
  getCount: async (actor: Actor, query: CountQuery, now: Date = new Date()): Promise<CountView> => {
    const c = await departmentCaller(actor, query.departmentId, true);
    const day = await ensureToday(c.branchId, now);
    const dept = deptRow(day, c.departmentId);
    return countViewOf(day, dept, c.onBehalf, await parentNamesOf(dept));
  },

  /** BD7 PUT /count: stores what was typed; last write wins; null clears. */
  saveCount: async (actor: Actor, input: SaveCountInput, now: Date = new Date()): Promise<SaveCountResult> => {
    const c = await departmentCaller(actor, input.departmentId, true);
    const day = await ensureToday(c.branchId, now);
    assertOpen(day);
    const dept = deptRow(day, c.departmentId);
    if (isCounted({ status: dept.status, itemCount: dept.lines.length })) throw branchDayError('ALREADY_COUNTED', 'This count is already signed.');
    const byItem = new Map(dept.lines.map((l) => [l.inventoryItemId, l]));
    const unknown = input.lines.filter((l) => !byItem.has(l.itemId)).map((l) => l.itemId);
    if (unknown.length > 0) throw branchDayError('ITEM_NOT_IN_DAY', 'Some of these items are not on this department’s day.', { itemIds: unknown });
    await prisma.$transaction(async (tx) => {
      await repo.saveCounts(tx, dept.id, input.lines.flatMap((l) => {
        const line = byItem.get(l.itemId);
        return line ? [{ id: line.id, countedQty: l.countedQty === null ? null : D(l.countedQty) }] : [];
      }));
    }, TX_OPTIONS);
    const fresh = await repo.findDayByDate(c.branchId, day.businessDate);
    if (!fresh) throw new NotFoundError('Day not found');
    const row = deptRow(fresh, c.departmentId);
    return { savedAt: now.toISOString(), view: countViewOf(fresh, row, c.onBehalf, await parentNamesOf(row)) };
  },

  /** BD8 POST /count/sign: PIN. Every line filled. Marks the department Counted with the signer and `onBehalf`. */
  signCount: async (actor: Actor, input: SignCountInput, now: Date = new Date()): Promise<SignCountResult> => {
    const c = await departmentCaller(actor, input.departmentId, true);
    await countPin.verifyOwn(actor, input.pin);
    const day = await ensureToday(c.branchId, now);
    assertOpen(day);
    const dept = deptRow(day, c.departmentId);
    const result = async (fresh: DayRecord, replayed: boolean): Promise<SignCountResult> => {
      const row = deptRow(fresh, c.departmentId);
      return { view: countViewOf(fresh, row, c.onBehalf, await parentNamesOf(row)), signedAt: (row.countedAt ?? now).toISOString(), onBehalf: row.onBehalf, replayed };
    };
    if (isCounted({ status: dept.status, itemCount: dept.lines.length })) {
      if (dept.countIdempotencyKey === input.idempotencyKey) return result(day, true);
      throw branchDayError('ALREADY_COUNTED', 'This count is already signed.');
    }
    const blank = dept.lines.filter((l) => l.countedQty === null).map((l) => l.inventoryItemId);
    if (blank.length > 0) throw branchDayError('COUNT_INCOMPLETE', 'Count every item before you sign.', { itemIds: blank });
    const signed = await prisma.$transaction((tx) => repo.signDepartment(tx, { id: dept.id, branchDayId: day.id, countedById: actor.id, countedAt: now, onBehalf: c.onBehalf, idempotencyKey: input.idempotencyKey }), TX_OPTIONS);
    const fresh = await repo.findDayByDate(c.branchId, day.businessDate);
    if (!fresh) throw new NotFoundError('Day not found');
    if (!signed) {
      // Someone signed first: the same key is a replay, any other is a conflict.
      if (deptRow(fresh, c.departmentId).countIdempotencyKey === input.idempotencyKey) return result(fresh, true);
      throw branchDayError('ALREADY_COUNTED', 'This count is already signed.');
    }
    return result(fresh, false);
  },

  /** BD9 GET /mine/history: the department's own closed days (step 19), last 30 Nairobi days by default, no money. */
  myHistory: async (actor: Actor, query: MyHistoryQuery, now: Date = new Date()): Promise<MyHistory> => {
    const c = await departmentCaller(actor, undefined, false);
    const today = nairobiDay(now);
    const from = query.from ?? (query.to ? addDays(query.to, -29) : addDays(today, -29));
    const [dept, headMap, page] = await Promise.all([
      repo.findDepartment(c.branchId, c.departmentId),
      repo.departmentHeads(c.branchId, [c.departmentId]),
      repo.listMine(c.branchId, c.departmentId, { from: dayAsDate(from), ...(query.to ? { to: dayAsDate(query.to) } : {}), ...(query.status ? { status: query.status } : {}) }, (query.page - 1) * query.pageSize, query.pageSize),
    ]);
    if (!dept) throw branchDayError('NOT_YOUR_DEPARTMENT', 'Your department is not active.');
    const head = headMap.get(c.departmentId);
    return {
      department: { id: dept.id, name: dept.name },
      head: head ? person(head) : null,
      rows: page.rows.map((r) => {
        const correctedCount = r.lines.reduce((n, l) => n + l.corrections.length, 0);
        return {
          id: r.branchDay.id,
          reference: r.branchDay.reference,
          date: dateText(r.branchDay.businessDate),
          status: correctedCount > 0 ? ('CORRECTED' as const) : ('CLOSED' as const),
          itemsCounted: r._count.lines,
          signedAt: (r.countedAt ?? now).toISOString(),
          correctedCount,
        };
      }),
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },

  /** BD10 GET /mine/days/:id: one past day of the caller's department (step 20), quantities only. */
  myDay: async (actor: Actor, id: string): Promise<MyDay> => {
    const c = await departmentCaller(actor, undefined, false);
    const day = await repo.findDayById([c.branchId], id);
    if (!day || day.status !== 'CLOSED') throw new NotFoundError('Day not found');
    const dept = day.departments.find((d) => d.departmentId === c.departmentId);
    // A day closed under the old flow has no Used today, so there is nothing to show a head.
    if (!dept || dept.status !== 'COUNTED' || dept.lines.some((l) => l.openingQty === null)) throw new NotFoundError('Day not found');
    const figures = await departmentFigures(day, dept, { withYesterday: false });
    return {
      day: dayHeadOf(day),
      department: departmentRefOf(dept),
      signedAt: (dept.countedAt ?? day.closedAt ?? new Date()).toISOString(),
      lines: figures.lines.map((f) => ({
        itemName: f.line.inventoryItem.name,
        unit: f.line.inventoryItem.usageUnit,
        openingQty: qty(f.opening),
        receivedQty: qty(f.received),
        wasteQty: qty(f.waste),
        closingQty: qty(f.closing ?? zero),
        usedQty: qty(f.used ?? zero),
      })),
    };
  },

  // ============================ The Branch Manager and the readers (BD11 to BD21) ============================

  /** BD11 GET /today (B5, B7, B9, B14, B16). A Branch Manager's read creates today's day; a hub reader's does not. */
  today: async (actor: Actor, query: TodayQuery, now: Date = new Date()): Promise<Today> => {
    const reader = await loadReader(actor);
    const branches = await repo.activeBranches();
    let branchId: string;
    if (reader.anyBranch) {
      const wanted = query.branchId ?? branches[0]?.id;
      if (!wanted || !branches.some((b) => b.id === wanted)) throw new NotFoundError('Branch not found');
      branchId = wanted;
    } else {
      if (query.branchId && query.branchId !== reader.own) throw branchDayError('NOT_YOUR_BRANCH', 'That is another branch.');
      branchId = reader.own ?? '';
    }
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) throw new NotFoundError('Branch not found');
    const creates = actorCan(actor, 'branch_day.read') && !reader.anyBranch;
    const can = {
      close: actorCan(actor, 'branch_day.close') && (reader.anyBranch || reader.own === branchId),
      countOnBehalf: actorCan(actor, 'branch_day.count_on_behalf') && reader.own === branchId,
    };
    const wire = { branch: branchRefOf(branch), ...(reader.anyBranch ? { branches: branches.map(branchRefOf) } : {}), can };
    const day = creates ? await ensureToday(branchId, now) : await repo.findDayByDate(branchId, dayAsDate(nairobiDay(now)));
    if (!day) return { ...wire, day: null };
    // A hub reader never creates the day, but an open day the old code made still needs its lines before it can be read.
    const adopted = creates ? day : await adoptOldDay(day);
    const [figs, headMap, blockers] = await Promise.all([figuresOfAll(adopted, false), heads(adopted), blockersFor(adopted)]);
    const used = dayUsedValue(adopted, figs);
    let closed: NonNullable<Today['day']>['closed'] = null;
    if (adopted.status === 'CLOSED' && adopted.closedAt && adopted.closedBy) {
      const [entries, count] = await Promise.all([repo.firstEntries(adopted.siteId, adopted.reference, 5), repo.usageEntryCount(adopted.siteId, adopted.reference)]);
      closed = { at: adopted.closedAt.toISOString(), by: person(adopted.closedBy), entryCount: count, entries: entries.map((e) => ledgerEntryOf(e, 'USAGE', adopted.reference)) };
    }
    return {
      ...wire,
      day: {
        head: dayHeadOf(adopted),
        departments: tilesOf(adopted, figs, headMap, reader.seeCosts),
        blockers,
        summary: summaryOf(blockers),
        canClose: canCloseOf(adopted.status, blockers),
        ...(reader.seeCosts ? { usedValueKes: used ? money(used) : null } : {}),
        closed,
      },
    };
  },

  /** BD12 GET /days/:id/departments/:departmentId (B6, B11 Items tab): live for an open day, frozen for a closed one. */
  departmentFigures: async (actor: Actor, id: string, departmentId: string): Promise<DepartmentFiguresWire> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const dept = deptRowByWireId(day, departmentId);
    const { start, end } = dayWindow(day.businessDate);
    const [figs, headMap, deliveries, wasteEntries, branch, later] = await Promise.all([
      figuresOfAll(day, true),
      heads(day),
      repo.deliveriesInWindow(day.siteId, start, end),
      repo.wasteEntries(day.siteId, dept.locationId, start, end),
      repo.findSite(day.siteId),
      dept.departmentId ? repo.laterOpeningExists(day.siteId, dept.departmentId, day.businessDate) : Promise.resolve(false),
    ]);
    const mine = figs.find((f) => f.dept.id === dept.id);
    if (!branch || !mine) throw new NotFoundError('Day not found');
    const used = dayUsedValue(day, figs);
    const canCorrect =
      actorCan(actor, 'branch_day.correct') && !mineLegacy(mine) && day.status === 'CLOSED' && isCounted({ status: dept.status, itemCount: dept.lines.length }) && dept.lines.length > 0 && correctionWindowOpen(later);
    return {
      day: dayHeadOf(day),
      branch: branchRefOf(branch),
      rail: tilesOf(day, figs, headMap, reader.seeCosts),
      ...(reader.seeCosts ? { branchUsedValueKes: used ? money(used) : null } : {}),
      department: {
        id: wireDepartmentId(dept),
        name: dept.department?.name ?? '',
        state: countStateOf(dept),
        countedAt: dept.countedAt ? dept.countedAt.toISOString() : null,
        countedBy: dept.countedBy ? person(dept.countedBy) : null,
        onBehalf: dept.onBehalf,
        opening: openingCheckOf(day, dept),
        delivery: deliveryFactOf(dept.departmentId, deliveries),
        lines: mine.lines.map((l) => figureLineOf(l, reader.seeCosts)),
        waste: { entryCount: wasteEntries.length, items: wasteEntries.map((w) => ({ itemName: w.inventoryItem.name, reasonText: WASTE_TEXT[w.reason] })) },
        ...(reader.seeCosts ? { totals: totalsOf(mine) } : {}),
        can: { correct: canCorrect },
      },
    };
  },

  /** BD13 GET /days/:id/close-summary (B8): always 200, with `canClose` and `blockers`. */
  closeSummary: async (actor: Actor, id: string): Promise<CloseSummary> => {
    requireCapability(actor, 'branch_day.close', 'You do not have permission to close the day');
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const [figs, blockers, branch] = await Promise.all([figuresOfAll(day, false), blockersFor(day), repo.findSite(day.siteId)]);
    if (!branch) throw new NotFoundError('Day not found');
    const plan = day.status === 'OPEN' ? await usagePlan(day, figs, prisma) : [];
    const total = sumUsed(figs) ?? zero;
    return {
      day: dayHeadOf(day),
      branch: branchRefOf(branch),
      usedValueKes: money(day.status === 'CLOSED' ? (day.usedValue ?? zero) : total),
      departments: figs.map((f) => ({ departmentId: wireDepartmentId(f.dept), name: f.dept.department?.name ?? '', itemCount: f.lines.length, usedValueKes: money(usedValueOf(f) ?? zero) })),
      entryCount: plan.length,
      canClose: canCloseOf(day.status, blockers),
      blockers,
    };
  },

  /** BD14 POST /days/:id/close (B8, B9): PIN, one transaction (contract §5.8). */
  closeDay: async (actor: Actor, id: string, input: CloseDayInput, now: Date = new Date()): Promise<CloseDayResult> => {
    requireCapability(actor, 'branch_day.close', 'You do not have permission to close the day');
    const reader = await loadReader(actor);
    const first = await loadDay(reader, id);
    await countPin.verifyOwn(actor, input.pin);

    const replay = async (day: DayRecord): Promise<CloseDayResult> => {
      const sheet1 = await repo.findSheet(day.id, 1);
      const parsed = sheet1 ? daySheetSchema.safeParse(sheet1.payload) : null;
      return closeResultOf(day, parsed?.success ? parsed.data.totals.usedValueKes : money(day.usedValue ?? zero), true);
    };
    if (first.status === 'CLOSED') {
      if (first.closeIdempotencyKey === input.idempotencyKey) return replay(first);
      throw branchDayError('DAY_ALREADY_CLOSED', 'This day is already closed.');
    }

    type Outcome = { kind: 'replay' } | { kind: 'closed'; usedValue: string };
    const outcome: Outcome = await prisma.$transaction(async (tx) => {
      if (!(await repo.lockDay(tx, first.siteId, first.id))) throw new NotFoundError('Day not found');
      const day = await repo.findDayById([first.siteId], first.id, tx);
      if (!day) throw new NotFoundError('Day not found');
      if (day.status === 'CLOSED') {
        if (day.closeIdempotencyKey === input.idempotencyKey) return { kind: 'replay' };
        throw branchDayError('DAY_ALREADY_CLOSED', 'This day is already closed.');
      }
      const blockers = await blockersFor(day, tx);
      if (blockers.some((b) => b.severity === 'BLOCKS')) throw branchDayError('DAY_NOT_READY', 'Something still has to be done before the day can close.', { blockers });

      const figs = await figuresOfAll(day, false, tx);
      const plan = await usagePlan(day, figs, tx);
      let used = zero;
      let closing = zero;
      for (const dept of figs) {
        for (const l of dept.lines) {
          await repo.freezeLine(tx, l.line.id, { openingQty: l.opening, receivedQty: l.received, wasteQty: l.waste, usedQty: l.used, unitCost: l.unitCost });
          if (l.used) used = used.plus(valueOf(l.used, l.unitCost));
          if (l.closing) closing = closing.plus(valueOf(l.closing, l.unitCost));
        }
      }
      for (const p of plan) {
        await postStockMovement(tx, {
          type: 'ADJUSTMENT',
          locationId: p.locationId,
          inventoryItemId: p.f.line.inventoryItemId,
          quantity: p.quantity,
          unitCost: p.f.unitCost,
          reason: 'Used today',
          userId: actor.id,
          links: { branchDayLineId: p.f.line.id },
          reference: day.reference,
        });
      }
      await repo.closeDay(tx, { id: day.id, siteId: day.siteId, closedById: actor.id, closedAt: now, usedValue: used, closingValue: closing, idempotencyKey: input.idempotencyKey });

      const closed = await repo.findDayById([day.siteId], day.id, tx);
      if (!closed) throw new NotFoundError('Day not found');
      const closedFigs = await figuresOfAll(closed, false, tx);
      const [branch, headMap, deliveries, discrepancies] = await Promise.all([
        repo.findBranchForSheet(day.siteId, tx),
        heads(closed, tx),
        repo.deliveriesInWindow(day.siteId, dayWindow(day.businessDate).start, dayWindow(day.businessDate).end, tx),
        repo.openDiscrepancies(day.siteId, tx),
      ]);
      if (!branch) throw new NotFoundError('Branch not found');
      const sheet = buildSheet({
        day: closed,
        branch: { id: branch.id, name: branch.name, code: branch.code, address: branch.address, phone: branch.phone },
        figures: closedFigs,
        heads: headMap,
        deliveries,
        openDiscrepancies: discrepancies.map((d) => ({ reference: d.reference, departmentId: d.dispatch.departmentId, itemName: d.dispatchLine.item.name })),
        kind: 'AT_THE_CLOSE',
        version: 1,
        madeAt: now,
        qrUrl: `${env.FRONTEND_ORIGIN}/app/branch/day/history/${day.id}`,
      });
      await repo.createSheet(tx, { branchDayId: day.id, version: 1, kind: 'AT_THE_CLOSE', pages: sheetPageCount(closedFigs), payload: sheet as unknown as Prisma.InputJsonValue, createdById: actor.id });
      return { kind: 'closed', usedValue: money(used) };
    }, TX_OPTIONS);

    const day = await repo.findDayById([first.siteId], first.id);
    if (!day) throw new NotFoundError('Day not found');
    if (outcome.kind === 'replay') return replay(day);
    return closeResultOf(day, outcome.usedValue, false);
  },

  /** BD15 GET /history (B10, B10b, B10c): last 7 Nairobi days by default, newest first. */
  history: async (actor: Actor, query: HistoryQuery, now: Date = new Date()): Promise<History> => {
    const reader = await loadReader(actor);
    const branches = await repo.activeBranches();
    let siteIds: string[];
    if (reader.anyBranch) {
      if (query.branchId && !branches.some((b) => b.id === query.branchId)) throw new NotFoundError('Branch not found');
      siteIds = query.branchId ? [query.branchId] : branches.map((b) => b.id);
    } else {
      if (query.branchId && query.branchId !== reader.own) throw branchDayError('NOT_YOUR_BRANCH', 'That is another branch.');
      siteIds = reader.own ? [reader.own] : [];
    }
    const today = nairobiDay(now);
    const noRange = query.from === undefined && query.to === undefined;
    const from = noRange ? addDays(today, -6) : query.from;
    const to = noRange ? today : query.to;
    const page = await repo.listHistory(
      siteIds,
      { ...(query.q ? { q: query.q } : {}), ...(from ? { from: dayAsDate(from) } : {}), ...(to ? { to: dayAsDate(to) } : {}), ...(query.status ? { status: query.status } : {}) },
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );
    return {
      rows: page.rows.map((r) => {
        const total = r.departments.length;
        const counted = r.departments.filter((d) => isCounted({ status: d.status, itemCount: d._count.lines })).length;
        const status = r.status === 'OPEN' ? ('OPEN' as const) : r._count.corrections > 0 ? ('CORRECTED' as const) : ('CLOSED' as const);
        return {
          id: r.id,
          reference: r.reference,
          date: dateText(r.businessDate),
          branch: branchRefOf(r.site),
          departmentsCounted: counted,
          departmentsTotal: total,
          status,
          closedBy: r.closedBy ? person(r.closedBy) : null,
          closedAt: r.closedAt ? r.closedAt.toISOString() : null,
          ...(reader.seeCosts ? { usedValueKes: r.status === 'CLOSED' && r.usedValue ? money(r.usedValue) : null, closingValueKes: r.status === 'CLOSED' && r.closingValue ? money(r.closingValue) : null } : {}),
        };
      }),
      ...(reader.anyBranch ? { branches: branches.map(branchRefOf) } : {}),
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },

  /** BD16 GET /days/:id (B11): the day file. */
  dayFile: async (actor: Actor, id: string): Promise<DayFile> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const [figs, headMap, branch, sheets] = await Promise.all([figuresOfAll(day, false), heads(day), repo.findSite(day.siteId), repo.listSheets(day.id)]);
    if (!branch) throw new NotFoundError('Day not found');
    const counted = day.departments.filter((d) => isCounted({ status: d.status, itemCount: d.lines.length }));
    const stamps = day.departments.flatMap((d) => (d.countedAt ? [d.countedAt] : []));
    const last = stamps.length > 0 ? new Date(Math.max(...stamps.map((s) => s.getTime()))) : null;
    const corrections = day.departments.flatMap((d) => d.lines.flatMap((l) => l.corrections.map((c) => ({ c, department: d.department?.name ?? '', item: l.inventoryItem.name }))));
    corrections.sort((a, b) => b.c.correctedAt.getTime() - a.c.correctedAt.getTime());
    const newest = corrections[0];
    const v1 = reader.seeCosts && day.status === 'CLOSED' ? await repo.findSheet(day.id, 1) : null;
    const activity = buildActivity(day, reader.seeCosts, v1 ? usedTextOf(v1.payload) : null);
    const used = dayUsedValue(day, figs);
    return {
      day: dayHeadOf(day),
      branch: branchRefOf(branch),
      tracker: {
        openingsChecked: { checked: day.departments.filter((d) => openingOf(day, d) !== undefined).length, total: day.departments.length },
        counted: { counted: counted.length, total: day.departments.length, lastAt: last ? last.toISOString() : null },
        closed: { at: closedAtOf(day), by: day.closedBy ? person(day.closedBy) : null },
      },
      rail: tilesOf(day, figs, headMap, reader.seeCosts),
      tabCounts: { documents: sheets.length, activity: activity.length },
      ...(reader.seeCosts ? { usedValueKes: used ? money(used) : null } : {}),
      lastCorrection: newest
        ? { at: newest.c.correctedAt.toISOString(), itemName: newest.item, departmentName: newest.department, fromClosingQty: qty(newest.c.fromClosingQty), toClosingQty: qty(newest.c.toClosingQty) }
        : null,
      can: { correct: actorCan(actor, 'branch_day.correct') && day.status === 'CLOSED' && !figs.some(mineLegacy), print: day.status === 'CLOSED' && sheets.length > 0 },
    };
  },

  /** BD17 GET /days/:id/activity (B12b): newest first, `limit` defaults to 5, `total` is the whole. */
  activity: async (actor: Actor, id: string, query: ActivityQuery): Promise<DayActivity> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const v1 = reader.seeCosts && day.status === 'CLOSED' ? await repo.findSheet(day.id, 1) : null;
    const all = buildActivity(day, reader.seeCosts, v1 ? usedTextOf(v1.payload) : null);
    return { entries: all.slice(0, query.limit), total: all.length };
  },

  /** BD18 GET /days/:id/documents (B13): the day sheets kept on file, newest first. */
  documents: async (actor: Actor, id: string): Promise<DayDocuments> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const sheets = await repo.listSheets(day.id);
    const latest = sheets[0]?.version ?? 0;
    return { documents: sheets.map((s) => dayDocumentOf(s, latest, day.reference)) };
  },

  /** BD19 GET /days/:id/entries: every ledger entry carrying the day number. */
  entries: async (actor: Actor, id: string, query: EntriesQuery): Promise<DayEntries> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    const page = await repo.entriesPage(day.siteId, day.reference, (query.page - 1) * query.pageSize, query.pageSize);
    return {
      rows: page.rows.map((r) => ledgerEntryOf(r, r.branchDayCorrection ? 'CORRECTION' : 'USAGE', day.reference)),
      page: { page: query.page, pageSize: query.pageSize, total: page.total },
    };
  },

  /** BD20 POST /days/:id/corrections (B12, B12b): PIN, one transaction (contract §5.10). */
  correctCount: async (actor: Actor, id: string, input: CorrectCountInput, now: Date = new Date()): Promise<CorrectCountResult> => {
    requireCapability(actor, 'branch_day.correct', 'You do not have permission to correct a count');
    const reader = await loadReader(actor);
    const first = await loadDay(reader, id);
    await countPin.verifyOwn(actor, input.pin);

    const result = async (dayId: string, correctionId: string, replayed: boolean): Promise<CorrectCountResult> => {
      const day = await repo.findDayById([first.siteId], dayId);
      if (!day) throw new NotFoundError('Day not found');
      const correction = await repo.findCorrectionByKey(day.id, input.idempotencyKey);
      const dept = day.departments.find((d) => d.lines.some((l) => l.id === correction?.branchDayLineId));
      const line = dept?.lines.find((l) => l.id === correction?.branchDayLineId);
      const entry = correction ? await repo.findEntry(day.siteId, correction.transactionId) : null;
      const sheets = await repo.listSheets(day.id);
      const doc = sheets.find((s) => s.version === correction?.sheetVersion);
      if (!dept || !line || !correction || !entry || !doc || correction.id !== correctionId) throw new NotFoundError('Correction not found');
      const [figures] = await Promise.all([departmentFigures(day, dept, { withYesterday: false })]);
      const lineFigures = figures.lines.find((l) => l.line.id === line.id);
      if (!lineFigures) throw new NotFoundError('Correction not found');
      return {
        day: dayHeadOf(day),
        line: figureLineOf(lineFigures, true),
        entry: ledgerEntryOf(entry, 'CORRECTION', day.reference),
        document: dayDocumentOf(doc, sheets[0]?.version ?? doc.version, day.reference),
        usedValueKes: money(day.usedValue ?? zero),
        replayed,
      };
    };

    const prior = await repo.findCorrectionByKey(first.id, input.idempotencyKey);
    if (prior) return result(first.id, prior.id, true);

    const created = await prisma.$transaction(async (tx) => {
      if (!(await repo.lockDay(tx, first.siteId, first.id))) throw new NotFoundError('Day not found');
      const day = await repo.findDayById([first.siteId], first.id, tx);
      if (!day) throw new NotFoundError('Day not found');
      const again = await repo.findCorrectionByKey(day.id, input.idempotencyKey, tx);
      if (again) return { id: again.id, replayed: true };
      if (day.status !== 'CLOSED') throw branchDayError('DAY_NOT_CLOSED', 'Only a closed day can be corrected.');
      const dept = day.departments.find((d) => d.departmentId === input.departmentId);
      if (!dept) throw branchDayError('ITEM_NOT_IN_DAY', 'That department is not on this day.');
      if (dept.status !== 'COUNTED' || dept.lines.length === 0) throw branchDayError('DEPARTMENT_NOT_COUNTED', 'This department never counted.');
      const line = dept.lines.find((l) => l.inventoryItemId === input.itemId);
      if (!line) throw branchDayError('ITEM_NOT_IN_DAY', 'That item is not on this department’s day.');
      if (line.countedQty === null || line.usedQty === null) throw new ValidationError('This day was closed under the old flow; its figures cannot be corrected.');
      if (!correctionWindowOpen(await repo.laterOpeningExists(day.siteId, input.departmentId, day.businessDate, tx))) {
        throw branchDayError('CORRECTION_WINDOW_PASSED', 'This department has already checked a later opening.');
      }
      const to = D(input.closingQty);
      const from = line.countedQty;
      if (to.equals(from)) throw branchDayError('CORRECTION_NO_CHANGE', 'That is the figure it already has.');
      const delta = to.minus(from);
      const entry = await postStockMovement(tx, {
        type: 'ADJUSTMENT',
        locationId: dept.locationId,
        inventoryItemId: line.inventoryItemId,
        quantity: delta,
        unitCost: line.unitCost,
        reason: `Count corrected: ${CORRECTION_REASON_TEXT[input.reason]}`,
        userId: actor.id,
        links: { branchDayLineId: line.id },
        reference: day.reference,
      });
      const usedFrom = line.usedQty;
      const usedTo = usedFrom.minus(delta);
      const version = (await repo.latestSheetVersion(day.id, tx)) + 1;
      await repo.updateLineFigures(tx, line.id, to, usedTo);
      const correction = await repo.createCorrection(tx, {
        branchDayId: day.id,
        branchDayLineId: line.id,
        fromClosingQty: from,
        toClosingQty: to,
        fromUsedQty: usedFrom,
        toUsedQty: usedTo,
        reason: input.reason,
        note: input.note ?? null,
        correctedById: actor.id,
        correctedAt: now,
        transactionId: entry.id,
        sheetVersion: version,
        idempotencyKey: input.idempotencyKey,
      });

      const fresh = await repo.findDayById([day.siteId], day.id, tx);
      if (!fresh) throw new NotFoundError('Day not found');
      const figs = await figuresOfAll(fresh, false, tx);
      const used = figs.reduce((s, f) => s.plus(usedValueOf(f) ?? zero), zero);
      const closing = figs.reduce((s, f) => s.plus(closingValueOf(f)), zero);
      await repo.updateDayTotals(tx, day.id, day.siteId, used, closing);
      const [branch, headMap, deliveries, previous] = await Promise.all([
        repo.findBranchForSheet(day.siteId, tx),
        heads(fresh, tx),
        repo.deliveriesInWindow(day.siteId, dayWindow(day.businessDate).start, dayWindow(day.businessDate).end, tx),
        repo.findSheet(day.id, 1, tx),
      ]);
      if (!branch) throw new NotFoundError('Branch not found');
      const closedSheet = previous ? daySheetSchema.safeParse(previous.payload) : null;
      const sheet = buildSheet({
        day: fresh,
        branch: { id: branch.id, name: branch.name, code: branch.code, address: branch.address, phone: branch.phone },
        figures: figs,
        heads: headMap,
        deliveries,
        openDiscrepancies: [],
        ...(closedSheet?.success ? { notes: closedSheet.data.notes } : {}),
        kind: 'AFTER_CORRECTION',
        version,
        madeAt: now,
        qrUrl: `${env.FRONTEND_ORIGIN}/app/branch/day/history/${day.id}`,
      });
      await repo.createSheet(tx, { branchDayId: day.id, version, kind: 'AFTER_CORRECTION', pages: sheetPageCount(figs), payload: sheet as unknown as Prisma.InputJsonValue, createdById: actor.id });
      return { id: correction.id, replayed: false };
    }, TX_OPTIONS);
    return result(first.id, created.id, created.replayed);
  },

  /** BD21 GET /days/:id/sheet (B13b to B13d): the stored copy of a version, `printedAt` set to now; writes nothing. */
  sheet: async (actor: Actor, id: string, query: SheetQuery, now: Date = new Date()): Promise<DaySheet> => {
    const reader = await loadReader(actor);
    const day = await loadDay(reader, id);
    if (day.status !== 'CLOSED') throw branchDayError('DAY_NOT_CLOSED', 'The day sheet is made when the day closes.');
    const stored = await repo.findSheet(day.id, query.version);
    if (!stored) throw new NotFoundError('Day sheet not found');
    const parsed = daySheetSchema.parse(stored.payload);
    return { ...parsed, printedAt: now.toISOString() };
  },
};

// --- Small helpers that need the service's types -------------------------------------------------------------------------------------------

const WASTE_TEXT: Record<'EXPIRY' | 'SPOILAGE' | 'DAMAGE_IN_STORE' | 'PREP_ERROR', string> = {
  EXPIRY: 'Expired',
  SPOILAGE: 'Spoiled',
  DAMAGE_IN_STORE: 'Damaged in store',
  PREP_ERROR: 'Prep error',
};

/** A department closed under the old flow has no Used today and cannot be corrected. */
const mineLegacy = (f: DepartmentFigures): boolean => f.lines.some((l) => l.legacy);

const usedTextOf = (payload: Prisma.JsonValue): string | null => {
  const parsed = daySheetSchema.safeParse(payload);
  return parsed.success ? kesText(parsed.data.totals.usedValueKes) : null;
};

/** The Activity tab: every opening check, signed count, the close and each correction, newest first (contract §9). */
const buildActivity = (day: DayRecord, seeCosts: boolean, closedUsedText: string | null): DayActivityEntry[] => {
  const out: DayActivityEntry[] = [];
  const link = { kind: 'DAY' as const, id: day.id, reference: day.reference };
  for (const dept of day.departments) {
    const name = dept.department?.name ?? '';
    const opening = openingOf(day, dept);
    if (opening) {
      const differences = openingDifferencesOf(day, dept);
      out.push({
        id: `opening:${opening.id}`,
        at: opening.acceptedAt.toISOString(),
        actor: person(opening.acceptedBy),
        type: opening.kind === 'RECOUNTED' ? 'OPENING_RECOUNTED' : 'OPENING_ACCEPTED',
        sentence: opening.kind === 'RECOUNTED' ? describeOpeningRecounted(name, differences) : describeOpeningAccepted(name),
        detail: null,
        link,
      });
    }
    if (dept.countedAt && dept.countedBy && dept.status === 'COUNTED') {
      out.push({
        id: `count:${dept.id}`,
        at: dept.countedAt.toISOString(),
        actor: person(dept.countedBy),
        type: dept.onBehalf ? 'COUNT_SIGNED_ON_BEHALF' : 'COUNT_SIGNED',
        sentence: describeCountSigned(name, dept.lines.length, dept.onBehalf),
        detail: null,
        link,
      });
    }
    for (const line of dept.lines) {
      for (const c of line.corrections) {
        out.push({
          id: `correction:${c.id}`,
          at: c.correctedAt.toISOString(),
          actor: person(c.correctedBy),
          type: 'COUNT_CORRECTED',
          sentence: describeCountCorrected(line.inventoryItem.name, name, qty(c.fromClosingQty), qty(c.toClosingQty)),
          detail: describeCorrectionDetail(c.reason, c.note, true),
          link: { kind: 'LEDGER_ENTRY', id: c.transactionId, reference: day.reference },
        });
      }
    }
  }
  if (day.closedAt && day.closedBy) {
    out.push({ id: `close:${day.id}`, at: day.closedAt.toISOString(), actor: person(day.closedBy), type: 'DAY_CLOSED', sentence: describeDayClosed(seeCosts ? closedUsedText : null), detail: null, link });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
};

/** The close's result: the day, the first five usage entries in department then item order and the total, and the sheet made at the close. */
const closeResultOf = async (day: DayRecord, usedValueKes: string, replayed: boolean): Promise<CloseDayResult> => {
  if (!day.closedAt || !day.closedBy) throw new NotFoundError('Day not found');
  const [entries, count, sheets] = await Promise.all([repo.firstEntries(day.siteId, day.reference, 5), repo.usageEntryCount(day.siteId, day.reference), repo.listSheets(day.id)]);
  const first = sheets.find((s) => s.version === 1);
  if (!first) throw new NotFoundError('Day sheet not found');
  return {
    day: dayHeadOf(day),
    closedAt: day.closedAt.toISOString(),
    closedBy: person(day.closedBy),
    usedValueKes,
    entryCount: count,
    entries: entries.map((e) => ledgerEntryOf(e, 'USAGE', day.reference)),
    document: dayDocumentOf(first, sheets[0]?.version ?? 1, day.reference),
    replayed,
  };
};
