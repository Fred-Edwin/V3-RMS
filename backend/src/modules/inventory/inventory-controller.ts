import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { inventoryService } from './inventory-service';
import {
  CreateCategorySchema,
  CreateItemSchema,
  IdParamSchema,
  ListCategoriesQuerySchema,
  ListItemsQuerySchema,
  ItemHistoryQuerySchema,
  ListRestockLevelsQuerySchema,
  PutBackRestockLevelSchema,
  RestockHistoryQuerySchema,
  RestockLevelsSummaryQuerySchema,
  RestoreItemSchema,
  RetireItemQuerySchema,
  SaveRestockLevelsSchema,
  UpdateCategorySchema,
  UpdateItemSchema,
} from './inventory-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const inventoryController = {
  getCentralStoreLocation: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const data = await inventoryService.getCentralStoreLocation(actor);
    res.status(200).json({ success: true, data });
  },

  // ── Categories ───────────────────────────────────────────────────────────

  listCategories: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { includeRetired } = ListCategoriesQuerySchema.parse(req.query);
    const data = await inventoryService.listCategories(actor, includeRetired);
    res.status(200).json({ success: true, data });
  },

  createCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateCategorySchema.parse(req.body);
    const data = await inventoryService.createCategory(actor, input);
    res.status(201).json({ success: true, data, message: 'Category created successfully' });
  },

  renameCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateCategorySchema.parse(req.body);
    const data = await inventoryService.renameCategory(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Category renamed successfully' });
  },

  retireCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.retireCategory(actor, id);
    res.status(200).json({ success: true, data, message: 'Category retired successfully' });
  },

  restoreCategory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.restoreCategory(actor, id);
    res.status(200).json({ success: true, data, message: 'Category restored successfully' });
  },

  // ── Items ────────────────────────────────────────────────────────────────

  listItems: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListItemsQuerySchema.parse(req.query);
    const { data, pagination, meta } = await inventoryService.listItems(actor, query);
    res.status(200).json({ success: true, data, pagination, meta });
  },

  getItemById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.getItemById(actor, id);
    res.status(200).json({ success: true, data });
  },

  getItemChangeReview: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.getItemChangeReview(actor, id);
    res.status(200).json({ success: true, data });
  },

  createItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateItemSchema.parse(req.body);
    const data = await inventoryService.createItem(actor, input);
    res.status(201).json({ success: true, data, message: 'Item created successfully' });
  },

  updateItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateItemSchema.parse(req.body);
    const data = await inventoryService.updateItem(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Item updated successfully' });
  },

  getItemHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const { limit } = ItemHistoryQuerySchema.parse(req.query);
    const data = await inventoryService.getItemHistory(actor, id, limit);
    res.status(200).json({ success: true, data });
  },

  retireItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const { reason } = RetireItemQuerySchema.parse(req.query);
    const data = await inventoryService.retireItem(actor, id, reason);
    res.status(200).json({ success: true, data, message: 'Item retired successfully' });
  },

  restoreItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const { reason } = RestoreItemSchema.parse(req.body ?? {});
    const data = await inventoryService.restoreItem(actor, id, reason);
    res.status(200).json({ success: true, data, message: 'Item restored successfully' });
  },

  // ── Restock levels ───────────────────────────────────────────────────────

  listRestockLevels: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListRestockLevelsQuerySchema.parse(req.query);
    const data = await inventoryService.listRestockLevels(actor, query);
    res.status(200).json({ success: true, data });
  },

  getRestockLevelsSummary: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = RestockLevelsSummaryQuerySchema.parse(req.query);
    const data = await inventoryService.getRestockLevelsSummary(actor, query);
    res.status(200).json({ success: true, data });
  },

  listRestockHistory: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = RestockHistoryQuerySchema.parse(req.query);
    const data = await inventoryService.listRestockHistory(actor, query);
    res.status(200).json({ success: true, data });
  },

  putBackRestockLevel: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = PutBackRestockLevelSchema.parse(req.body ?? {});
    const data = await inventoryService.putBackRestockLevel(actor, id, input);
    res.status(201).json({ success: true, data, message: 'Restock level put back' });
  },

  saveRestockLevels: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = SaveRestockLevelsSchema.parse(req.body);
    const data = await inventoryService.saveRestockLevels(actor, input);
    res.status(200).json({ success: true, data, message: 'Restock levels saved successfully' });
  },
};
