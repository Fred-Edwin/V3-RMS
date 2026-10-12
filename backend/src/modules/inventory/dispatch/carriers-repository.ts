import type { CarrierKind } from '@prisma/client';
import { prisma } from '../../../config/database';

/** Carriers (P10): database access only. Every query names the hub (`siteId`, column `organization_id`). */
export const carriersRepository = {
  list: (hubId: string, status: 'active' | 'retired' | 'all') =>
    prisma.carrier.findMany({
      where: { siteId: hubId, ...(status === 'all' ? {} : { active: status === 'active' }) },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),

  find: (hubId: string, id: string) => prisma.carrier.findFirst({ where: { id, siteId: hubId } }),

  /** A carrier already using this name (case does not matter), other than `exceptId`. */
  findByName: (hubId: string, name: string, exceptId?: string) =>
    prisma.carrier.findFirst({ where: { siteId: hubId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } }),

  create: (hubId: string, data: { name: string; kind: CarrierKind }) => prisma.carrier.create({ data: { siteId: hubId, name: data.name, kind: data.kind } }),

  rename: (hubId: string, id: string, name: string) => prisma.carrier.updateMany({ where: { id, siteId: hubId }, data: { name } }),

  setActive: (hubId: string, id: string, active: boolean, now: Date) =>
    prisma.carrier.updateMany({ where: { id, siteId: hubId }, data: { active, retiredAt: active ? null : now } }),

  /** "Deliveries this month" (D18): dispatches signed with each carrier since `since`, cancelled ones left out. */
  countSignedSince: async (hubId: string, since: Date): Promise<Map<string, number>> => {
    const rows = await prisma.dispatch.groupBy({
      by: ['carrierId'],
      where: { siteId: hubId, carrierId: { not: null }, signedAt: { gte: since }, status: { not: 'CANCELLED' } },
      _count: { _all: true },
    });
    return new Map(rows.flatMap((r) => (r.carrierId ? [[r.carrierId, r._count._all] as const] : [])));
  },
};
