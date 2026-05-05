import { randomBytes, createHash } from 'crypto';
import type { PrintJobStatus, ReceiptType, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { printRepository, type PrintJobRecord, type PrintJobSummaryRecord, type PrintStationRecord } from '../repositories/print-repository';
import { otherIncomeRepository } from '../repositories/other-income-repository';
import { NotFoundError, ValidationError } from '../utils/errors';

const PRINT_STATION_TOKEN_PREFIX = 'pst_';
const STATION_ONLINE_THRESHOLD_SECONDS = 60;
const JOB_MAX_AGE_HOURS = 24;
const CLAIM_LEASE_SECONDS = 120;

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptData {
  branchName: string;
  branchPhone: string | null;
  mpesaPaybill: string | null;
  accountNumber: string | null;
  googleReviewUrl: string | null;
  orderNumber: string;
  dailyNumber: number;
  orderDate: string;
  orderTime: string;
  orderType: string;
  tableNumber: string | null;
  waiterName: string;
  waiterFirstName: string;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  // Only present on RECEIPT type (payment confirmed)
  paymentMethod?: string;
  paidAt?: string;
  // Payment detail fields — present when relevant on confirmed receipts
  mpesaCode?: string;
  mpesaAmount?: number;
  cashAmount?: number;
  cardAmount?: number;
  splitType?: string;
}

const getFirstName = (fullName: string): string =>
  fullName.trim().split(/\s+/)[0] ?? fullName.trim();

interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface PrintJobListResult {
  jobs: PrintJobRecord[];
  pagination: PaginationMeta;
}

interface PrintStationWithStatus extends PrintStationRecord {
  isOnline: boolean;
}

interface CreatedPrintStation {
  id: string;
  organizationId: string;
  name: string;
  token: string; // raw token — shown once
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toDecimalNumber = (val: Prisma.Decimal): number => Number(val.toString());

const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-KE', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });

export const printService = {
  createPrintJob: async (
    orderId: string,
    requestedById: string,
    organizationId: string,
    receiptType: ReceiptType = 'RECEIPT',
  ): Promise<PrintJobSummaryRecord> => {
    const order = await printRepository.findOrderForReceipt(orderId, organizationId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    // RECEIPT requires payment; BILL does not
    if (receiptType === 'RECEIPT' && !order.paymentMethod) {
      throw new ValidationError('Order has not been paid yet — cannot print a receipt');
    }

    // Idempotency: return existing PENDING/PRINTING job of the same type rather than creating a duplicate
    const existing = await printRepository.findActiveJobForOrder(orderId, organizationId, receiptType);
    if (existing) {
      return existing;
    }

    const orderDate = new Date(order.orderDate);
    const timestampRef = order.paidAt ?? order.createdAt;

    const receiptData: ReceiptData = {
      branchName: order.organization.name,
      branchPhone: order.organization.phone ?? null,
      mpesaPaybill: order.organization.mpesaPaybill ?? null,
      accountNumber: order.organization.accountNumber ?? null,
      googleReviewUrl: order.organization.googleReviewUrl ?? null,
      orderNumber: `WCB-${String(order.dailyNumber).padStart(4, '0')}`,
      dailyNumber: order.dailyNumber,
      orderDate: formatDate(orderDate),
      orderTime: formatTime(timestampRef),
      orderType: order.type,
      tableNumber: order.tableNumber,
      waiterName: order.createdBy.name,
      waiterFirstName: getFirstName(order.createdBy.name),
      items: order.items.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: toDecimalNumber(item.unitPrice),
        total: toDecimalNumber(item.subtotal),
      })),
      subtotal: toDecimalNumber(order.subtotal),
      deliveryFee: toDecimalNumber(order.deliveryFee),
      total: toDecimalNumber(order.total),
      // Payment fields only included on confirmed receipts
      ...(receiptType === 'RECEIPT' && order.paymentMethod
        ? {
            paymentMethod: order.paymentMethod,
            paidAt: timestampRef.toISOString(),
            ...(order.mpesaCode ? { mpesaCode: order.mpesaCode } : {}),
            ...(order.paymentMethod === 'SPLIT'
              ? {
                  ...(order.splitType ? { splitType: order.splitType } : {}),
                  ...(order.mpesaAmount ? { mpesaAmount: toDecimalNumber(order.mpesaAmount) } : {}),
                  ...(order.cashAmount ? { cashAmount: toDecimalNumber(order.cashAmount) } : {}),
                  ...(order.cardAmount ? { cardAmount: toDecimalNumber(order.cardAmount) } : {}),
                }
              : {}),
          }
        : {}),
    };

    // One copy for both bills and payment receipts
    const copies = 1;

    const activeKey = `${orderId}:${receiptType}`;

    try {
      return await printRepository.createPrintJob({
        organizationId,
        orderId,
        requestedById,
        receiptType,
        copies,
        activeKey,
        receiptData: receiptData as unknown as Prisma.InputJsonValue,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingActive = await printRepository.findActiveJobForOrder(orderId, organizationId, receiptType);
        if (existingActive) {
          return existingActive;
        }
      }
      throw error;
    }
  },

  createOtherIncomePrintJob: async (
    entryId: string,
    organizationId: string,
    requestedById: string,
  ): Promise<PrintJobSummaryRecord> => {
    const entry = await otherIncomeRepository.findEntryForReceipt(entryId, organizationId);
    if (!entry) {
      throw new NotFoundError('Other income entry not found');
    }

    // Idempotency: return existing PENDING/PRINTING job rather than creating a duplicate
    const activeKey = `other-income:${entryId}`;
    const existing = await printRepository.findActiveJobByActiveKey(activeKey, organizationId);
    if (existing) {
      return existing;
    }

    const entryDate = new Date(entry.entryDate);
    const receiptData: ReceiptData = {
      branchName: entry.organization.name,
      branchPhone: entry.organization.phone ?? null,
      mpesaPaybill: entry.organization.mpesaPaybill ?? null,
      accountNumber: entry.organization.accountNumber ?? null,
      googleReviewUrl: entry.organization.googleReviewUrl ?? null,
      orderNumber: entry.id.slice(0, 8).toUpperCase(),
      dailyNumber: 0,
      orderDate: formatDate(entryDate),
      orderTime: formatTime(entry.createdAt),
      orderType: 'Other Income',
      tableNumber: null,
      waiterName: entry.recordedBy.name,
      waiterFirstName: getFirstName(entry.recordedBy.name),
      items: [
        {
          name: entry.category.name,
          quantity: 1,
          unitPrice: toDecimalNumber(entry.amount),
          total: toDecimalNumber(entry.amount),
        },
      ],
      subtotal: toDecimalNumber(entry.amount),
      deliveryFee: 0,
      total: toDecimalNumber(entry.amount),
      paymentMethod: entry.paymentMethod,
      paidAt: entry.createdAt.toISOString(),
      ...(entry.mpesaCode ? { mpesaCode: entry.mpesaCode } : {}),
      ...(entry.paymentMethod === 'SPLIT'
        ? {
            ...(entry.splitType ? { splitType: entry.splitType } : {}),
            ...(entry.mpesaAmount ? { mpesaAmount: toDecimalNumber(entry.mpesaAmount) } : {}),
            ...(entry.cashAmount ? { cashAmount: toDecimalNumber(entry.cashAmount) } : {}),
            ...(entry.cardAmount ? { cardAmount: toDecimalNumber(entry.cardAmount) } : {}),
          }
        : {}),
    };

    try {
      return await printRepository.createPrintJob({
        organizationId,
        requestedById,
        receiptType: 'RECEIPT',
        copies: 1,
        activeKey,
        receiptData: receiptData as unknown as Prisma.InputJsonValue,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingActive = await printRepository.findActiveJobByActiveKey(activeKey, organizationId);
        if (existingActive) {
          return existingActive;
        }
      }
      throw error;
    }
  },

  getPrintJobs: async (
    organizationId: string,
    filters: { status?: PrintJobStatus; page: number; perPage: number },
  ): Promise<PrintJobListResult> => {
    const { jobs, total } = await printRepository.listPrintJobs(organizationId, filters);

    return {
      jobs,
      pagination: {
        total,
        page: filters.page,
        perPage: filters.perPage,
        totalPages: Math.ceil(total / filters.perPage),
      },
    };
  },

  getPrintJobById: async (
    id: string,
    organizationId: string,
  ): Promise<PrintJobRecord> => {
    const job = await printRepository.findPrintJobById(id, organizationId);
    if (!job) {
      throw new NotFoundError('Print job not found');
    }
    return job;
  },

  claimJobsForStation: async (
    organizationId: string,
    stationId: string,
    limit: number,
  ): Promise<PrintJobRecord[]> => {
    // Auto-expire jobs older than 24 hours before returning results
    const expireBefore = new Date(Date.now() - JOB_MAX_AGE_HOURS * 60 * 60 * 1000);
    await printRepository.expireOldPendingJobs(organizationId, expireBefore);

    const now = new Date();
    return printRepository.claimPendingJobsForStation(
      organizationId,
      stationId,
      limit,
      CLAIM_LEASE_SECONDS,
      now,
    );
  },

  updateJobStatus: async (
    jobId: string,
    organizationId: string,
    data: {
      status: PrintJobStatus;
      printedAt?: string;
      failureReason?: string;
    },
    stationId?: string,
  ): Promise<PrintJobRecord> => {
    const existing = await printRepository.findPrintJobById(jobId, organizationId);
    if (!existing) {
      throw new NotFoundError('Print job not found');
    }

    const update: {
      status: PrintJobStatus;
      printedAt?: Date;
      failureReason?: string;
      activeKey?: string | null;
      claimedByStationId?: string | null;
      claimedAt?: Date | null;
      leaseExpiresAt?: Date | null;
      printedByStationId?: string | null;
    } = {
      status: data.status,
      printedAt: data.printedAt ? new Date(data.printedAt) : undefined,
      failureReason: data.failureReason,
    };

    if (data.status === 'COMPLETED') {
      update.printedAt = update.printedAt ?? new Date();
      update.printedByStationId = stationId ?? null;
      update.activeKey = null;
      update.claimedByStationId = null;
      update.claimedAt = null;
      update.leaseExpiresAt = null;
    }

    if (data.status === 'FAILED') {
      update.activeKey = null;
      update.claimedByStationId = null;
      update.claimedAt = null;
      update.leaseExpiresAt = null;
    }

    return printRepository.updatePrintJobStatus(jobId, organizationId, update);
  },

  createPrintStation: async (
    name: string,
    organizationId: string,
  ): Promise<CreatedPrintStation> => {
    // Generate a cryptographically random token
    const rawToken = PRINT_STATION_TOKEN_PREFIX + randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const station = await printRepository.createPrintStation({
      organizationId,
      name,
      tokenHash,
    });

    // Return the raw token — shown only once
    return {
      id: station.id,
      organizationId: station.organizationId,
      name: station.name,
      token: rawToken,
      isActive: station.isActive,
      createdAt: station.createdAt,
      updatedAt: station.updatedAt,
    };
  },

  listPrintStations: async (organizationId: string): Promise<PrintStationWithStatus[]> => {
    const stations = await printRepository.listPrintStations(organizationId);
    const onlineThreshold = new Date(Date.now() - STATION_ONLINE_THRESHOLD_SECONDS * 1000);

    return stations.map((station) => ({
      ...station,
      isOnline: station.lastSeenAt !== null && station.lastSeenAt > onlineThreshold,
    }));
  },

  deactivatePrintStation: async (stationId: string, organizationId: string): Promise<void> => {
    const station = await printRepository.findPrintStationById(stationId, organizationId);
    if (!station) {
      throw new NotFoundError('Print station not found');
    }
    await printRepository.deactivatePrintStation(stationId, organizationId);
  },

  heartbeat: async (
    stationId: string,
  ): Promise<{ stationId: string; branchName: string; lastSeenAt: Date }> => {
    const station = await printRepository.findStationWithOrg(stationId);
    if (!station) {
      throw new NotFoundError('Print station not found');
    }

    const { lastSeenAt } = await printRepository.updateHeartbeat(stationId, station.organization.id);

    return {
      stationId: station.id,
      branchName: station.organization.name,
      lastSeenAt: lastSeenAt ?? new Date(),
    };
  },
};
