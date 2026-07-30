import { Prisma, type PrepRecord, type PrepRecipe } from '@prisma/client';
import { prisma } from '../config/database';
import { inventoryItemRepository } from './inventory-item-repository';

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
    inputItem: { id: string; name: string; usageUnit: string };
  }[];
  outputItem: { id: string; name: string; usageUnit: string };
};

const recordInclude = {
  outputItem: { select: { id: true, name: true, usageUnit: true } },
  lines: {
    include: { inputItem: { select: { id: true, name: true, usageUnit: true } } },
  },
  promotedTo: { select: { id: true } },
} as const;

const recipeInclude = {
  outputItem: { select: { id: true, name: true, usageUnit: true } },
  lines: {
    include: { inputItem: { select: { id: true, name: true, usageUnit: true } } },
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

  /**
   * Finds the recipe for a given output item, if one exists — powers Log
   * Prep's pre-fill (D-12 reopened: recipes are now authored directly, and
   * Log Prep reads them back to pre-populate input lines/yield). Still
   * optional: no recipe means Log Prep falls back to its blank-slate flow.
   */
  findRecipeByOutputItem: async (
    outputItemId: string,
    organizationId: string,
  ): Promise<PrepRecipeWithLines | null> => {
    return prisma.prepRecipe.findFirst({
      where: { outputItemId, organizationId },
      include: recipeInclude,
    });
  },

  /**
   * Directly authors a Prep Recipe (not promoted from a past record) —
   * creates the output InventoryItem (type PREPPED) and the PrepRecipe +
   * lines atomically, so a prepped item never exists without its recipe.
   * `buyUnit`/`conversionFactor` are schema-required on InventoryItem but
   * meaningless for a prepped item (it's never purchased) — collapsed to a
   * no-op conversion (buyUnit = usageUnit, factor = 1) rather than widening
   * the shared item schema for this one case.
   */
  createRecipeDirect: async (
    organizationId: string,
    data: {
      outputItemName: string;
      usageUnit: string;
      name: string;
      expectedYield: Prisma.Decimal.Value;
      batchLabel?: string;
      instructions?: string;
      createdById: string;
      lines: { inputItemId: string; quantity: Prisma.Decimal.Value }[];
    },
  ): Promise<PrepRecipeWithLines> => {
    return prisma.$transaction(async (tx) => {
      const outputItem = await inventoryItemRepository.create(
        organizationId,
        {
          name: data.outputItemName,
          type: 'PREPPED',
          buyUnit: data.usageUnit,
          usageUnit: data.usageUnit,
          conversionFactor: 1,
          reorderLevel: 0,
          departmentTags: [],
        },
        tx,
      );

      return tx.prepRecipe.create({
        data: {
          organizationId,
          outputItemId: outputItem.id,
          name: data.name,
          expectedYield: new Prisma.Decimal(data.expectedYield),
          batchLabel: data.batchLabel,
          instructions: data.instructions,
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
    });
  },

  /**
   * Edits an existing recipe's own fields/lines — never touches past
   * PrepRecords (they carry their own snapshot of quantities already), so
   * editing a recipe only changes what pre-fills on the *next* Log Prep run.
   * Replaces all lines wholesale on update — simpler and safer than diffing
   * for a form that always submits its full current line set.
   */
  updateRecipe: async (
    id: string,
    organizationId: string,
    data: {
      name?: string;
      expectedYield?: Prisma.Decimal.Value;
      batchLabel?: string;
      instructions?: string;
      lines?: { inputItemId: string; quantity: Prisma.Decimal.Value }[];
    },
  ): Promise<PrepRecipeWithLines | null> => {
    const existing = await prisma.prepRecipe.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    return prisma.$transaction(async (tx) => {
      if (data.lines) {
        await tx.prepRecipeLine.deleteMany({ where: { prepRecipeId: id } });
      }

      return tx.prepRecipe.update({
        where: { id },
        data: {
          name: data.name,
          expectedYield: data.expectedYield !== undefined ? new Prisma.Decimal(data.expectedYield) : undefined,
          batchLabel: data.batchLabel,
          instructions: data.instructions,
          ...(data.lines
            ? {
                lines: {
                  create: data.lines.map((line) => ({
                    organizationId,
                    inputItemId: line.inputItemId,
                    quantity: new Prisma.Decimal(line.quantity),
                  })),
                },
              }
            : {}),
        },
        include: recipeInclude,
      });
    });
  },
};
