import { randomBytes, createHash } from 'crypto';
import type { PrintJobStatus, Prisma } from '@prisma/client';
import { printRepository, type PrintJobRecord, type PrintJobSummaryRecord, type PrintStationRecord } from '../repositories/print-repository';
import { NotFoundError, ValidationError } from '../utils/errors';

const PRINT_STATION_TOKEN_PREFIX = 'pst_';
const STATION_ONLINE_THRESHOLD_SECONDS = 60;
const JOB_MAX_AGE_HOURS = 24;

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptData {
  branchName: string;
  orderNumber: string;
  dailyNumber: number;
  orderDate: string;
  orderTime: string;
  orderType: string;
  tableNumber: string | null;
  waiterName: string;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paidAt: string;
}

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
  ): Promise<PrintJobSummaryRecord> => {
    const order = await printRepository.findOrderForReceipt(orderId, organizationId);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    if (!order.paymentMethod) {
      throw new ValidationError('Order has not been paid yet — cannot create a print job');
    }

    // Idempotency: return existing PENDING/PRINTING job rather than creating a duplicate
    const existing = await printRepository.findActiveJobForOrder(orderId, organizationId);
    if (existing) {
      return existing;
    }

    const orderDate = new Date(order.orderDate);
    const paidAt = order.paidAt ?? order.createdAt;

    const receiptData: ReceiptData = {
      branchName: order.organization.name,
      orderNumber: `WCB-${String(order.dailyNumber).padStart(4, '0')}`,
      dailyNumber: order.dailyNumber,
      orderDate: formatDate(orderDate),
      orderTime: formatTime(paidAt),
      orderType: order.type,
      tableNumber: order.tableNumber,
      waiterName: order.createdBy.name,
      items: order.items.map((item) => ({
        name: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: toDecimalNumber(item.unitPrice),
        total: toDecimalNumber(item.subtotal),
      })),
      subtotal: toDecimalNumber(order.subtotal),
      deliveryFee: toDecimalNumber(order.deliveryFee),
      total: toDecimalNumber(order.total),
      paymentMethod: order.paymentMethod,
      paidAt: paidAt.toISOString(),
    };

    return printRepository.createPrintJob({
      organizationId,
      orderId,
      requestedById,
      receiptData: receiptData as unknown as Prisma.InputJsonValue,
    });
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

  getPendingJobsForStation: async (
    organizationId: string,
    status: PrintJobStatus,
  ): Promise<PrintJobRecord[]> => {
    // Auto-expire jobs older than 24 hours before returning results
    const expireBefore = new Date(Date.now() - JOB_MAX_AGE_HOURS * 60 * 60 * 1000);
    await printRepository.expireOldPendingJobs(organizationId, expireBefore);

    return printRepository.listPendingJobsForStation(organizationId, status);
  },

  updateJobStatus: async (
    jobId: string,
    organizationId: string,
    data: {
      status: PrintJobStatus;
      printedAt?: string;
      failureReason?: string;
    },
  ): Promise<PrintJobRecord> => {
    const existing = await printRepository.findPrintJobById(jobId, organizationId);
    if (!existing) {
      throw new NotFoundError('Print job not found');
    }

    return printRepository.updatePrintJobStatus(jobId, organizationId, {
      status: data.status,
      printedAt: data.printedAt ? new Date(data.printedAt) : undefined,
      failureReason: data.failureReason,
    });
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

    const { lastSeenAt } = await printRepository.updateHeartbeat(stationId);

    return {
      stationId: station.id,
      branchName: station.organization.name,
      lastSeenAt: lastSeenAt ?? new Date(),
    };
  },
};
