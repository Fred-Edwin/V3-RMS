import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

/** All Prisma access for shift templates. Every query carries the company; a template is never deleted. */
export type Db = Prisma.TransactionClient | typeof prisma;

const INCLUDE = { departments: { include: { department: { select: { id: true, name: true, siteId: true } } } } } satisfies Prisma.ShiftTemplateInclude;
export type TemplateRecord = Prisma.ShiftTemplateGetPayload<{ include: typeof INCLUDE }>;

export interface TemplateData {
  companyId: string;
  siteId: string | null;
  name: string;
  letter: string | null;
  colour: string;
  startTime: string;
  endTime: string;
  unpaidBreakMinutes: number;
  createdById: string | null;
}

/** The scope a list is for: one site (its own shifts plus the company-wide ones) or everything. */
export type TemplateScope = { kind: 'all' } | { kind: 'site'; siteId: string };

const scopeWhere = (scope: TemplateScope): Prisma.ShiftTemplateWhereInput =>
  scope.kind === 'all' ? {} : { OR: [{ siteId: null }, { siteId: scope.siteId }] };

export const templatesRepository = {
  list: (companyId: string, scope: TemplateScope, includeRetired: boolean): Promise<TemplateRecord[]> =>
    prisma.shiftTemplate.findMany({
      where: { companyId, ...scopeWhere(scope), ...(includeRetired ? { supersededById: null } : { isActive: true }) },
      include: INCLUDE,
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    }),

  findById: (companyId: string, id: string, db: Db = prisma): Promise<TemplateRecord | null> =>
    db.shiftTemplate.findFirst({ where: { id, companyId }, include: INCLUDE }),

  findManyByIds: (companyId: string, ids: readonly string[], db: Db = prisma): Promise<TemplateRecord[]> =>
    db.shiftTemplate.findMany({ where: { companyId, id: { in: [...ids] } }, include: INCLUDE }),

  /** Active templates in the same place with this name (case-insensitive), ignoring one row. */
  nameTaken: async (db: Db, companyId: string, siteId: string | null, name: string, exceptId: string | null): Promise<boolean> =>
    (await db.shiftTemplate.count({
      where: { companyId, siteId, isActive: true, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    })) > 0,

  /** A letter must be unique among the active shifts a person could see together: company-wide ones and the site's. */
  letterTaken: async (db: Db, companyId: string, siteId: string | null, letter: string, exceptId: string | null): Promise<boolean> =>
    (await db.shiftTemplate.count({
      where: {
        companyId,
        isActive: true,
        letter,
        ...(siteId === null ? {} : { OR: [{ siteId: null }, { siteId }] }),
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    })) > 0,

  departmentsInCompany: (companyId: string, ids: readonly string[]) =>
    prisma.department.findMany({ where: { id: { in: [...ids] }, site: { companyId } }, select: { id: true, siteId: true } }),

  siteInCompany: async (companyId: string, siteId: string): Promise<boolean> => (await prisma.site.count({ where: { id: siteId, companyId } })) > 0,

  create: (db: Db, data: TemplateData): Promise<{ id: string }> => db.shiftTemplate.create({ data, select: { id: true } }),

  update: (db: Db, id: string, data: Prisma.ShiftTemplateUpdateInput): Promise<unknown> => db.shiftTemplate.update({ where: { id }, data }),

  replaceDepartments: async (db: Db, templateId: string, departmentIds: readonly string[]): Promise<void> => {
    await db.shiftTemplateDepartment.deleteMany({ where: { templateId } });
    if (departmentIds.length > 0) await db.shiftTemplateDepartment.createMany({ data: departmentIds.map((departmentId) => ({ templateId, departmentId })) });
  },

  /** Shifts on this site's rota per template within a date range (the "this week" column). */
  countByTemplate: async (siteId: string, from: Date, to: Date): Promise<Map<string, number>> => {
    const rows = await prisma.rotaEntry.groupBy({ by: ['templateId'], where: { siteId, date: { gte: from, lte: to } }, _count: { _all: true } });
    return new Map(rows.map((row) => [row.templateId, row._count._all]));
  },

  /** Entries on or after a day, with who they are, so a change can be told to each person. */
  entriesFrom: (db: Db, templateId: string, from: Date) =>
    db.rotaEntry.findMany({
      where: { templateId, date: { gte: from } },
      select: { id: true, date: true, siteId: true, employee: { select: { id: true, userId: true } } },
    }),

  hasEntriesBefore: async (db: Db, templateId: string, before: Date): Promise<boolean> =>
    (await db.rotaEntry.count({ where: { templateId, date: { lt: before } } })) > 0,

  moveEntriesFrom: (db: Db, fromId: string, toId: string, from: Date): Promise<{ count: number }> =>
    db.rotaEntry.updateMany({ where: { templateId: fromId, date: { gte: from } }, data: { templateId: toId } }),
};
