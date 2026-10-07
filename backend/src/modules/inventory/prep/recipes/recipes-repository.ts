import { Prisma, type PrepRecipeChangeReason } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { PAST_RUNS_MAX } from '../_shared/prep-constants';

type Client = typeof prisma | Prisma.TransactionClient;

/**
 * Database reads and writes for Usual recipes (docs/features/inventory/prep-plan.md §1.1). Every query carries `siteId`
 * (the hub, column `organization_id`). A recipe is a header plus immutable versions; the newest version is the current
 * recipe and the version rows are the change log. No business rules here: the service decides, this file stores.
 */

const author = { select: { id: true, name: true, role: true } } as const;

const versionInclude = {
  createdBy: author,
  lines: {
    orderBy: { lineOrder: 'asc' },
    include: { inputItem: { select: { id: true, name: true, usageUnit: true, currentCost: true } } },
  },
} satisfies Prisma.PrepRecipeVersionInclude;

/** A recipe with only its newest version (with ingredient lines): what the list and the detail's "current" read. */
const newestVersion = {
  versions: { orderBy: { version: 'desc' }, take: 1, include: versionInclude },
} satisfies Prisma.PrepRecipeInclude;

export type RecipeVersionRow = Prisma.PrepRecipeVersionGetPayload<{ include: typeof versionInclude }>;
export type RecipeWithNewest = Prisma.PrepRecipeGetPayload<{ include: typeof newestVersion }>;

/** What the update transaction needs to compare against: the newest version's numbers, with no names or costs. */
export type RecipeForUpdate = Prisma.PrepRecipeGetPayload<{
  include: { versions: { include: { lines: true } } };
}>;

export interface PreppedItem {
  id: string;
  name: string;
  usageUnit: string;
  deletedAt: Date | null;
  type: 'RAW_INGREDIENT' | 'PREPPED' | 'STOCKED';
}

export interface LiveItem {
  id: string;
  name: string;
}

export interface RecordedRun {
  actualYield: Prisma.Decimal;
  createdAt: Date;
}

export interface LastRunWithLines {
  reference: string | null;
  actualYield: Prisma.Decimal;
  createdAt: Date;
  inputLines: Array<{ inputItemId: string; quantity: Prisma.Decimal; inputItem: { name: string; usageUnit: string } }>;
}

export interface NewVersionData {
  siteId: string;
  recipeId: string;
  version: number;
  targetYield: string;
  reason: PrepRecipeChangeReason | null;
  reasonNote: string | null;
  createdById: string;
  lines: Array<{ inputItemId: string; amount: string; isMain: boolean }>;
}

export const recipesRepository = {
  /** Every live PREPPED item of the site, by name: each is a row on the Usual recipes list, recipe or not. */
  listPreppedItems: (siteId: string): Promise<Array<{ id: string; name: string; usageUnit: string }>> =>
    prisma.inventoryItem.findMany({
      where: { siteId, type: 'PREPPED', deletedAt: null },
      select: { id: true, name: true, usageUnit: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),

  /** One item of the site, retired or not, with its type, so the service can answer 404 (not prepped) or 409 (retired). */
  findItem: (siteId: string, itemId: string, client: Client = prisma): Promise<PreppedItem | null> =>
    client.inventoryItem.findFirst({
      where: { id: itemId, siteId },
      select: { id: true, name: true, usageUnit: true, deletedAt: true, type: true },
    }),

  /** Live items of the site among `ids` (the ingredients of a recipe being saved). */
  findLiveItems: (siteId: string, ids: string[], client: Client = prisma): Promise<LiveItem[]> =>
    client.inventoryItem.findMany({ where: { siteId, id: { in: ids }, deletedAt: null }, select: { id: true, name: true } }),

  /** The recipes of these output items, each with its newest version. */
  recipesForItems: (siteId: string, itemIds: string[]): Promise<RecipeWithNewest[]> =>
    itemIds.length === 0
      ? Promise.resolve([])
      : prisma.prepRecipe.findMany({ where: { siteId, outputItemId: { in: itemIds } }, include: newestVersion }),

  findRecipe: (siteId: string, itemId: string): Promise<RecipeWithNewest | null> =>
    prisma.prepRecipe.findFirst({ where: { siteId, outputItemId: itemId }, include: newestVersion }),

  /** Every version, newest first, for the detail's history. No lines. */
  versionsOf: (siteId: string, recipeId: string) =>
    prisma.prepRecipeVersion.findMany({
      where: { siteId, recipeId },
      select: { version: true, createdAt: true, reason: true, reasonNote: true, createdBy: author },
      orderBy: { version: 'desc' },
    }),

  /** Inside the save transaction: the header and its newest version's numbers. */
  findRecipeForUpdate: (tx: Prisma.TransactionClient, siteId: string, itemId: string): Promise<RecipeForUpdate | null> =>
    tx.prepRecipe.findFirst({
      where: { siteId, outputItemId: itemId },
      include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { lines: true } } },
    }),

  createRecipe: (tx: Prisma.TransactionClient, data: { siteId: string; outputItemId: string }) =>
    tx.prepRecipe.create({ data: { siteId: data.siteId, outputItemId: data.outputItemId, currentVersion: 1 }, select: { id: true } }),

  setCurrentVersion: (tx: Prisma.TransactionClient, siteId: string, recipeId: string, version: number) =>
    tx.prepRecipe.updateMany({ where: { id: recipeId, siteId }, data: { currentVersion: version } }),

  createVersion: (tx: Prisma.TransactionClient, data: NewVersionData) =>
    tx.prepRecipeVersion.create({
      data: {
        siteId: data.siteId,
        recipeId: data.recipeId,
        version: data.version,
        targetYield: new Prisma.Decimal(data.targetYield),
        reason: data.reason,
        reasonNote: data.reasonNote,
        createdById: data.createdById,
        lines: {
          create: data.lines.map((l, i) => ({ inputItemId: l.inputItemId, amount: new Prisma.Decimal(l.amount), isMain: l.isMain, lineOrder: i })),
        },
      },
      select: { id: true },
    }),

  /** The newest RECORDED runs of an output (for the past-runs average); corrected and cancelled runs do not count. */
  recordedRuns: (siteId: string, outputItemId: string): Promise<RecordedRun[]> =>
    prisma.prepRun.findMany({
      where: { siteId, outputItemId, status: 'RECORDED' },
      select: { actualYield: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: PAST_RUNS_MAX,
    }),

  /** The latest RECORDED run of an output with its ingredient lines, for "Use these" on a first recipe. */
  lastRecordedRun: (siteId: string, outputItemId: string): Promise<LastRunWithLines | null> =>
    prisma.prepRun.findFirst({
      where: { siteId, outputItemId, status: 'RECORDED' },
      orderBy: { createdAt: 'desc' },
      select: {
        reference: true,
        actualYield: true,
        createdAt: true,
        inputLines: {
          orderBy: { lineOrder: 'asc' },
          select: { inputItemId: true, quantity: true, inputItem: { select: { name: true, usageUnit: true } } },
        },
      },
    }),
};
