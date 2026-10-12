import { Prisma } from '@prisma/client';
import { branchDayRepository as repo, type Db, type DayRecord, type DepartmentRow, type LineRow, type OpeningRow } from './branch-day-repository';
import { dayWindow, lastNightQtyOf, openingQtyOf, previousDate, usedTodayOf, valueOf, zero } from './branch-day-rules';

/** One line's figures for a day. `legacy` marks a day closed under the old flow: closing figures only, no Used today (contract §0.4). */
export type LineFigures = {
  line: LineRow;
  opening: Prisma.Decimal;
  received: Prisma.Decimal;
  waste: Prisma.Decimal;
  closing: Prisma.Decimal | null;
  used: Prisma.Decimal | null;
  unitCost: Prisma.Decimal;
  yesterday: Prisma.Decimal | null;
  /** What the opening check shows as "last night": the signed figure, else the ledger position at the start of the day. */
  lastNight: Prisma.Decimal;
  /** What was accepted or recounted at the opening; null until it is checked. */
  accepted: Prisma.Decimal | null;
  legacy: boolean;
};

export type DepartmentFigures = { dept: DepartmentRow; lines: LineFigures[] };

/** The opening row of a department on a day (the id link, with the legacy tag as a fallback for a row the back-fill could not match). */
export const openingOf = (day: DayRecord, dept: DepartmentRow): OpeningRow | undefined =>
  day.openings.find((o) => (dept.departmentId !== null && o.departmentId === dept.departmentId) || (o.departmentId === null && dept.departmentTag !== null && o.departmentTag === dept.departmentTag));

const sortByItem = (lines: LineRow[]): LineRow[] => [...lines].sort((a, b) => a.inventoryItem.name.localeCompare(b.inventoryItem.name));

/**
 * The figures of every line of a department on a day: frozen at the close for a closed day, read live for an open one (contract §5.2
 * to §5.5). `withYesterday` is skipped by callers that do not show it (it is one more query).
 */
export const departmentFigures = async (day: DayRecord, dept: DepartmentRow, opts: { withYesterday: boolean }, db?: Db): Promise<DepartmentFigures> => {
  const lines = sortByItem(dept.lines);
  const itemIds = lines.map((l) => l.inventoryItemId);
  const opening = openingOf(day, dept);
  const accepted = new Map((opening?.lines ?? []).map((l) => [l.inventoryItemId, l.acceptedQty]));
  const yesterday =
    opts.withYesterday && dept.departmentId !== null
      ? await repo.usedOn(day.siteId, dept.departmentId, itemIds, previousDate(day.businessDate), db)
      : new Map<string, Prisma.Decimal>();

  const frozen = day.status === 'CLOSED';
  if (frozen) {
    return {
      dept,
      lines: lines.map((line) => {
        const legacy = line.openingQty === null;
        const closing = line.countedQty;
        return {
          line,
          opening: line.openingQty ?? zero,
          received: line.receivedQty ?? zero,
          waste: line.wasteQty ?? zero,
          closing,
          used: legacy ? null : line.usedQty,
          unitCost: line.unitCost,
          yesterday: yesterday.get(line.inventoryItemId) ?? null,
          lastNight: line.openingQty ?? zero,
          accepted: accepted.get(line.inventoryItemId) ?? null,
          legacy,
        };
      }),
    };
  }

  const { start, end } = dayWindow(day.businessDate);
  const locationId = dept.locationId;
  const [previous, ledgerAtStart, received, waste, inbound] = await Promise.all([
    dept.departmentId !== null ? repo.previousClosing(day.siteId, dept.departmentId, itemIds, day.businessDate, db) : Promise.resolve(new Map<string, { qty: Prisma.Decimal; closedAt: Date | null }>()),
    repo.positions(day.siteId, locationId, itemIds, start, db),
    repo.received(day.siteId, locationId, itemIds, start, end, db),
    repo.waste(day.siteId, locationId, itemIds, start, end, db),
    repo.latestInboundCosts(day.siteId, locationId, itemIds, db),
  ]);

  return {
    dept,
    lines: lines.map((line) => {
      const id = line.inventoryItemId;
      const lastNightRow = previous.get(id)?.qty ?? null;
      const atStart = ledgerAtStart.get(id) ?? zero;
      const acceptedQty = accepted.get(id) ?? null;
      const openingQty = openingQtyOf({ accepted: acceptedQty, lastNight: lastNightRow, ledgerAtStart: atStart });
      const receivedQty = received.get(id) ?? zero;
      const wasteQty = waste.get(id) ?? zero;
      const closing = line.countedQty;
      return {
        line,
        opening: openingQty,
        received: receivedQty,
        waste: wasteQty,
        closing,
        used: usedTodayOf(openingQty, receivedQty, wasteQty, closing),
        unitCost: inbound.get(id) ?? line.inventoryItem.currentCost,
        yesterday: yesterday.get(id) ?? null,
        lastNight: lastNightQtyOf({ lastNight: lastNightRow, ledgerAtStart: atStart }),
        accepted: acceptedQty,
        legacy: false,
      };
    }),
  };
};

/** Used value of a department's counted lines; null until it has counted (a department with no items counted by rule is 0). */
export const usedValueOf = (figures: DepartmentFigures): Prisma.Decimal | null => {
  if (figures.dept.status !== 'COUNTED' && figures.lines.length > 0) return null;
  if (figures.lines.some((l) => l.legacy)) return null;
  return figures.lines.reduce((sum, l) => (l.used === null ? sum : sum.plus(valueOf(l.used, l.unitCost))), zero);
};

export const closingValueOf = (figures: DepartmentFigures): Prisma.Decimal =>
  figures.lines.reduce((sum, l) => (l.closing === null ? sum : sum.plus(valueOf(l.closing, l.unitCost))), zero);
