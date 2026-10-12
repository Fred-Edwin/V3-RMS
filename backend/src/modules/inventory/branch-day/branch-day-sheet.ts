import type { Prisma } from '@prisma/client';
import type { DaySheet, SheetDepartment, SheetKind, SheetLine } from './_shared/branch-day-contract';
import { closingValueOf, usedValueOf, type DepartmentFigures } from './branch-day-figures';
import type { DayRecord, Person } from './branch-day-repository';
import { dateText, money, qty, sheetLayout, valueOf, zero } from './branch-day-rules';
import { deliveryFactOf, lineCorrectionOf, openingDifferencesOf, openingStateOf, person, type DeliveryRow } from './branch-day-view';
import { openingOf } from './branch-day-figures';

/**
 * The stored day sheet (contract §5.12): made at the close (version 1) and after every correction (version n+1) from the same figures
 * the day file shows, stored whole in `branch_day_sheets.payload` in the shape of `daySheet`. Pure: the caller loads the records.
 * Printing returns the stored copy with `printedAt` set to the moment of the request.
 */
export type SheetInput = {
  day: DayRecord;
  branch: { id: string; name: string; code: string | null; address: string | null; phone: string | null };
  figures: DepartmentFigures[];
  heads: Map<string, Person>;
  deliveries: DeliveryRow[];
  openDiscrepancies: { reference: string; departmentId: string | null; itemName: string }[];
  kind: SheetKind;
  version: number;
  madeAt: Date;
  /** The address the QR on the last page opens: the day file. */
  qrUrl: string;
  /** After a correction the notes of the sheet made at the close stand (they say what was open when the day closed). */
  notes?: DaySheet['notes'];
};

/** The pages of the sheet, known before it is made (the cover is page 1). */
export const sheetPageCount = (figures: DepartmentFigures[]): number => sheetLayout(figures.map((f) => f.lines.length)).pageCount;

const sheetLineOf = (position: number, f: DepartmentFigures['lines'][number]): SheetLine => {
  const closing = f.closing ?? zero;
  const used = f.used ?? zero;
  return {
    position,
    itemName: f.line.inventoryItem.name,
    unit: f.line.inventoryItem.usageUnit,
    openingQty: qty(f.opening),
    receivedQty: qty(f.received),
    wasteQty: qty(f.waste),
    closingQty: qty(closing),
    usedQty: qty(used),
    usedValueKes: money(valueOf(used, f.unitCost)),
    closingValueKes: money(valueOf(closing, f.unitCost)),
    correction: lineCorrectionOf(f.line),
  };
};

export const buildSheet = (input: SheetInput): DaySheet => {
  const { day, figures } = input;
  const closedBy = day.closedBy;
  if (!closedBy || !day.closedAt) throw new Error('A day sheet is made from a closed day');
  const closedAt = day.closedAt;
  const layout = sheetLayout(figures.map((f) => f.lines.length));
  const names = new Map(figures.map((f) => [f.dept.departmentId ?? f.dept.id, f.dept.department?.name ?? '']));

  const departments: SheetDepartment[] = figures.map((f, index) => {
    const dept = f.dept;
    const id = dept.departmentId ?? dept.id;
    const used = usedValueOf(f) ?? zero;
    const delivery = deliveryFactOf(dept.departmentId, input.deliveries);
    return {
      position: index + 1,
      department: { id, name: dept.department?.name ?? '' },
      head: (() => {
        const head = dept.departmentId ? input.heads.get(dept.departmentId) : undefined;
        return head ? person(head) : null;
      })(),
      itemCount: f.lines.length,
      usedValueKes: money(used),
      closingValueKes: money(closingValueOf(f)),
      page: layout.pages[index] ?? 2,
      corrected: f.lines.some((l) => l.line.corrections.length > 0),
      // A department with no items is counted by rule: nobody signed, so the close stands in for it.
      countedAt: (dept.countedAt ?? closedAt).toISOString(),
      countedBy: person(dept.countedBy ?? closedBy),
      onBehalf: dept.onBehalf,
      opening: {
        state: openingStateOf(day, dept),
        checkedAt: openingOf(day, dept)?.acceptedAt.toISOString() ?? null,
        differenceCount: openingDifferencesOf(day, dept).length,
      },
      delivery: { state: delivery.state, dispatches: delivery.dispatches.map((d) => d.reference) },
      lines: f.lines.map((line, i) => sheetLineOf(i + 1, line)),
    };
  });

  const corrections = figures
    .flatMap((f) => f.lines.flatMap((l) => l.line.corrections.map((c) => ({ c, department: f.dept.department?.name ?? '', item: l.line.inventoryItem.name }))))
    .sort((a, b) => a.c.correctedAt.getTime() - b.c.correctedAt.getTime());
  const lastCorrection = corrections[corrections.length - 1];

  const itemCount = departments.reduce((n, d) => n + d.itemCount, 0);
  const sum = (pick: (d: SheetDepartment) => string): string => money(departments.reduce((s, d) => s.plus(pick(d)), zero as Prisma.Decimal));

  return {
    reference: day.reference,
    date: dateText(day.businessDate),
    branch: input.branch,
    version: input.version,
    kind: input.kind,
    closedAt: closedAt.toISOString(),
    closedBy: person(closedBy),
    correctedAt: input.kind === 'AFTER_CORRECTION' && lastCorrection ? lastCorrection.c.correctedAt.toISOString() : null,
    printedAt: input.madeAt.toISOString(),
    totals: { itemCount, usedValueKes: sum((d) => d.usedValueKes), closingValueKes: sum((d) => d.closingValueKes) },
    pageCount: layout.pageCount,
    departments,
    corrections: corrections.map(({ c, department, item }) => ({
      at: c.correctedAt.toISOString(),
      by: person(c.correctedBy),
      departmentName: department,
      itemName: item,
      fromClosingQty: qty(c.fromClosingQty),
      toClosingQty: qty(c.toClosingQty),
      reason: c.reason,
    })),
    notes: input.notes ?? {
      openingNotChecked: figures.filter((f) => f.dept.status === 'COUNTED' && openingStateOf(day, f.dept) === 'NOT_CHECKED').map((f) => f.dept.department?.name ?? ''),
      openDiscrepancies: input.openDiscrepancies.map((d) => ({ reference: d.reference, departmentName: d.departmentId ? (names.get(d.departmentId) ?? '') : '', itemName: d.itemName })),
    },
    qrUrl: input.qrUrl,
  };
};
