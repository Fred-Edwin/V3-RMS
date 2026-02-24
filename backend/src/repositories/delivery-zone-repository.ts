import { Prisma, type DeliveryZone } from '@prisma/client';
import { prisma } from '../config/database';

export const deliveryZoneRepository = {
  findActiveByIdAndOrganization: async (
    id: string,
    organizationId: string,
  ): Promise<DeliveryZone | null> => {
    return prisma.deliveryZone.findFirst({
      where: {
        id,
        organizationId,
        isActive: true,
      },
    });
  },

  findAllActiveByOrganization: async (organizationId: string): Promise<DeliveryZone[]> => {
    return prisma.deliveryZone.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  findById: async (id: string, organizationId: string): Promise<DeliveryZone | null> => {
    return prisma.deliveryZone.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  },

  create: async (
    organizationId: string,
    data: {
      name: string;
      fee: string;
    },
  ): Promise<DeliveryZone> => {
    return prisma.deliveryZone.create({
      data: {
        organizationId,
        name: data.name,
        fee: new Prisma.Decimal(data.fee),
      },
    });
  },

  update: async (
    id: string,
    organizationId: string,
    data: {
      name?: string;
      fee?: string;
      isActive?: boolean;
    },
  ): Promise<DeliveryZone | null> => {
    const updated = await prisma.deliveryZone.updateMany({
      where: {
        id,
        organizationId,
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
        organizationId,
      },
    });
  },

  hasOrders: async (id: string, organizationId: string): Promise<boolean> => {
    const order = await prisma.order.findFirst({
      where: {
        organizationId,
        deliveryZoneId: id,
      },
      select: {
        id: true,
      },
    });

    return Boolean(order);
  },
};
