import { Prisma } from '@prisma/client';
import { SHEET_ROWS_PER_PAGE, type Blocker, type HomeAction, type OpeningState } from './_shared/branch-day-contract';

/**
 * The pure rules of Branch day (contract §5): no database, no clock read (a clock is always passed in). Quantities are Prisma Decimals,
 * money is rounded to two decimals half up. Table-tested in `branch-day-rules.test.ts`.
 */

const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);
const ZERO = new Prisma.Decimal(0);
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Time -------------------------------------------------------------------------------------------------------------------------

/** The instants a Nairobi business date starts and ends (`businessDate` is the `@db.Date` value: midnight UTC of that date). */
export const dayWindow = (businessDate: Date): { start: Date; end: Date } => {
  const start = new Date(businessDate.getTime() - NAIROBI_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** The business date the day before (the Yesterday column reads that day). */
export const previousDate = (businessDate: Date): Date => new Date(businessDate.getTime() - DAY_MS);

/** The Nairobi hour (0 to 23) of an instant. */
export const nairobiHour = (now: Date): number => new Date(now.getTime() + NAIROBI_OFFSET_MS).getUTCHours();

/** `YYYY-MM-DD` of a `@db.Date` value. */
export const dateText = (businessDate: Date): string => businessDate.toISOString().slice(0, 10);

// --- Money ------------------------------------------------------------------------------------------------------------------------

export const money = (value: Prisma.Decimal): string => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);

/** A quantity on the wire: no trailing zeros ("3", "2.5", "-1"). */
export const qty = (value: Prisma.Decimal): string => value.toDecimalPlaces(4).toFixed();

// --- Opening, used today, yesterday (§5.2 to §5.5) ---------------------------------------------------------------------------------

/**
 * Opening stock for one item: the accepted figure when the opening was checked; otherwise last night's signed closing figure; otherwise
 * (no such line) the department location's ledger position at the start of the Nairobi day.
 */
export const openingQtyOf = (facts: { accepted: Prisma.Decimal | null; lastNight: Prisma.Decimal | null; ledgerAtStart: Prisma.Decimal }): Prisma.Decimal =>
  facts.accepted ?? facts.lastNight ?? facts.ledgerAtStart;

/** The figure the head is shown as "last night" (§5.2 steps 2 and 3): the signed figure, else the ledger position. */
export const lastNightQtyOf = (facts: { lastNight: Prisma.Decimal | null; ledgerAtStart: Prisma.Decimal }): Prisma.Decimal => facts.lastNight ?? facts.ledgerAtStart;

/** Used today = opening + received − waste − closing; null until the department has counted. A negative figure is kept as it is. */
export const usedTodayOf = (opening: Prisma.Decimal, received: Prisma.Decimal, waste: Prisma.Decimal, closing: Prisma.Decimal | null): Prisma.Decimal | null =>
  closing === null ? null : opening.plus(received).minus(waste).minus(closing);

/** The signed quantity of the usage entry: the closing count minus the ledger position now, so the ledger equals the count afterwards (§5.9). */
export const usageEntryQty = (closing: Prisma.Decimal, ledgerPosition: Prisma.Decimal): Prisma.Decimal => closing.minus(ledgerPosition);

/** The opening recount's difference against last night's figure (counted minus last night). Zero is no difference. */
export const differenceOf = (counted: Prisma.Decimal, lastNight: Prisma.Decimal): Prisma.Decimal => counted.minus(lastNight);

/** A line's value in KES, rounded to two decimals half up, so a department's and a day's totals are the sums of the figures drawn. */
export const valueOf = (quantity: Prisma.Decimal, unitCost: Prisma.Decimal): Prisma.Decimal => quantity.times(unitCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

// --- The department, the blockers, the heading (§5.6) ------------------------------------------------------------------------------

/** A department with no items counts as done; otherwise it has counted when its status says so. */
export const isCounted = (department: { status: 'NOT_STARTED' | 'COUNTED'; itemCount: number }): boolean => department.status === 'COUNTED' || department.itemCount === 0;

export type BlockerFacts = {
  departments: {
    id: string;
    name: string;
    status: 'NOT_STARTED' | 'COUNTED';
    itemCount: number;
    countedAt: Date | null;
    openingState: OpeningState;
  }[];
  /** Dispatches to the branch that left the store and are not confirmed. */
  onTheWay: { id: string; reference: string; signedAt: Date; department: { id: string; name: string } }[];
  /** Discrepancies of the branch that are open; they never block. */
  openDiscrepancies: { id: string; reference: string }[];
};

/** The facts under "Before the day can close", in the order Paper draws them: deliveries, then counts, then the opening notes. */
export const blockersOf = (facts: BlockerFacts): Blocker[] => {
  const out: Blocker[] = [];
  if (facts.onTheWay.length === 0) {
    out.push({ kind: 'DELIVERIES_CONFIRMED', severity: 'OK', department: null, dispatch: null, discrepancies: facts.openDiscrepancies, at: null, lastDepartment: null });
  } else {
    for (const d of facts.onTheWay) {
      out.push({
        kind: 'DELIVERY_NOT_CONFIRMED',
        severity: 'BLOCKS',
        department: d.department,
        dispatch: { id: d.id, reference: d.reference, signedAt: d.signedAt.toISOString() },
        discrepancies: [],
        at: null,
        lastDepartment: null,
      });
    }
  }
  const pending = facts.departments.filter((d) => !isCounted(d));
  if (pending.length === 0) {
    const signed = facts.departments.filter((d) => d.countedAt !== null).sort((a, b) => (b.countedAt?.getTime() ?? 0) - (a.countedAt?.getTime() ?? 0));
    const last = signed[0];
    out.push({
      kind: 'ALL_COUNTED',
      severity: 'OK',
      department: null,
      dispatch: null,
      discrepancies: [],
      at: last?.countedAt ? last.countedAt.toISOString() : null,
      lastDepartment: last ? { id: last.id, name: last.name } : null,
    });
  } else {
    for (const d of pending) {
      out.push({ kind: 'DEPARTMENT_NOT_COUNTED', severity: 'BLOCKS', department: { id: d.id, name: d.name }, dispatch: null, discrepancies: [], at: null, lastDepartment: null });
    }
  }
  for (const d of facts.departments) {
    if (d.status === 'COUNTED' && d.openingState === 'NOT_CHECKED') {
      out.push({ kind: 'OPENING_NOT_CHECKED', severity: 'INFO', department: { id: d.id, name: d.name }, dispatch: null, discrepancies: [], at: null, lastDepartment: null });
    }
  }
  return out;
};

export const summaryOf = (blockers: Blocker[]): { todo: number; toKnow: number } => ({
  todo: blockers.filter((b) => b.severity === 'BLOCKS').length,
  toKnow: blockers.filter((b) => b.severity === 'INFO').length,
});

/** The day can close when it is open and nothing blocks. */
export const canCloseOf = (dayStatus: 'OPEN' | 'CLOSED', blockers: Blocker[]): boolean => dayStatus === 'OPEN' && !blockers.some((b) => b.severity === 'BLOCKS');

// --- The head's Day home (§5, gap 8) ----------------------------------------------------------------------------------------------

/** One button: nothing once the count is signed; before 12:00 Nairobi "Check the opening" until it is checked; otherwise "Count your department". */
export const homeActionOf = (now: Date, countSigned: boolean, openingState: OpeningState): HomeAction => {
  if (countSigned) return 'NONE';
  if (nairobiHour(now) < 12 && openingState === 'NOT_CHECKED') return 'CHECK_OPENING';
  return 'COUNT';
};

// --- The correction window (§5.10) ------------------------------------------------------------------------------------------------

/** A correction is allowed until that department has an accepted opening on any later day of the branch. */
export const correctionWindowOpen = (laterOpeningExists: boolean): boolean => !laterOpeningExists;

// --- The day sheet pages (§5.12) ---------------------------------------------------------------------------------------------------

/** Pages one department takes: at least one, then a page per 16 rows. */
export const departmentPages = (itemCount: number): number => Math.max(1, Math.ceil(itemCount / SHEET_ROWS_PER_PAGE));

/** The page each department starts on (the cover is page 1) and the total page count. */
export const sheetLayout = (itemCounts: number[]): { pages: number[]; pageCount: number } => {
  let next = 2;
  const pages = itemCounts.map((count) => {
    const start = next;
    next += departmentPages(count);
    return start;
  });
  return { pages, pageCount: next - 1 };
};

export const zero = ZERO;
export const dec = D;
