import { Prisma, type WasteLog, type WasteReason } from '@prisma/client';
import { prisma } from '../config/database';

export type WasteLogWithItem = WasteLog & {
  inventoryItem: { id: string; name: string; usageUnit: string; buyUnit: string; conversionFactor: Prisma.Decimal; currentCost: Prisma.Decimal };
};

export type CreateWasteLogInput = {
  locationId: string;
  inventoryItemId: string;
  quantity: Prisma.Decimal.Value;
  reason: WasteReason;
  note?: string;
  loggedById: string;
};

export const wasteLogRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { locationId?: string; loggedById?: string; reason?: WasteReason } = {},
  ): Promise<WasteLogWithItem[]> => {
    return prisma.wasteLog.findMany({
      where: {
        organizationId,
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.loggedById ? { loggedById: filters.loggedById } : {}),
        ...(filters.reason ? { reason: filters.reason } : {}),
      },
      include: { inventoryItem: { select: { id: true, name: true, usageUnit: true, buyUnit: true, conversionFactor: true, currentCost: true } } },
      orderBy: { loggedAt: 'desc' },
    });
  },

  findById: async (id: string, organizationId: string): Promise<WasteLogWithItem | null> => {
    return prisma.wasteLog.findFirst({
      where: { id, organizationId },
      include: { inventoryItem: { select: { id: true, name: true, usageUnit: true, buyUnit: true, conversionFactor: true, currentCost: true } } },
    });
  },

  create: async (organizationId: string, data: CreateWasteLogInput): Promise<WasteLog> => {
    return prisma.wasteLog.create({
      data: {
        organizationId,
        locationId: data.locationId,
        inventoryItemId: data.inventoryItemId,
        quantity: new Prisma.Decimal(data.quantity),
        reason: data.reason,
        note: data.note,
        loggedById: data.loggedById,
      },
    });
  },
};
