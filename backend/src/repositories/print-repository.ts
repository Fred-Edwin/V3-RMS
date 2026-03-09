import { type PrintJobStatus, type Prisma } from '@prisma/client';
import { prisma } from '../config/database';

// ─── Print Job DTOs ────────────────────────────────────────────────────────

export interface PrintJobRecord {
  id: string;
  organizationId: string;
  orderId: string;
  status: PrintJobStatus;
  receiptData: Prisma.JsonValue;
  requestedById: string;
  printedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrintJobSummaryRecord {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  createdAt: Date;
}

// ─── Print Station DTOs ────────────────────────────────────────────────────

export interface PrintStationRecord {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Order data needed to assemble receipt ─────────────────────────────────

export interface OrderForReceipt {
  id: string;
  organizationId: string;
  dailyNumber: number;
  orderDate: Date;
  type: string;
  tableNumber: string | null;
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  total: Prisma.Decimal;
  paymentMethod: string | null;
  paidAt: Date | null;
  createdAt: Date;
  organization: {
    name: string;
  };
  createdBy: {
    name: string;
  };
  items: Array<{
    quantity: number;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    menuItem: {
      name: string;
    };
  }>;
}

// ─── Print Job Repository ──────────────────────────────────────────────────

export const printRepository = {
  createPrintJob: async (data: {
    organizationId: string;
    orderId: string;
    requestedById: string;
    receiptData: Prisma.InputJsonValue;
  }): Promise<PrintJobSummaryRecord> => {
    return prisma.printJob.create({
      data: {
        organizationId: data.organizationId,
        orderId: data.orderId,
        requestedById: data.requestedById,
        receiptData: data.receiptData,
      },
      select: {
        id: true,
        orderId: true,
        status: true,
        createdAt: true,
      },
    });
  },

  findPrintJobById: async (
    id: string,
    organizationId: string,
  ): Promise<PrintJobRecord | null> => {
    return prisma.printJob.findFirst({
      where: { id, organizationId },
    });
  },

  findActiveJobForOrder: async (
    orderId: string,
    organizationId: string,
  ): Promise<PrintJobSummaryRecord | null> => {
    return prisma.printJob.findFirst({
      where: {
        orderId,
        organizationId,
        status: { in: ['PENDING', 'PRINTING'] },
      },
      select: {
        id: true,
        organizationId: true,
        orderId: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  listPrintJobs: async (
    organizationId: string,
    filters: { status?: PrintJobStatus; page: number; perPage: number },
  ): Promise<{ jobs: PrintJobRecord[]; total: number }> => {
    const where: Prisma.PrintJobWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [jobs, total] = await prisma.$transaction([
      prisma.printJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.printJob.count({ where }),
    ]);

    return { jobs, total };
  },

  listPendingJobsForStation: async (
    organizationId: string,
    status: PrintJobStatus,
  ): Promise<PrintJobRecord[]> => {
    return prisma.printJob.findMany({
      where: { organizationId, status },
      orderBy: { createdAt: 'asc' },
    });
  },

  updatePrintJobStatus: async (
    id: string,
    organizationId: string,
    data: {
      status: PrintJobStatus;
      printedAt?: Date;
      failureReason?: string;
    },
  ): Promise<PrintJobRecord> => {
    return prisma.printJob.update({
      where: { id },
      data: {
        organizationId, // used for validation in service
        status: data.status,
        printedAt: data.printedAt,
        failureReason: data.failureReason,
      },
    });
  },

  expireOldPendingJobs: async (organizationId: string, before: Date): Promise<number> => {
    const result = await prisma.printJob.updateMany({
      where: {
        organizationId,
        status: 'PENDING',
        createdAt: { lt: before },
      },
      data: {
        status: 'FAILED',
        failureReason: 'Expired — not printed within 24h',
      },
    });
    return result.count;
  },

  findOrderForReceipt: async (
    orderId: string,
    organizationId: string,
  ): Promise<OrderForReceipt | null> => {
    return prisma.order.findFirst({
      where: { id: orderId, organizationId },
      select: {
        id: true,
        organizationId: true,
        dailyNumber: true,
        orderDate: true,
        type: true,
        tableNumber: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        organization: {
          select: { name: true },
        },
        createdBy: {
          select: { name: true },
        },
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            subtotal: true,
            menuItem: {
              select: { name: true },
            },
          },
        },
      },
    });
  },

  // ─── Print Station Repository ────────────────────────────────────────────

  createPrintStation: async (data: {
    organizationId: string;
    name: string;
    tokenHash: string;
  }): Promise<PrintStationRecord> => {
    return prisma.printStation.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        token: data.tokenHash,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  listPrintStations: async (organizationId: string): Promise<PrintStationRecord[]> => {
    return prisma.printStation.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        organizationId: true,
        name: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  },

  findPrintStationById: async (
    id: string,
    organizationId: string,
  ): Promise<PrintStationRecord | null> => {
    return prisma.printStation.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  deactivatePrintStation: async (id: string, organizationId: string): Promise<void> => {
    await prisma.printStation.updateMany({
      where: { id, organizationId },
      data: { isActive: false },
    });
  },

  updateHeartbeat: async (stationId: string): Promise<{ lastSeenAt: Date | null }> => {
    return prisma.printStation.update({
      where: { id: stationId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });
  },

  findPrintStationByTokenHash: async (
    tokenHash: string,
  ): Promise<{ id: string; organizationId: string; isActive: boolean } | null> => {
    return prisma.printStation.findUnique({
      where: { token: tokenHash },
      select: { id: true, organizationId: true, isActive: true },
    });
  },

  findStationWithOrg: async (
    stationId: string,
  ): Promise<{ id: string; organizationId: string; organization: { name: string } } | null> => {
    return prisma.printStation.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        organizationId: true,
        organization: {
          select: { name: true },
        },
      },
    });
  },
};
