import { Prisma, type DeliveryZone } from '@prisma/client';
import { prisma } from '../config/database';

export const deliveryZoneRepository = {
  findActiveByIdAndSite: async (
    id: string,
    siteId: string,
  ): Promise<DeliveryZone | null> => {
    return prisma.deliveryZone.findFirst({
      where: {
        id,
        siteId,
        isActive: true,
      },
    });
  },

  findAllActiveBySite: async (siteId: string): Promise<DeliveryZone[]> => {
    return prisma.deliveryZone.findMany({
      where: {
        siteId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  findById: async (id: string, siteId: string): Promise<DeliveryZone | null> => {
    return prisma.deliveryZone.findFirst({
      where: {
        id,
        siteId,
      },
    });
  },

  create: async (
    siteId: string,
    data: {
      name: string;
      fee: string;
    },
  ): Promise<DeliveryZone> => {
    return prisma.deliveryZone.create({
      data: {
        siteId,
        name: data.name,
        fee: new Prisma.Decimal(data.fee),
      },
    });
  },

  update: async (
    id: string,
    siteId: string,
    data: {
      name?: string;
      fee?: string;
      isActive?: boolean;
    },
  ): Promise<DeliveryZone | null> => {
    const updated = await prisma.deliveryZone.updateMany({
      where: {
        id,
        siteId,
      },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.fee !== undefined ? { fee: new Prisma.Decimal(data.fee) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    if (updated.count === 0) {
      return null;
    }

    return prisma.deliveryZone.findFirst({
      where: {
        id,
        siteId,
      },
    });
  },

  hasOrders: async (id: string, siteId: string): Promise<boolean> => {
    const order = await prisma.order.findFirst({
      where: {
        siteId,
        deliveryZoneId: id,
      },
      select: {
        id: true,
      },
    });

    return Boolean(order);
  },
};
