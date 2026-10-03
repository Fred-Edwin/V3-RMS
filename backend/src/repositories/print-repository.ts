import { Prisma, type PrintJobStatus, type ReceiptType } from '@prisma/client';
import { prisma } from '../config/database';

// ─── Print Job DTOs ────────────────────────────────────────────────────────

export interface PrintJobRecord {
  id: string;
  siteId: string;
  orderId: string | null;
  activeKey: string | null;
  receiptType: ReceiptType;
  copies: number;
  status: PrintJobStatus;
  receiptData: Prisma.JsonValue;
  requestedById: string;
  targetStationId: string | null;
  claimedByStationId: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  printAttemptCount: number;
  printedByStationId: string | null;
  printedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrintJobSummaryRecord {
  id: string;
  orderId: string | null;
  receiptType: ReceiptType;
  copies: number;
  status: PrintJobStatus;
  targetStationId: string | null;
  createdAt: Date;
}

// ─── Corporate account settlement data needed to assemble receipt ─────────

export interface SettlementForReceipt {
  id: string;
  amount: Prisma.Decimal;
  paymentMethod: string;
  note: string | null;
  createdAt: Date;
  settledBy: {
    name: string;
  };
  corporateAccount: {
    companyName: string;
    contactName: string;
    currentBalance: Prisma.Decimal;
  };
}

// ─── Print Station DTOs ────────────────────────────────────────────────────

export interface PrintStationRecord {
  id: string;
  siteId: string;
  name: string;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Order data needed to assemble receipt ─────────────────────────────────

export interface OrderForReceipt {
  id: string;
  siteId: string;
  dailyNumber: number;
  orderDate: Date;
  type: string;
  tableNumber: string | null;
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  total: Prisma.Decimal;
  paymentMethod: string | null;
  mpesaCode: string | null;
  mpesaAmount: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  cardAmount: Prisma.Decimal | null;
  splitType: string | null;
  paidAt: Date | null;
  createdAt: Date;
  site: {
    name: string;
    phone: string | null;
    mpesaPaybill: string | null;
    accountNumber: string | null;
    googleReviewUrl: string | null;
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
  splitPaymentLines: Array<{
    label: string;
    amount: Prisma.Decimal;
    method: string;
    mpesaCode: string | null;
  }>;
}

// ─── Print Job Repository ──────────────────────────────────────────────────

export const printRepository = {
  createPrintJob: async (data: {
    siteId: string;
    orderId?: string;
    corporateAccountSettlementId?: string;
    requestedById: string;
    receiptType: ReceiptType;
    copies: number;
    activeKey: string;
    receiptData: Prisma.InputJsonValue;
    targetStationId?: string | null;
  }): Promise<PrintJobSummaryRecord> => {
    return prisma.printJob.create({
      data: {
        siteId: data.siteId,
        orderId: data.orderId ?? null,
        corporateAccountSettlementId: data.corporateAccountSettlementId ?? null,
        requestedById: data.requestedById,
        receiptType: data.receiptType,
        copies: data.copies,
        activeKey: data.activeKey,
        receiptData: data.receiptData,
        targetStationId: data.targetStationId ?? null,
      },
      select: {
        id: true,
        orderId: true,
        receiptType: true,
        copies: true,
        status: true,
        targetStationId: true,
        createdAt: true,
      },
    });
  },

  findPrintJobById: async (
    id: string,
    siteId: string,
  ): Promise<PrintJobRecord | null> => {
    return prisma.printJob.findFirst({
      where: { id, siteId },
    });
  },

  findActiveJobForOrder: async (
    orderId: string,
    siteId: string,
    receiptType: ReceiptType,
  ): Promise<PrintJobSummaryRecord | null> => {
    return prisma.printJob.findFirst({
      where: {
        orderId,
        siteId,
        receiptType,
        status: { in: ['PENDING', 'PRINTING'] },
      },
      select: {
        id: true,
        siteId: true,
        orderId: true,
        receiptType: true,
        copies: true,
        status: true,
        targetStationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  findActiveJobByActiveKey: async (
    activeKey: string,
    siteId: string,
  ): Promise<PrintJobSummaryRecord | null> => {
    return prisma.printJob.findFirst({
      where: {
        activeKey,
        siteId,
        status: { in: ['PENDING', 'PRINTING'] },
      },
      select: {
        id: true,
        siteId: true,
        orderId: true,
        receiptType: true,
        copies: true,
        status: true,
        targetStationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  listPrintJobs: async (
    siteId: string,
    filters: { status?: PrintJobStatus; page: number; perPage: number },
  ): Promise<{ jobs: PrintJobRecord[]; total: number }> => {
    const where: Prisma.PrintJobWhereInput = {
      siteId,
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
    siteId: string,
    status: PrintJobStatus,
  ): Promise<PrintJobRecord[]> => {
    return prisma.printJob.findMany({
      where: { siteId, status },
      orderBy: { createdAt: 'asc' },
    });
  },

  claimPendingJobsForStation: async (
    siteId: string,
    stationId: string,
    limit: number,
    leaseTtlSeconds: number,
    now: Date,
  ): Promise<PrintJobRecord[]> => {
    const leaseExpiresAt = new Date(now.getTime() + leaseTtlSeconds * 1000);

    return prisma.$queryRaw<PrintJobRecord[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "public"."print_jobs"
        WHERE "organization_id" = ${siteId}
          AND ("target_station_id" = ${stationId} OR "target_station_id" IS NULL)
          AND (
            "status" = 'PENDING'
            OR ("status" = 'PRINTING' AND ("lease_expires_at" IS NULL OR "lease_expires_at" < ${now}))
          )
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "public"."print_jobs" AS pj
      SET "status" = 'PRINTING',
          "claimed_by_station_id" = ${stationId},
          "claimed_at" = ${now},
          "lease_expires_at" = ${leaseExpiresAt},
          "print_attempt_count" = pj."print_attempt_count" + 1,
          "active_key" = COALESCE(pj."active_key", pj."order_id" || ':' || pj."receipt_type")
      FROM candidates
      WHERE pj."id" = candidates."id"
      RETURNING
        pj."id",
        pj."organization_id" AS "siteId",
        pj."order_id" AS "orderId",
        pj."active_key" AS "activeKey",
        pj."receipt_type" AS "receiptType",
        pj."copies",
        pj."status",
        pj."receipt_data" AS "receiptData",
        pj."requested_by_id" AS "requestedById",
        pj."target_station_id" AS "targetStationId",
        pj."claimed_by_station_id" AS "claimedByStationId",
        pj."claimed_at" AS "claimedAt",
        pj."lease_expires_at" AS "leaseExpiresAt",
        pj."print_attempt_count" AS "printAttemptCount",
        pj."printed_by_station_id" AS "printedByStationId",
        pj."printed_at" AS "printedAt",
        pj."failure_reason" AS "failureReason",
        pj."created_at" AS "createdAt",
        pj."updated_at" AS "updatedAt"
    `);
  },

  updatePrintJobStatus: async (
    id: string,
    siteId: string,
    data: {
      status: PrintJobStatus;
      printedAt?: Date;
      failureReason?: string;
      activeKey?: string | null;
      claimedByStationId?: string | null;
      claimedAt?: Date | null;
      leaseExpiresAt?: Date | null;
      printedByStationId?: string | null;
    },
  ): Promise<PrintJobRecord> => {
    return prisma.printJob.update({
      where: { id, siteId },
      data: {
        status: data.status,
        printedAt: data.printedAt,
        failureReason: data.failureReason,
        activeKey: data.activeKey,
        claimedByStationId: data.claimedByStationId,
        claimedAt: data.claimedAt,
        leaseExpiresAt: data.leaseExpiresAt,
        printedByStationId: data.printedByStationId,
      },
    });
  },

  expireOldPendingJobs: async (siteId: string, before: Date): Promise<number> => {
    const result = await prisma.printJob.updateMany({
      where: {
        siteId,
        status: 'PENDING',
        createdAt: { lt: before },
      },
      data: {
        status: 'FAILED',
        failureReason: 'Expired — not printed within 24h',
        activeKey: null,
        claimedByStationId: null,
        claimedAt: null,
        leaseExpiresAt: null,
      },
    });
    return result.count;
  },

  findOrderForReceipt: async (
    orderId: string,
    siteId: string,
  ): Promise<OrderForReceipt | null> => {
    return prisma.order.findFirst({
      where: { id: orderId, siteId },
      select: {
        id: true,
        siteId: true,
        dailyNumber: true,
        orderDate: true,
        type: true,
        tableNumber: true,
        subtotal: true,
        deliveryFee: true,
        total: true,
        paymentMethod: true,
        mpesaCode: true,
        mpesaAmount: true,
        cashAmount: true,
        cardAmount: true,
        splitType: true,
        paidAt: true,
        createdAt: true,
        site: {
          select: { name: true, phone: true, mpesaPaybill: true, accountNumber: true, googleReviewUrl: true },
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
        splitPaymentLines: {
          select: { label: true, amount: true, method: true, mpesaCode: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  findSettlementForReceipt: async (
    settlementId: string,
  ): Promise<SettlementForReceipt | null> => {
    return prisma.corporateAccountSettlement.findFirst({
      where: { id: settlementId },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        note: true,
        createdAt: true,
        settledBy: {
          select: { name: true },
        },
        corporateAccount: {
          select: { companyName: true, contactName: true, currentBalance: true },
        },
      },
    });
  },

  // ─── Print Station Repository ────────────────────────────────────────────

  createPrintStation: async (data: {
    siteId: string;
    name: string;
    tokenHash: string;
  }): Promise<PrintStationRecord> => {
    return prisma.printStation.create({
      data: {
        siteId: data.siteId,
        name: data.name,
        token: data.tokenHash,
      },
      select: {
        id: true,
        siteId: true,
        name: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  listPrintStations: async (siteId: string): Promise<PrintStationRecord[]> => {
    return prisma.printStation.findMany({
      where: { siteId, isActive: true },
      select: {
        id: true,
        siteId: true,
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
    siteId: string,
  ): Promise<PrintStationRecord | null> => {
    return prisma.printStation.findFirst({
      where: { id, siteId },
      select: {
        id: true,
        siteId: true,
        name: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  deactivatePrintStation: async (id: string, siteId: string): Promise<void> => {
    await prisma.printStation.updateMany({
      where: { id, siteId },
      data: { isActive: false },
    });
  },

  updateHeartbeat: async (stationId: string, siteId: string): Promise<{ lastSeenAt: Date | null }> => {
    return prisma.printStation.update({
      where: { id: stationId, siteId },
      data: { lastSeenAt: new Date() },
      select: { lastSeenAt: true },
    });
  },

  findPrintStationByTokenHash: async (
    tokenHash: string,
  ): Promise<{ id: string; siteId: string; isActive: boolean } | null> => {
    return prisma.printStation.findUnique({
      where: { token: tokenHash },
      select: { id: true, siteId: true, isActive: true },
    });
  },

  findStationWithOrg: async (
    stationId: string,
  ): Promise<{ id: string; siteId: string; site: { id: string; name: string } } | null> => {
    return prisma.printStation.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        siteId: true,
        site: {
          select: { id: true, name: true },
        },
      },
    });
  },
};
