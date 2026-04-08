import { OrderStatus, PrepTicketStatus, type PrepStation, type Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { PrepTicketItemSnapshot } from '../types/order.types';

const localMidnightToday = (): Date => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

export type PrepTicketWithOrderRecord = Prisma.PrepTicketGetPayload<{
  include: {
    claimedBy: {
      select: {
        id: true;
        name: true;
      };
    };
    order: {
      select: {
        id: true;
        dailyNumber: true;
        type: true;
        tableNumber: true;
        notes: true;
        createdById: true;
        createdBy: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
  };
}>;

interface PrepTicketFilters {
  status?: PrepTicketStatus;
  startDate?: Date;
  endDate?: Date;
  claimedById?: string;
  activeOnly?: boolean;
  page: number;
  perPage: number;
}

const prepTicketInclude = {
  claimedBy: {
    select: {
      id: true,
      name: true,
    },
  },
  order: {
    select: {
      id: true,
      dailyNumber: true,
      type: true,
      tableNumber: true,
      notes: true,
      createdById: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export const prepTicketRepository = {
  findByIdAndOrg: async (id: string, organizationId: string): Promise<PrepTicketWithOrderRecord | null> => {
    return prisma.prepTicket.findFirst({
      where: {
        id,
        organizationId,
      },
      include: prepTicketInclude,
    });
  },

  findByStation: async (
    organizationId: string,
    station: PrepStation | PrepStation[],
    filters: PrepTicketFilters,
  ): Promise<{ tickets: PrepTicketWithOrderRecord[]; total: number }> => {
    const where: Prisma.PrepTicketWhereInput = {
      organizationId,
      station: Array.isArray(station) ? { in: station } : station,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.activeOnly
        ? {
            status: {
              in: [PrepTicketStatus.PENDING, PrepTicketStatus.IN_PROGRESS],
            },
            order: {
              status: {
                notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
              },
              orderDate: localMidnightToday(),
            },
          }
        : {}),
      ...(filters.claimedById ? { claimedById: filters.claimedById } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate ? { gte: filters.startDate } : {}),
              ...(filters.endDate ? { lte: filters.endDate } : {}),
            },
          }
        : {}),
    };

    const [total, tickets] = await prisma.$transaction([
      prisma.prepTicket.count({ where }),
      prisma.prepTicket.findMany({
        where,
        include: prepTicketInclude,
        orderBy: {
          createdAt: 'asc',
        },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
    ]);

    return {
      total,
      tickets,
    };
  },

  claim: async (
    id: string,
    organizationId: string,
    claimedById: string,
  ): Promise<PrepTicketWithOrderRecord | null> => {
    const claimedAt = new Date();
    const updated = await prisma.prepTicket.updateMany({
      where: {
        id,
        organizationId,
        status: PrepTicketStatus.PENDING,
      },
      data: {
        status: PrepTicketStatus.IN_PROGRESS,
        claimedById,
        claimedAt,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.prepTicket.findFirst({
      where: {
        id,
        organizationId,
      },
      include: prepTicketInclude,
    });
  },

  markReady: async (id: string, organizationId: string): Promise<PrepTicketWithOrderRecord | null> => {
    const readyAt = new Date();
    const updated = await prisma.prepTicket.updateMany({
      where: {
        id,
        organizationId,
        status: PrepTicketStatus.IN_PROGRESS,
      },
      data: {
        status: PrepTicketStatus.READY,
        readyAt,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.prepTicket.findFirst({
      where: {
        id,
        organizationId,
      },
      include: prepTicketInclude,
    });
  },

  findAllByOrder: async (orderId: string, organizationId: string): Promise<PrepTicketWithOrderRecord[]> => {
    return prisma.prepTicket.findMany({
      where: {
        orderId,
        organizationId,
      },
      include: prepTicketInclude,
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  reject: async (
    id: string,
    organizationId: string,
    rejectedById: string,
    rejectedReason: string,
  ): Promise<PrepTicketWithOrderRecord | null> => {
    const updated = await prisma.prepTicket.updateMany({
      where: {
        id,
        organizationId,
        status: { in: [PrepTicketStatus.PENDING, PrepTicketStatus.IN_PROGRESS] },
      },
      data: {
        status: PrepTicketStatus.REJECTED,
        claimedById: null,
        claimedAt: null,
        rejectedById,
        rejectedReason,
        rejectedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.prepTicket.findFirst({
      where: { id, organizationId },
      include: prepTicketInclude,
    });
  },

  unclaim: async (
    id: string,
    organizationId: string,
  ): Promise<PrepTicketWithOrderRecord | null> => {
    const updated = await prisma.prepTicket.updateMany({
      where: {
        id,
        organizationId,
        status: PrepTicketStatus.IN_PROGRESS,
      },
      data: {
        status: PrepTicketStatus.PENDING,
        claimedById: null,
        claimedAt: null,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.prepTicket.findFirst({
      where: { id, organizationId },
      include: prepTicketInclude,
    });
  },

  countInProgressByStaff: async (staffId: string, organizationId: string): Promise<number> => {
    return prisma.prepTicket.count({
      where: {
        organizationId,
        claimedById: staffId,
        status: PrepTicketStatus.IN_PROGRESS,
      },
    });
  },

  updateItemsSnapshot: async (
    id: string,
    organizationId: string,
    items: PrepTicketItemSnapshot[],
  ): Promise<PrepTicketWithOrderRecord | null> => {
    const updated = await prisma.prepTicket.updateMany({
      where: {
        id,
        organizationId,
      },
      data: {
        items: items as unknown as Prisma.InputJsonValue,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.prepTicket.findFirst({
      where: {
        id,
        organizationId,
      },
      include: prepTicketInclude,
    });
  },
};
