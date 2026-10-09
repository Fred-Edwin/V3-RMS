import type { Prisma, RequisitionStatus, RequisitionType } from '@prisma/client';
import { prisma } from '../../../config/database';
import { fileInclude, scopeWhere, type RequisitionRecord, type Scope } from './requisitions-repository';

/**
 * Reads for the lists, the badges, the head's home and history, the activity and the documents (R1, R2, R4, R5, R7, R9). Database
 * access only. Every query names the branch through `scopeWhere` (the caller's own branch, or `anyBranch` for a hub reader, which
 * still limits itself to branch sites and never the Central Store). A head is narrowed to their department by the service passing
 * `headDepartmentId`.
 */

export interface ListFilters {
  branchId?: string;
  q?: string;
  /** Inclusive start and exclusive end of the `openedAt` range (the service turns Nairobi dates into instants). */
  fromAt?: Date;
  toAt?: Date;
  status?: RequisitionStatus;
  cycle?: 'MORNING' | 'AFTERNOON' | 'EXTRA';
  departmentId?: string;
  urgent?: boolean;
  /** Set for a department head: only requisitions that have a section for this department. */
  headDepartmentId?: string | null;
  /** Limit to these statuses (the badges only look at live requisitions). */
  statuses?: RequisitionStatus[];
}

/** Old EVENING and AD_HOC rows are read as EXTRA (the migration maps them; new code writes only the three cycles). */
const CYCLE_TYPES: Record<NonNullable<ListFilters['cycle']>, RequisitionType[]> = {
  MORNING: ['MORNING'],
  AFTERNOON: ['AFTERNOON'],
  EXTRA: ['EXTRA', 'EVENING', 'AD_HOC'],
};

const whereOf = (scope: Scope, f: ListFilters): Prisma.RequisitionWhereInput => {
  const and: Prisma.RequisitionWhereInput[] = [];
  if (f.branchId) and.push({ siteId: f.branchId });
  if (f.status) and.push({ status: f.status });
  if (f.statuses) and.push({ status: { in: f.statuses } });
  if (f.cycle) and.push({ type: { in: CYCLE_TYPES[f.cycle] } });
  if (f.urgent === true) and.push({ urgent: true });
  if (f.urgent === false) and.push({ urgent: false });
  if (f.departmentId) and.push({ sections: { some: { departmentId: f.departmentId } } });
  if (f.headDepartmentId) and.push({ sections: { some: { departmentId: f.headDepartmentId } } });
  if (f.fromAt || f.toAt) and.push({ openedAt: { ...(f.fromAt ? { gte: f.fromAt } : {}), ...(f.toAt ? { lt: f.toAt } : {}) } });
  if (f.q) {
    and.push({
      OR: [
        { reference: { contains: f.q, mode: 'insensitive' } },
        { site: { name: { contains: f.q, mode: 'insensitive' } } },
        { sections: { some: { department: { name: { contains: f.q, mode: 'insensitive' } } } } },
        { sections: { some: { lines: { some: { deletedAt: null, item: { name: { contains: f.q, mode: 'insensitive' } } } } } } },
      ],
    });
  }
  return { ...scopeWhere(scope), AND: and };
};

const factsSelect = {
  id: true,
  siteId: true,
  status: true,
  openedAt: true,
  urgent: true,
  urgentAt: true,
  sections: {
    select: {
      departmentId: true,
      status: true,
      department: { select: { key: true, status: true } },
      // Whether the department has anything to pack (an addition still waiting for approval is not packed yet).
      lines: { where: { deletedAt: null, OR: [{ additionId: null }, { addition: { status: 'APPROVED' as const } }] }, select: { id: true }, take: 1 },
    },
  },
  additions: { where: { status: 'PENDING' as const }, select: { id: true, departmentId: true } },
  // The live dispatch of each department (a cancelled one is replaced); a discrepancy Open or reversed holds the requisition in Discrepancies.
  dispatches: {
    where: { status: { not: 'CANCELLED' as const } },
    select: { departmentId: true, status: true, signedAt: true, discrepancies: { where: { status: { in: ['OPEN' as const, 'REVERSED' as const] } }, select: { id: true }, take: 1 } },
  },
} satisfies Prisma.RequisitionSelect;

export type FactsRecord = Prisma.RequisitionGetPayload<{ select: typeof factsSelect }>;

export const requisitionsListRepository = {
  /** The light facts of every requisition inside the filters, newest first: enough to derive the tab, count and page. */
  listFacts: (scope: Scope, f: ListFilters): Promise<FactsRecord[]> =>
    prisma.requisition.findMany({ where: whereOf(scope, f), select: factsSelect, orderBy: [{ openedAt: 'desc' }, { id: 'desc' }] }),

  /** The full records of one page, in the order asked (`ids`). */
  findFiles: async (scope: Scope, ids: string[]): Promise<RequisitionRecord[]> => {
    if (ids.length === 0) return [];
    const rows = await prisma.requisition.findMany({ where: { id: { in: ids }, ...scopeWhere(scope) }, include: fileInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
  },

  /** Active branches, for a hub reader's picker (the one deliberate cross-site read; never the Central Store). */
  listBranches: (): Promise<Array<{ id: string; name: string; code: string | null }>> =>
    prisma.site.findMany({ where: { type: 'BRANCH', isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),

  /** Today's requisitions of one branch that have a section for the head's department, newest first (R7). */
  listTodayForDepartment: (siteId: string, departmentId: string, dayStart: Date, dayEnd: Date): Promise<RequisitionRecord[]> =>
    prisma.requisition.findMany({
      where: { siteId, openedAt: { gte: dayStart, lt: dayEnd }, sections: { some: { departmentId } } },
      include: fileInclude,
      orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    }),

  /** The departments of a requisition (ids), optionally only the ones that sent: who is told when it is signed or cancelled. */
  listSectionDepartmentIds: async (requisitionId: string, siteId: string, onlySent: boolean): Promise<string[]> => {
    const rows = await prisma.requisitionSection.findMany({
      where: { requisitionId, requisition: { siteId }, departmentId: { not: null }, ...(onlySent ? { status: 'SUBMITTED' as const } : { status: { not: 'SKIPPED' as const } }) },
      select: { departmentId: true },
    });
    return rows.flatMap((r) => (r.departmentId ? [r.departmentId] : []));
  },

  /** The events of one requisition, oldest first (R4). */
  listEvents: (requisitionId: string, siteId: string) =>
    prisma.requisitionEvent.findMany({
      where: { requisitionId, requisition: { siteId } },
      select: {
        id: true, type: true, at: true, sectionId: true, lineId: true, fromValue: true, toValue: true, reason: true, actorRoleLabel: true,
        actor: { select: { id: true, name: true } },
      },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
    }),

  /** Item name and unit for lines, soft-deleted ones included (an old quantity change still names its line). */
  findLineLabels: async (siteId: string, lineIds: string[]): Promise<Map<string, { itemName: string; unit: string }>> => {
    if (lineIds.length === 0) return new Map();
    const rows = await prisma.requisitionLine.findMany({
      where: { id: { in: lineIds }, section: { requisition: { siteId } } },
      select: { id: true, item: { select: { name: true, usageUnit: true } } },
    });
    return new Map(rows.map((r) => [r.id, { itemName: r.item.name, unit: r.item.usageUnit }]));
  },
};
