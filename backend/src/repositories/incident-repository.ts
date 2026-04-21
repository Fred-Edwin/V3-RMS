import type { IncidentType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { CreateIncidentDto } from '../types/incident.types';

const incidentInclude = {
  actor: {
    select: { id: true, name: true },
  },
  organization: {
    select: { id: true, name: true },
  },
} as const;

export const incidentRepository = {
  create: async (data: CreateIncidentDto) => {
    return prisma.incidentLog.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId ?? null,
        type: data.type,
        actorId: data.actorId ?? null,
        details: data.details as Prisma.InputJsonValue,
      },
      include: incidentInclude,
    });
  },

  findStaleOrderIds: async (organizationId: string, orderIds: string[]): Promise<Set<string>> => {
    const rows = await prisma.incidentLog.findMany({
      where: { organizationId, type: 'ORDER_STALE', orderId: { in: orderIds } },
      select: { orderId: true },
    });
    return new Set(rows.map((r) => r.orderId).filter((id): id is string => id !== null));
  },

  findMany: async (
    organizationId: string | null,
    filters: {
      type?: IncidentType;
      startDate?: Date;
      endDate?: Date;
      orderId?: string;
      branchId?: string;
      page: number;
      perPage: number;
    },
  ) => {
    const where: Record<string, unknown> = organizationId ? { organizationId } : {};

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.orderId) {
      where.orderId = filters.orderId;
    }
    if (filters.branchId) {
      where.organizationId = filters.branchId;
    }
    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {};
      if (filters.startDate) {
        createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        const endOfDay = new Date(filters.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        createdAt.lte = endOfDay;
      }
      where.createdAt = createdAt;
    }

    const [total, incidents] = await prisma.$transaction([
      prisma.incidentLog.count({ where }),
      prisma.incidentLog.findMany({
        where,
        include: incidentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return { incidents, total };
  },
};
