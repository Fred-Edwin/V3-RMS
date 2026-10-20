import type { CasualSheetStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import { toDateColumn } from '../../_shared/time/nairobi-time';

export type Db = Prisma.TransactionClient | typeof prisma;

const withLines = { lines: { include: { worker: true }, orderBy: { startMinute: 'asc' as const } }, corrections: { include: { worker: true }, orderBy: { createdAt: 'asc' as const } } };
export type SheetRow = Prisma.CasualSheetGetPayload<{ include: typeof withLines }>;

/** Reads of casual sheets. Every query names the company (and the site where the caller is limited to one). */
export const sheetRepository = {
  byId: (companyId: string, id: string, db: Db = prisma): Promise<SheetRow | null> => db.casualSheet.findFirst({ where: { id, companyId }, include: withLines }),

  /** The one live (not void) sheet for a department, site and day. */
  live: (companyId: string, siteId: string, departmentId: string, workDate: NairobiDate, db: Db = prisma): Promise<SheetRow | null> =>
    db.casualSheet.findFirst({ where: { companyId, siteId, departmentId, workDate: toDateColumn(workDate), status: { not: 'VOID' } }, include: withLines }),

  /** The department with its site, only if it is in this company. */
  department: (companyId: string, departmentId: string) =>
    prisma.department.findFirst({ where: { id: departmentId, site: { companyId } }, select: { id: true, name: true, siteId: true, status: true, site: { select: { name: true } } } }),

  names: async (ids: readonly string[]): Promise<Map<string, { name: string; role: string }>> => {
    const rows = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, role: true } });
    return new Map(rows.map((r) => [r.id, { name: r.name, role: r.role }]));
  },

  siteName: async (siteId: string): Promise<string> => (await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }))?.name ?? '',

  /** Sheets waiting for the approver, with what the "Needs you" card shows. */
  byStatus: (companyId: string, statuses: readonly CasualSheetStatus[], siteId: string | null, limit = 50) =>
    prisma.casualSheet.findMany({
      where: { companyId, status: { in: [...statuses] }, ...(siteId ? { siteId } : {}) },
      include: { lines: { select: { id: true, receivedAt: true, amount: true } }, corrections: { select: { amount: true } } },
      orderBy: [{ sentAt: 'desc' }, { workDate: 'desc' }],
      take: limit,
    }),

  /** Approved sheets with a worker still unsigned, older than `before` (the Branch Manager's unsigned list, PD25). */
  unsignedApproved: (companyId: string, siteId: string | null, before: Date) =>
    prisma.casualSheet.findMany({
      where: { companyId, status: 'APPROVED', approvedAt: { lt: before }, lines: { some: { receivedAt: null } }, ...(siteId ? { siteId } : {}) },
      include: { lines: { select: { id: true, receivedAt: true, amount: true } }, corrections: { select: { amount: true } } },
      orderBy: { approvedAt: 'asc' },
      take: 50,
    }),

  /** The last days of a department's sheets, newest first (the head's list). */
  recent: (companyId: string, siteId: string, departmentIds: readonly string[] | null, from: NairobiDate) =>
    prisma.casualSheet.findMany({
      where: { companyId, siteId, ...(departmentIds ? { departmentId: { in: [...departmentIds] } } : {}), workDate: { gte: toDateColumn(from) }, status: { not: 'VOID' } },
      include: { lines: { select: { id: true, receivedAt: true, amount: true } }, corrections: { select: { amount: true } } },
      orderBy: { workDate: 'desc' },
      take: 60,
    }),

  /** Approved sheets for a payroll month (the memo line, PD27). */
  approvedInRange: (companyId: string, from: NairobiDate, toExclusive: NairobiDate) =>
    prisma.casualSheet.findMany({
      where: { companyId, status: 'APPROVED', workDate: { gte: toDateColumn(from), lt: toDateColumn(toExclusive) } },
      include: { lines: { select: { workerId: true } } },
      orderBy: [{ workDate: 'desc' }, { number: 'desc' }],
    }),

  waitingInRange: (companyId: string, from: NairobiDate, toExclusive: NairobiDate) =>
    prisma.casualSheet.findMany({ where: { companyId, status: { in: ['SENT', 'SENT_BACK'] }, workDate: { gte: toDateColumn(from), lt: toDateColumn(toExclusive) } }, select: { id: true, siteId: true, departmentId: true, workDate: true, status: true } }),

  departmentNames: async (ids: readonly string[]): Promise<Map<string, string>> => new Map((await prisma.department.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })).map((d) => [d.id, d.name])),
  siteNames: async (ids: readonly string[]): Promise<Map<string, string>> => new Map((await prisma.site.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })).map((s) => [s.id, s.name])),
};
