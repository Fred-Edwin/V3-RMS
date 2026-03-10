import { prisma } from '../config/database';

const userAuthSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
  isActive: true,
  passwordHash: true,
  organization: {
    select: {
      name: true,
    },
  },
} as const;

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  organizationId: true,
  isActive: true,
  phone: true,
  organization: {
    select: {
      name: true,
    },
  },
} as const;

export const authRepository = {
  findUserByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
      select: userAuthSelect,
    });
  },

  findUserByIdWithPassword: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      select: userAuthSelect,
    });
  },

  findUserById: async (id: string) => {
    return prisma.user.findUnique({
      where: { id },
      select: userPublicSelect,
    });
  },

  saveRefreshToken: async (input: { userId: string; tokenHash: string; expiresAt: Date }) => {
    return prisma.refreshToken.create({
      data: input,
    });
  },

  findRefreshToken: async (tokenHash: string) => {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  },

  deleteRefreshToken: async (tokenHash: string) => {
    return prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
  },

  deleteAllRefreshTokensByUserId: async (userId: string) => {
    return prisma.refreshToken.deleteMany({
      where: { userId },
    });
  },

  updatePassword: async (userId: string, passwordHash: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  saveFcmToken: async (userId: string, fcmToken: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
  },

  findFcmToken: async (userId: string): Promise<string | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    return user?.fcmToken ?? null;
  },

  findFcmTokensByStation: async (
    organizationId: string,
    station: 'KITCHEN' | 'BARISTA',
  ): Promise<string[]> => {
    const roles =
      station === 'KITCHEN'
        ? (['CHEF', 'KITCHEN_DISPLAY'] as const)
        : (['BARISTA', 'BARISTA_DISPLAY'] as const);

    const users = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [...roles] },
        isActive: true,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken as string);
  },
};
