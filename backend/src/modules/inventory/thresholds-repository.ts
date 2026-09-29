import type { CountingThresholds } from '@prisma/client';
import { prisma } from '../../config/database';

export type ThresholdsRow = CountingThresholds & {
  updatedBy: { id: string; name: string } | null;
  directorUpdatedBy: { id: string; name: string } | null;
};

const include = {
  updatedBy: { select: { id: true, name: true } },
  directorUpdatedBy: { select: { id: true, name: true } },
};

export const thresholdsRepository = {
  findByOrganization: async (organizationId: string): Promise<ThresholdsRow | null> => {
    return prisma.countingThresholds.findFirst({ where: { organizationId }, include });
  },

  /** Store Manager: the hub row's reason threshold. Lazily created with the other defaults. */
  upsertStoreReason: async (
    organizationId: string,
    input: { reasonRequiredKes: number; directorAlertKes: number; updatedById: string },
  ): Promise<ThresholdsRow> => {
    return prisma.countingThresholds.upsert({
      where: { organizationId },
      create: {
        organizationId,
        reasonRequiredKes: input.reasonRequiredKes,
        directorAlertKes: input.directorAlertKes,
        updatedById: input.updatedById,
      },
      update: { reasonRequiredKes: input.reasonRequiredKes, updatedById: input.updatedById },
      include,
    });
  },

  /** Director: only the company-wide alert amount, on the hub row. */
  upsertDirectorAlert: async (
    organizationId: string,
    input: { directorAlertKes: number; reasonRequiredKes: number; updatedById: string },
  ): Promise<ThresholdsRow> => {
    const at = new Date();
    return prisma.countingThresholds.upsert({
      where: { organizationId },
      create: {
        organizationId,
        reasonRequiredKes: input.reasonRequiredKes,
        directorAlertKes: input.directorAlertKes,
        directorUpdatedById: input.updatedById,
        directorUpdatedAt: at,
      },
      update: { directorAlertKes: input.directorAlertKes, directorUpdatedById: input.updatedById, directorUpdatedAt: at },
      include,
    });
  },
};
