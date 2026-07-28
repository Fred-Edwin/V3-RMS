import { Prisma, type PrepRecord, type PrepRecipe } from '@prisma/client';
import { prisma } from '../config/database';

export type PrepRecordWithLines = PrepRecord & {
  lines: {
    id: string;
    inputItemId: string;
    quantity: Prisma.Decimal;
    unitCost: Prisma.Decimal;
    inputItem: { id: string; name: string; usageUnit: string };
  }[];
  outputItem: { id: string; name: string; usageUnit: string };
  promotedTo: { id: string } | null;
};

export type PrepRecipeWithLines = PrepRecipe & {
  lines: {
    id: string;
    inputItemId: string;
    quantity: Prisma.Decimal;
    inputItem: { id: string; name: string };
  }[];
  outputItem: { id: string; name: string };
};

const recordInclude = {
  outputItem: { select: { id: true, name: true, usageUnit: true } },
  lines: {
    include: { inputItem: { select: { id: true, name: true, usageUnit: true } } },
  },
  promotedTo: { select: { id: true } },
} as const;

const recipeInclude = {
  outputItem: { select: { id: true, name: true } },
  lines: {
    include: { inputItem: { select: { id: true, name: true } } },
  },
} as const;

export const prepRecordRepository = {
  findAllByOrganization: async (
    organizationId: string,
    filters: { outputItemId?: string; locationId?: string } = {},
  ): Promise<PrepRecordWithLines[]> => {
    return prisma.prepRecord.findMany({
      where: {
        organizationId,
        ...(filters.outputItemId ? { outputItemId: filters.outputItemId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
      },
      include: recordInclude,
      orderBy: { recordedAt: 'desc' },
    });
  },

  findById: async (id: string, organizationId: string): Promise<PrepRecordWithLines | null> => {
    return prisma.prepRecord.findFirst({
      where: { id, organizationId },
      include: recordInclude,
    });
  },

  // ── PrepRecipe (optional, Manager-authored "promote" target) ─────────────

  findAllRecipesByOrganization: async (organizationId: string): Promise<PrepRecipeWithLines[]> => {
    return prisma.prepRecipe.findMany({
      where: { organizationId },
      include: recipeInclude,
      orderBy: { name: 'asc' },
    });
  },

  findRecipeById: async (id: string, organizationId: string): Promise<PrepRecipeWithLines | null> => {
    return prisma.prepRecipe.findFirst({
      where: { id, organizationId },
      include: recipeInclude,
    });
  },

  /** Promotes a PrepRecord into a saved PrepRecipe — copies its input lines as the recipe's lines. */
  createRecipeFromRecord: async (
    organizationId: string,
    data: {
      promotedFromId: string;
      outputItemId: string;
      name: string;
      expectedYield: Prisma.Decimal.Value;
      batchLabel?: string;
      instructions?: string;
      createdById: string;
      lines: { inputItemId: string; quantity: Prisma.Decimal.Value }[];
    },
  ): Promise<PrepRecipeWithLines> => {
    return prisma.prepRecipe.create({
      data: {
        organizationId,
        outputItemId: data.outputItemId,
        name: data.name,
        expectedYield: new Prisma.Decimal(data.expectedYield),
        batchLabel: data.batchLabel,
        instructions: data.instructions,
        promotedFromId: data.promotedFromId,
        createdById: data.createdById,
        lines: {
          create: data.lines.map((line) => ({
            organizationId,
            inputItemId: line.inputItemId,
            quantity: new Prisma.Decimal(line.quantity),
          })),
        },
      },
      include: recipeInclude,
    });
  },
};
