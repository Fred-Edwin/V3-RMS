import { prisma } from '../../../../config/database';
import { fromDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';

export interface IssuedSlipRow {
  id: string;
  siteId: string;
  slipNumber: number | null;
  slipHash: string | null;
  status: 'APPROVED' | 'CANCELLED';
  start: NairobiDate;
  end: NairobiDate;
  decidedAt: Date | null;
  decidedBy: string | null;
  deciderRole: string | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  employeeUserId: string | null;
}

/** Read-only queries for the Signed documents reconciliation. Every query carries the company. */
export const slipsRepository = {
  /** Every request that holds a slip number: approved ones, and cancelled ones (they keep the number and read as voided). */
  issued: async (companyId: string): Promise<IssuedSlipRow[]> => {
    const rows = await prisma.leaveApplication.findMany({
      where: { companyId, slipNumber: { not: null }, slipHash: { not: null }, status: { in: ['APPROVED', 'CANCELLED'] } },
      select: { id: true, siteId: true, employeeId: true, slipNumber: true, slipHash: true, status: true, startDate: true, endDate: true, decidedAt: true, decidedBy: true, deciderRole: true, cancelledAt: true, cancelledBy: true },
      orderBy: { slipNumber: 'asc' },
    });
    const employees = await prisma.employee.findMany({ where: { companyId, id: { in: [...new Set(rows.map((r) => r.employeeId))] } }, select: { id: true, userId: true } });
    const userOf = new Map(employees.map((e) => [e.id, e.userId] as const));
    return rows.map((r) => ({
      id: r.id,
      siteId: r.siteId,
      slipNumber: r.slipNumber,
      slipHash: r.slipHash,
      status: r.status as 'APPROVED' | 'CANCELLED',
      start: fromDateColumn(r.startDate),
      end: fromDateColumn(r.endDate),
      decidedAt: r.decidedAt,
      decidedBy: r.decidedBy,
      deciderRole: r.deciderRole,
      cancelledAt: r.cancelledAt,
      cancelledBy: r.cancelledBy,
      employeeUserId: userOf.get(r.employeeId) ?? null,
    }));
  },

  people: async (ids: readonly string[]): Promise<Map<string, { name: string; role: string }>> => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, role: true } });
    return new Map(rows.map((r) => [r.id, { name: r.name, role: r.role }] as const));
  },
};
