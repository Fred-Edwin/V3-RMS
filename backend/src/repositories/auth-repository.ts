import type { UserRole } from '@prisma/client';
import { prisma } from '../config/database';

const userAuthSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  siteId: true,
  departmentTag: true,
  isDepartmentHead: true,
  isActive: true,
  passwordHash: true,
  pinHash: true,
  site: {
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
  siteId: true,
  departmentTag: true,
  isDepartmentHead: true,
  isActive: true,
  phone: true,
  site: {
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

  updatePinHash: async (userId: string, pinHash: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { pinHash },
    });
  },

  /** Whether the user has a signing PIN. Returns a boolean — the hash never leaves the repository. */
  hasPin: async (userId: string): Promise<boolean | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pinHash: true },
    });
    return user ? user.pinHash !== null : null;
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
    siteId: string,
    station: 'KITCHEN' | 'BARISTA' | 'PIZZA' | 'PASTRY',
  ): Promise<string[]> => {
    const roles =
      station === 'KITCHEN' || station === 'PIZZA' || station === 'PASTRY'
        ? (['CHEF', 'KITCHEN_DISPLAY'] as const)
        : (['BARISTA', 'BARISTA_DISPLAY'] as const);

    const users = await prisma.user.findMany({
      where: {
        siteId,
        role: { in: [...roles] },
        isActive: true,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken as string);
  },

  findFcmTokensByRole: async (
    siteId: string,
    roles: UserRole[],
  ): Promise<string[]> => {
    const users = await prisma.user.findMany({
      where: {
        siteId,
        role: { in: roles },
        isActive: true,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken as string);
  },

  /**
   * The FCM tokens of the people in given departments of one branch (the head and, unless `headsOnly`, the members): active users
   * whose `departmentId` is listed. Requisitions notifications (inventory/_shared/notify.ts).
   */
  findDepartmentFcmTokens: async (
    siteId: string,
    departmentIds: string[],
    headsOnly: boolean,
  ): Promise<string[]> => {
    if (departmentIds.length === 0) return [];
    const users = await prisma.user.findMany({
      where: {
        siteId,
        departmentId: { in: departmentIds },
        ...(headsOnly ? { isDepartmentHead: true } : {}),
        isActive: true,
        deletedAt: null,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken as string);
  },

  /**
   * Returns the FCM tokens of every active DIRECTOR. Directors are a system-level
   * role that legitimately spans organizations, so there is deliberately no
   * organizationId filter here — used for staff-discount approval pushes.
   */
  findDirectorFcmTokens: async (): Promise<string[]> => {
    const users = await prisma.user.findMany({
      where: {
        role: 'DIRECTOR',
        isActive: true,
        fcmToken: { not: null },
      },
      select: { fcmToken: true },
    });

    return users.map((u) => u.fcmToken as string);
  },
};
