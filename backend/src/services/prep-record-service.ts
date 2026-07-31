import type { Request } from 'express';
import {
  prepRecordRepository,
  type PrepRecordWithLines,
  type PrepRecipeWithLines,
} from '../repositories/prep-record-repository';
import { inventoryTransactionService } from './inventory-transaction-service';
import { NotFoundError, ValidationError } from '../utils/errors';
import type {
  CreatePrepRecipeInput,
  CreatePrepRecordInput,
  PromotePrepRecipeInput,
  UpdatePrepRecipeInput,
} from '../validators/prep-record-schemas';

type Actor = NonNullable<Request['user']>;

const requireOrganization = (actor: Actor): string => {
  if (!actor.organizationId) {
    throw new ValidationError('Branch context missing for this user');
  }
  return actor.organizationId;
};

export const prepRecordService = {
  list: async (
    actor: Actor,
    filters: { outputItemId?: string; locationId?: string } = {},
  ): Promise<PrepRecordWithLines[]> => {
    const organizationId = requireOrganization(actor);
    return prepRecordRepository.findAllByOrganization(organizationId, filters);
  },

  getById: async (actor: Actor, id: string): Promise<PrepRecordWithLines> => {
    const organizationId = requireOrganization(actor);
    const record = await prepRecordRepository.findById(id, organizationId);
    if (!record) {
      throw new NotFoundError('Prep record not found');
    }
    return record;
  },

  /**
   * Logs a Prep Record (D-12) — both roles. Delegates entirely to Session 2's
   * inventoryTransactionService.recordPrep for costing + the prep_consume/
   * prep_produce ledger pair; never reimplements that math here.
   */
  create: async (actor: Actor, input: CreatePrepRecordInput): Promise<PrepRecordWithLines> => {
    const organizationId = requireOrganization(actor);

    const created = await inventoryTransactionService.recordPrep({
      organizationId,
      locationId: input.locationId,
      outputItemId: input.outputItemId,
      actualYield: input.actualYield,
      scaledExpectedYield: input.scaledExpectedYield,
      inputs: input.inputs,
      recordedById: actor.id,
    });

    return prepRecordService.getById(actor, created.id);
  },

  /** Soft-reference rolling average (Session 2) — informational only, D-12. */
  getRollingAverage: async (actor: Actor, outputItemId: string) => {
    const organizationId = requireOrganization(actor);
    return inventoryTransactionService.getRollingAverageForOutputItem(organizationId, outputItemId);
  },

  // ── PrepRecipe (optional, Manager-only create/edit — §8.3) ────────────────

  listRecipes: async (actor: Actor): Promise<PrepRecipeWithLines[]> => {
    const organizationId = requireOrganization(actor);
    return prepRecordRepository.findAllRecipesByOrganization(organizationId);
  },

  getRecipeById: async (actor: Actor, id: string): Promise<PrepRecipeWithLines> => {
    const organizationId = requireOrganization(actor);
    const recipe = await prepRecordRepository.findRecipeById(id, organizationId);
    if (!recipe) {
      throw new NotFoundError('Prep recipe not found');
    }
    return recipe;
  },

  /** Recipe for a given output item, or null if none exists yet — Log Prep's pre-fill lookup. */
  getRecipeByOutputItem: async (actor: Actor, outputItemId: string): Promise<PrepRecipeWithLines | null> => {
    const organizationId = requireOrganization(actor);
    return prepRecordRepository.findRecipeByOutputItem(outputItemId, organizationId);
  },

  /**
   * Directly authors a Prep Recipe — Manager-only (route-gated). Creates the
   * output InventoryItem (type PREPPED) and the recipe together; a prepped
   * item can no longer be created from Item Catalog (D-12 reopened — see
   * UI_UX_DESIGN_AUDIT.md Flow 3).
   */
  createRecipe: async (actor: Actor, input: CreatePrepRecipeInput): Promise<PrepRecipeWithLines> => {
    const organizationId = requireOrganization(actor);
    return prepRecordRepository.createRecipeDirect(organizationId, {
      outputItemName: input.outputItemName,
      usageUnit: input.usageUnit,
      name: input.outputItemName,
      expectedYield: input.expectedYield,
      batchLabel: input.batchLabel,
      instructions: input.instructions,
      createdById: actor.id,
      lines: input.inputs.map((line) => ({
        inputItemId: line.inventoryItemId,
        quantity: line.quantity,
      })),
    });
  },

  /**
   * Edits a recipe's own fields/lines — Manager-only. Never touches past
   * PrepRecords; only changes what pre-fills on future Log Prep runs.
   */
  updateRecipe: async (actor: Actor, id: string, input: UpdatePrepRecipeInput): Promise<PrepRecipeWithLines> => {
    const organizationId = requireOrganization(actor);
    const updated = await prepRecordRepository.updateRecipe(id, organizationId, {
      name: input.name,
      expectedYield: input.expectedYield,
      batchLabel: input.batchLabel,
      instructions: input.instructions,
      lines: input.inputs?.map((line) => ({
        inputItemId: line.inventoryItemId,
        quantity: line.quantity,
      })),
    });
    if (!updated) {
      throw new NotFoundError('Prep recipe not found');
    }
    return updated;
  },

  /**
   * Promotes a Prep Record into a saved PrepRecipe — Manager-only (§8.3).
   * Copies the record's own input lines/output/yield as the recipe's
   * starting point; the recipe is a soft reference only, never a
   * precondition for future prepping (D-12).
   */
  promoteRecord: async (
    actor: Actor,
    prepRecordId: string,
    input: PromotePrepRecipeInput,
  ): Promise<PrepRecipeWithLines> => {
    const organizationId = requireOrganization(actor);

    const record = await prepRecordRepository.findById(prepRecordId, organizationId);
    if (!record) {
      throw new NotFoundError('Prep record not found');
    }

    return prepRecordRepository.createRecipeFromRecord(organizationId, {
      promotedFromId: record.id,
      outputItemId: record.outputItemId,
      name: input.name,
      expectedYield: input.expectedYield ?? record.actualYield,
      batchLabel: input.batchLabel,
      instructions: input.instructions,
      createdById: actor.id,
      lines: record.lines.map((line) => ({
        inputItemId: line.inputItemId,
        quantity: line.quantity,
      })),
    });
  },
};
