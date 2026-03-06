import type { IncidentType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { CreateIncidentDto } from '../types/incident.types';

const incidentInclude = {
  actor: {
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
        actorId: data.actorId,
        details: data.details as Prisma.InputJsonValue,
      },
      include: incidentInclude,
    });
  },

  findMany: async (
    organizationId: string,
    filters: {
      type?: IncidentType;
      startDate?: Date;
      endDate?: Date;
      orderId?: string;
      page: number;
      perPage: number;
    },
  ) => {
    const where: Record<string, unknown> = { organizationId };

    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.orderId) {
      where.orderId = filters.orderId;
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
