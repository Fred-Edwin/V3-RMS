import type { Prisma } from '@prisma/client';
import { toPerson } from '../counting/_shared/count-people';
import type {
  Blocker,
  CountState,
  CountView,
  DayDocument,
  DayHead,
  DayStatus,
  DeliveryFact,
  DepartmentTile,
  FigureLine,
  LedgerEntry,
  LineCorrection,
  OpeningCheck,
  OpeningDifference,
  OpeningState,
  OpeningView,
} from './_shared/branch-day-contract';
import { closingValueOf, openingOf, usedValueOf, type DepartmentFigures, type LineFigures } from './branch-day-figures';
import type { CorrectionRow, DayRecord, DepartmentRow, LineRow, Person } from './branch-day-repository';
import { dateText, isCounted, money, qty, valueOf } from './branch-day-rules';

/**
 * Response builders (contract §4): records and figures in, wire shapes out. Pure, no database. Money keys are added only when the
 * caller holds `catalog.see_costs` (`seeCosts`) and are ABSENT otherwise, never null; the blind count carries none of the figure keys.
 */

export const person = (p: Person) => toPerson(p);

export const hasCorrections = (day: DayRecord): boolean => day.departments.some((d) => d.lines.some((l) => l.corrections.length > 0));

export const dayStatusOf = (day: Pick<DayRecord, 'status'>, corrected: boolean): DayStatus => (day.status === 'OPEN' ? 'OPEN' : corrected ? 'CORRECTED' : 'CLOSED');

export const dayHeadOf = (day: DayRecord): DayHead => ({ id: day.id, reference: day.reference, date: dateText(day.businessDate), status: dayStatusOf(day, hasCorrections(day)) });

export const branchRefOf = (site: { id: string; name: string; code: string | null }) => ({ id: site.id, name: site.name, code: site.code });

export const departmentRefOf = (dept: DepartmentRow): { id: string; name: string } => ({ id: dept.departmentId ?? dept.id, name: dept.department?.name ?? '' });

/** The department row as the wire's `departmentId`: the Block 1 id (a row the back-fill could not link has none and is never read). */
export const wireDepartmentId = (dept: DepartmentRow): string => dept.departmentId ?? dept.id;

// --- Opening ---------------------------------------------------------------------------------------------------------------------------

const itemNames = (dept: DepartmentRow): Map<string, { name: string; unit: string }> => new Map(dept.lines.map((l) => [l.inventoryItemId, { name: l.inventoryItem.name, unit: l.inventoryItem.usageUnit }]));

export const openingStateOf = (day: DayRecord, dept: DepartmentRow): OpeningState => {
  const opening = openingOf(day, dept);
  return opening ? (opening.kind === 'RECOUNTED' ? 'RECOUNTED' : 'ACCEPTED') : 'NOT_CHECKED';
};

/** The differences a recount left: counted minus last night, never zero, by item name. */
export const openingDifferencesOf = (day: DayRecord, dept: DepartmentRow): OpeningDifference[] => {
  const opening = openingOf(day, dept);
  if (!opening) return [];
  const names = itemNames(dept);
  return opening.lines
    .filter((l) => !l.overnightVariance.isZero())
    .flatMap((l) => {
      const item = names.get(l.inventoryItemId);
      return item
        ? [{ itemId: l.inventoryItemId, itemName: item.name, unit: item.unit, lastNightQty: qty(l.prefilledQty), countedQty: qty(l.acceptedQty), difference: qty(l.overnightVariance) }]
        : [];
    })
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
};

export const openingCheckOf = (day: DayRecord, dept: DepartmentRow): OpeningCheck => {
  const opening = openingOf(day, dept);
  return {
    state: openingStateOf(day, dept),
    checkedAt: opening ? opening.acceptedAt.toISOString() : null,
    checkedBy: opening ? person(opening.acceptedBy) : null,
    onBehalf: opening?.onBehalf ?? false,
    differences: openingDifferencesOf(day, dept),
  };
};

export const openingViewOf = (day: DayRecord, dept: DepartmentRow, figures: DepartmentFigures, lastCloseAt: Date | null): OpeningView => ({
  day: dayHeadOf(day),
  department: departmentRefOf(dept),
  itemCount: dept.lines.length,
  lastCloseAt: lastCloseAt ? lastCloseAt.toISOString() : null,
  check: openingCheckOf(day, dept),
  lines: figures.lines.map((f) => ({
    itemId: f.line.inventoryItemId,
    itemName: f.line.inventoryItem.name,
    unit: f.line.inventoryItem.usageUnit,
    lastNightQty: qty(f.lastNight),
    acceptedQty: f.accepted ? qty(f.accepted) : null,
  })),
});

// --- Deliveries ---------------------------------------------------------------------------------------------------------------------------

export type DeliveryRow = {
  id: string;
  reference: string | null;
  status: string;
  departmentId: string;
  countedAt: Date | null;
  discrepancies: { id: string; status: string }[];
};

export const deliveryFactOf = (departmentId: string | null, deliveries: DeliveryRow[]): DeliveryFact => {
  const mine = deliveries.filter((d) => d.departmentId === departmentId);
  if (mine.length === 0) return { state: 'NONE', dispatches: [], confirmedAt: null, gapCount: 0, gapOpen: false };
  const waiting = mine.some((d) => d.status === 'ON_THE_WAY');
  const confirmed = mine.flatMap((d) => (d.countedAt ? [d.countedAt] : []));
  const latest = confirmed.length > 0 ? new Date(Math.max(...confirmed.map((c) => c.getTime()))) : null;
  return {
    state: waiting ? 'WAITING' : 'CONFIRMED',
    dispatches: mine.map((d) => ({ id: d.id, reference: d.reference ?? '' })),
    confirmedAt: waiting || !latest ? null : latest.toISOString(),
    gapCount: waiting ? 0 : mine.reduce((n, d) => n + d.discrepancies.length, 0),
    gapOpen: mine.some((d) => d.discrepancies.some((x) => x.status === 'OPEN')),
  };
};

// --- Tiles and figures ------------------------------------------------------------------------------------------------------------------

export const countStateOf = (dept: Pick<DepartmentRow, 'status'> & { lines: unknown[] }): CountState => (isCounted({ status: dept.status, itemCount: dept.lines.length }) ? 'COUNTED' : 'NOT_COUNTED');

export const tileOf = (day: DayRecord, figures: DepartmentFigures | null, dept: DepartmentRow, head: Person | null, seeCosts: boolean): DepartmentTile => {
  const used = figures ? usedValueOf(figures) : null;
  return {
    departmentId: wireDepartmentId(dept),
    name: dept.department?.name ?? '',
    head: head ? person(head) : null,
    state: countStateOf(dept),
    countedAt: dept.countedAt ? dept.countedAt.toISOString() : null,
    countedBy: dept.countedBy ? person(dept.countedBy) : null,
    onBehalf: dept.onBehalf,
    itemCount: dept.lines.length,
    opening: { state: openingStateOf(day, dept), differences: openingDifferencesOf(day, dept) },
    ...(seeCosts ? { usedValueKes: used ? money(used) : null } : {}),
  };
};

const correctionWire = (c: CorrectionRow, from: CorrectionRow, to: CorrectionRow): LineCorrection => ({
  id: c.id,
  at: c.correctedAt.toISOString(),
  by: person(c.correctedBy),
  fromClosingQty: qty(from.fromClosingQty),
  toClosingQty: qty(to.toClosingQty),
  fromUsedQty: qty(from.fromUsedQty),
  toUsedQty: qty(to.toUsedQty),
  reason: c.reason,
  note: c.note,
});

/** The latest correction of a line: the figure as signed at the close (the first correction's "from") and as corrected (the last "to"). */
export const lineCorrectionOf = (line: LineRow): LineCorrection | null => {
  const first = line.corrections[0];
  const last = line.corrections[line.corrections.length - 1];
  return first && last ? correctionWire(last, first, last) : null;
};

export const figureLineOf = (f: LineFigures, seeCosts: boolean): FigureLine => ({
  itemId: f.line.inventoryItemId,
  itemName: f.line.inventoryItem.name,
  unit: f.line.inventoryItem.usageUnit,
  openingQty: qty(f.opening),
  receivedQty: qty(f.received),
  wasteQty: qty(f.waste),
  closingQty: f.closing ? qty(f.closing) : null,
  usedQty: f.used ? qty(f.used) : null,
  yesterdayUsedQty: f.yesterday ? qty(f.yesterday) : null,
  ...(seeCosts
    ? {
        unitCostKes: money(f.unitCost),
        usedValueKes: f.used ? money(valueOf(f.used, f.unitCost)) : null,
        closingValueKes: f.closing ? money(valueOf(f.closing, f.unitCost)) : null,
      }
    : {}),
  correction: lineCorrectionOf(f.line),
});

export const totalsOf = (figures: DepartmentFigures): { usedValueKes: string | null; closingValueKes: string | null } => {
  const used = usedValueOf(figures);
  return { usedValueKes: used ? money(used) : null, closingValueKes: figures.lines.some((l) => l.closing !== null) ? money(closingValueOf(figures)) : null };
};

// --- The blind count ----------------------------------------------------------------------------------------------------------------------

/** The category path of an item: the top-level category, then its sub-category ("Dairy", "Milk"). */
const pathOf = (line: LineRow, parentNames: Map<string, string>): string[] => {
  const category = line.inventoryItem.category;
  if (!category) return [];
  const parent = category.parentCategoryId ? parentNames.get(category.parentCategoryId) : undefined;
  return parent ? [parent, category.name] : [category.name];
};

/** The blind count: the items, units, categories and what was typed. NOTHING to count against (a test pins the key names). */
export const countViewOf = (day: DayRecord, dept: DepartmentRow, onBehalfOfDepartment: boolean, parentNames: Map<string, string>): CountView => {
  const lines = dept.lines
    .map((line) => ({ line, path: pathOf(line, parentNames) }))
    .sort((a, b) => a.path.join('/').localeCompare(b.path.join('/')) || a.line.inventoryItem.name.localeCompare(b.line.inventoryItem.name));
  const filled = lines.filter((l) => l.line.countedQty !== null).length;
  const groups: { name: string; itemCount: number }[] = [];
  for (const { path } of lines) {
    const name = path[0] ?? 'Other';
    const group = groups.find((g) => g.name === name);
    if (group) group.itemCount += 1;
    else groups.push({ name, itemCount: 1 });
  }
  const state = countStateOf(dept);
  return {
    day: dayHeadOf(day),
    department: departmentRefOf(dept),
    onBehalfOfDepartment,
    state,
    lines: lines.map(({ line, path }) => ({
      itemId: line.inventoryItemId,
      itemName: line.inventoryItem.name,
      unit: line.inventoryItem.usageUnit,
      categoryPath: path,
      countedQty: line.countedQty ? qty(line.countedQty) : null,
    })),
    summary: { itemCount: lines.length, filledCount: filled, blankCount: lines.length - filled, groups },
    canSign: state === 'NOT_COUNTED' && lines.length > 0 && filled === lines.length && day.status === 'OPEN',
    signedAt: dept.countedAt ? dept.countedAt.toISOString() : null,
    signedBy: dept.countedBy ? person(dept.countedBy) : null,
  };
};

// --- The ledger entries and the sheets ---------------------------------------------------------------------------------------------------

export type EntryRow = {
  id: string;
  createdAt: Date;
  quantity: Prisma.Decimal;
  reference: string | null;
  inventoryItem: { name: string; usageUnit: string };
  branchDayLine: { department: { department: { id: string; name: string } | null } } | null;
};

export const ledgerEntryOf = (row: EntryRow, kind: 'USAGE' | 'CORRECTION', dayReference: string): LedgerEntry => ({
  id: row.id,
  at: row.createdAt.toISOString(),
  itemName: row.inventoryItem.name,
  unit: row.inventoryItem.usageUnit,
  department: { id: row.branchDayLine?.department.department?.id ?? '', name: row.branchDayLine?.department.department?.name ?? '' },
  quantity: qty(row.quantity),
  reference: row.reference ?? dayReference,
  kind,
});

export const dayDocumentOf = (sheet: { id: string; version: number; kind: 'AT_THE_CLOSE' | 'AFTER_CORRECTION'; pages: number; createdAt: Date }, latestVersion: number, reference: string): DayDocument => ({
  id: sheet.id,
  version: sheet.version,
  kind: sheet.kind,
  latest: sheet.version === latestVersion,
  reference,
  pages: sheet.pages,
  madeAt: sheet.createdAt.toISOString(),
});

export const blockerDepartmentId = (b: Blocker): string | null => b.department?.id ?? null;
