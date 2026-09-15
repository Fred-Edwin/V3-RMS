import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { inventoryService } from './inventory-service';
import {
  CreateCategorySchema,
  CreateItemSchema,
  CreateSupplierSchema,
  IdParamSchema,
  ListCategoriesQuerySchema,
  ListItemsQuerySchema,
  ListRestockLevelsQuerySchema,
  ListSuppliersQuerySchema,
  SaveRestockLevelsSchema,
  UpdateCategorySchema,
  UpdateItemSchema,
  UpdateSupplierSchema,
} from './inventory-validators';

const requireActor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};

export const inventoryController = {
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

  retireItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.retireItem(actor, id);
    res.status(200).json({ success: true, data, message: 'Item retired successfully' });
  },

  restoreItem: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.restoreItem(actor, id);
    res.status(200).json({ success: true, data, message: 'Item restored successfully' });
  },

  // ── Suppliers ────────────────────────────────────────────────────────────

  listSuppliers: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListSuppliersQuerySchema.parse(req.query);
    const { data, pagination } = await inventoryService.listSuppliers(actor, query);
    res.status(200).json({ success: true, data, pagination });
  },

  getSupplierById: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.getSupplierById(actor, id);
    res.status(200).json({ success: true, data });
  },

  createSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = CreateSupplierSchema.parse(req.body);
    const data = await inventoryService.createSupplier(actor, input);
    res.status(201).json({ success: true, data, message: 'Supplier created successfully' });
  },

  updateSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const input = UpdateSupplierSchema.parse(req.body);
    const data = await inventoryService.updateSupplier(actor, id, input);
    res.status(200).json({ success: true, data, message: 'Supplier updated successfully' });
  },

  retireSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.retireSupplier(actor, id);
    res.status(200).json({ success: true, data, message: 'Supplier retired successfully' });
  },

  restoreSupplier: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { id } = IdParamSchema.parse(req.params);
    const data = await inventoryService.restoreSupplier(actor, id);
    res.status(200).json({ success: true, data, message: 'Supplier restored successfully' });
  },

  // ── Restock levels ───────────────────────────────────────────────────────

  listRestockLevels: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const query = ListRestockLevelsQuerySchema.parse(req.query);
    const data = await inventoryService.listRestockLevels(actor, query);
    res.status(200).json({ success: true, data });
  },

  saveRestockLevels: async (req: Request, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const input = SaveRestockLevelsSchema.parse(req.body);
    const data = await inventoryService.saveRestockLevels(actor, input);
    res.status(200).json({ success: true, data, message: 'Restock levels saved successfully' });
  },
};
